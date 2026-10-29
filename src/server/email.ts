// Transactional email through Resend's HTTP API. Every attempt is recorded in email_deliveries;
// without RESEND_API_KEY and EMAIL_FROM nothing is sent and the delivery is recorded as not_configured (never as sent).
// Bodies are not stored. Notification emails never carry document names or message text, only a prompt to sign in.
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "./db.ts";
import { emailDeliveries, emailTemplates, organizations } from "./schema.ts";

export const templateKinds = {
  invitation: {
    label: "Portal invitation",
    vars: ["firm", "name", "link", "username", "password", "expires"],
    subject: "Welcome to your secure client portal at {{firm}}",
    body: "Hi {{name}},\n\nWelcome! {{firm}} has set up your personal client portal for your mortgage application. Use it to upload your documents securely, follow your application's progress and message your team.\n\nSign in here: {{link}}\nUsername: {{username}}\nTemporary password: {{password}}\n\nThe first time you sign in, you'll be asked to choose your own password. The temporary password stops working on {{expires}}. If you weren't expecting this email, you can ignore it.",
  },
  portal_added: {
    label: "Application added to portal",
    vars: ["firm", "name", "link", "username"],
    subject: "{{firm}} added your application to your client portal",
    body: "Hi {{name}},\n\n{{firm}} has added your mortgage application to your secure client portal. Sign in with your existing password to upload documents and follow its progress:\n\n{{link}}\nUsername: {{username}}",
  },
  document_request: {
    label: "Documents requested",
    vars: ["firm", "name", "link"],
    subject: "{{firm}} needs documents for your application",
    body: "Hi {{name}},\n\n{{firm}} has requested documents for your mortgage application. Sign in to your portal to see what's needed and upload them securely:\n\n{{link}}",
  },
  replacement: {
    label: "Replacement needed",
    vars: ["firm", "name", "link"],
    subject: "{{firm}} needs a replacement document",
    body: "Hi {{name}},\n\nOne of the documents you uploaded needs to be replaced. Sign in to your portal to see why and upload a new version:\n\n{{link}}",
  },
  reminder: {
    label: "Document reminder",
    vars: ["firm", "name", "link"],
    subject: "Reminder: documents still needed for your application",
    body: "Hi {{name}},\n\nThis is a reminder from {{firm}} that some documents are still outstanding. Sign in to your portal to upload them:\n\n{{link}}",
  },
  message: {
    label: "New message",
    vars: ["firm", "name", "link"],
    subject: "You have a new secure message from {{firm}}",
    body: "Hi {{name}},\n\nYou have a new message about your mortgage application. For your security the message isn't included in this email. Sign in to read it:\n\n{{link}}",
  },
  progress: {
    label: "Progress update",
    vars: ["firm", "name", "link"],
    subject: "Your mortgage application has an update",
    body: "Hi {{name}},\n\n{{firm}} has posted an update on your mortgage application. Sign in to see where things stand and what's next:\n\n{{link}}",
  },
} as const;
export type TemplateKind = keyof typeof templateKinds;

export const render = (s: string, vars: Record<string, string>) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// Plain text in, minimal branded HTML out; links become buttons-free anchors.
const html = (firm: string, text: string) =>
  `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;max-width:560px"><div style="background:#3c8dbc;color:#fff;padding:12px 16px;font-size:16px">${escape(firm)}</div><div style="padding:16px;white-space:pre-wrap">${escape(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</div></div>`;

export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function getTemplate(db: Db, organizationId: string, kind: TemplateKind) {
  const [row] = await db.select().from(emailTemplates).where(and(eq(emailTemplates.organizationId, organizationId), eq(emailTemplates.kind, kind)));
  return row ? { subject: row.subject, body: row.body, custom: true } : { subject: templateKinds[kind].subject, body: templateKinds[kind].body, custom: false };
}

export async function sendEmail(db: Db, m: { organizationId: string; kind: TemplateKind; to: string; vars: Record<string, string>; invitationId?: string }) {
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, m.organizationId));
  const vars = { firm: org.name, ...m.vars };
  const t = await getTemplate(db, m.organizationId, m.kind);
  const subject = render(t.subject, vars), text = render(t.body, vars);
  let status: "not_configured" | "sent" | "failed" = "not_configured", providerId: string | null = null, error: string | null = null;
  if (emailConfigured()) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [m.to], subject, text, html: html(org.name, text) }),
        signal: AbortSignal.timeout(10000),
      });
      const body = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
      if (r.ok && body.id) [status, providerId] = ["sent", body.id];
      else [status, error] = ["failed", `${r.status}: ${body.message ?? "unknown error"}`.slice(0, 300)];
    } catch (e) {
      [status, error] = ["failed", String(e instanceof Error ? e.message : e).slice(0, 300)];
    }
  }
  const [row] = await db.insert(emailDeliveries).values({ organizationId: m.organizationId, kind: m.kind, toEmail: m.to, status, providerId, error, invitationId: m.invitationId }).returning();
  return row;
}

// Resend webhooks are signed the Svix way: HMAC-SHA256 over "id.timestamp.body" with the base64 part of whsec_... .
export function verifyWebhook(secret: string, headers: Headers, body: string, now = Date.now()) {
  const id = headers.get("svix-id"), ts = headers.get("svix-timestamp"), sigs = headers.get("svix-signature");
  if (!id || !ts || !sigs || Math.abs(now / 1000 - Number(ts)) > 300) return false;
  const expected = createHmac("sha256", Buffer.from(secret.replace(/^whsec_/, ""), "base64")).update(`${id}.${ts}.${body}`).digest();
  return sigs.split(" ").some((s) => {
    const sig = Buffer.from(s.split(",")[1] ?? "", "base64");
    return sig.length === expected.length && timingSafeEqual(sig, expected);
  });
}

const eventStatus: Record<string, "delivered" | "bounced" | "complained" | "failed"> = {
  "email.delivered": "delivered", "email.bounced": "bounced", "email.complained": "complained", "email.failed": "failed",
};

export async function applyWebhookEvent(db: Db, event: { type?: string; data?: { email_id?: string } }) {
  const status = event.type && eventStatus[event.type];
  if (!status || !event.data?.email_id) return false;
  await db.update(emailDeliveries).set({ status, updatedAt: new Date() }).where(eq(emailDeliveries.providerId, event.data.email_id));
  return true;
}
