// Client portal, firm side: invitations, document requests and review, client-facing progress, secure messaging,
// staff notes, assignment, the portal dashboard and notifications. Shared upload / notification helpers are used by
// portal-client.ts too. Every staff read is limited by dealScope; every change is audited on the deal (entity "deal",
// action "portal_*") in the same transaction, without document contents, message bodies or tokens.
import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, like, ne, or, sql } from "drizzle-orm";
import { dealScope, Forbidden, type Actor } from "./access.ts";
import { isAdmin, text } from "./admin.ts";
import { audit } from "./audit.ts";
import { MAX_UPLOAD, sniffType } from "./conditions.ts";
import { ValidationError } from "./contacts.ts";
import type { Db, Tx } from "./db.ts";
import { dealCode } from "./deal-status.ts";
import { emailConfigured, sendEmail, type TemplateKind } from "./email.ts";
import {
  auditLog, clientInvitations, clients, contacts, conversationReads, conversations, dealBorrowers, dealNotes, deals, documentChecklists,
  documentRequests, documentVersions, emailDeliveries, files, messageAttachments, messages, notifications, organizations, progressStages,
  progressUpdates, requestStatus, users, type ChecklistItem,
} from "./schema.ts";
import { getFile, removeFile, scanBytes, uploadUrl } from "./storage.ts";

export const UUID = /^[0-9a-f-]{36}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export type RequestStatus = (typeof requestStatus.enumValues)[number];

// Links in emails. APP_URL in production; Vercel's production domain as a fallback.
export const appUrl = () =>
  process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const staffHref = (dealId: string) => `/deal/${dealId}/clientPortal`;
export const clientHref = (dealId: string) => `/portal/applications/${dealId}`;

// ---- Defaults, created per firm the first time the portal is used.

export const defaultStages = [
  ["Application started", "We've received your application and set up your file.", "Watch for document requests from your team."],
  ["Documents requested", "Your team has asked for the documents that support your application.", "Check below for anything still to upload."],
  ["Documents under review", "Your team is reviewing the documents you've provided.", "Nothing to do right now. We'll let you know if anything else is needed."],
  ["Submitted to lender", "Your application has been sent to the lender for a decision.", "Nothing to do right now. Lenders usually respond within a few business days."],
  ["Conditional approval", "The lender has approved your mortgage, subject to conditions.", "Your team will tell you which conditions need your help."],
  ["Conditions outstanding", "Some conditions of the approval still need to be satisfied.", "Upload any documents requested to satisfy the remaining conditions."],
  ["Ready to close", "All conditions are met and your file is with the lawyer for closing.", "Book your signing appointment with your lawyer."],
  ["Funded", "Your mortgage has funded. Congratulations!", "Nothing left to do."],
] as const;

const id = { name: "Government photo ID", category: "Identity", description: "Driver's licence or passport, front and back, not expired." };
const bank = { name: "90-day bank statements", category: "Down payment", description: "Statements for the account holding your down payment, showing your name and account number." };
export const defaultChecklists: { name: string; items: ChecklistItem[] }[] = [
  { name: "Salaried employee", items: [id,
    { name: "Letter of employment", category: "Income", description: "On company letterhead, dated within 30 days, with position, start date and salary." },
    { name: "Two recent pay stubs", category: "Income", description: "Your two most recent pay stubs." },
    { name: "T4 slips (last two years)", category: "Income", description: "" }, bank] },
  { name: "Self-employed", items: [id,
    { name: "T1 Generals (last two years)", category: "Income", description: "Complete personal tax returns with all schedules." },
    { name: "Notices of Assessment (last two years)", category: "Income", description: "" },
    { name: "Business registration or articles of incorporation", category: "Income", description: "" }, bank] },
  { name: "Purchase", items: [
    { name: "Agreement of purchase and sale", category: "Property", description: "Signed, with all amendments and waivers." },
    { name: "MLS listing", category: "Property", description: "" }] },
];

// ponytail: check-then-insert; two first-ever requests at the same instant could double the stages. Add a unique (org, position) if that bites.
export async function ensurePortalDefaults(db: Db | Tx, organizationId: string) {
  const [{ n }] = await db.select({ n: count() }).from(progressStages).where(eq(progressStages.organizationId, organizationId));
  if (!n) await db.insert(progressStages).values(defaultStages.map(([label, clientDescription, nextAction], position) => ({ organizationId, label, clientDescription, nextAction, position })));
  const [{ c }] = await db.select({ c: count() }).from(documentChecklists).where(eq(documentChecklists.organizationId, organizationId));
  if (!c) await db.insert(documentChecklists).values(defaultChecklists.map((l) => ({ organizationId, ...l }))).onConflictDoNothing();
}

// ---- Access

export async function staffDeal(db: Db | Tx, actor: Actor, dealId: string) {
  const [d] = UUID.test(dealId) ? await db.select().from(deals).where(and(eq(deals.id, dealId), dealScope(actor))) : [];
  if (!d) throw new Forbidden("Deal not found");
  return d;
}

const portalAudit = (tx: Tx, actor: Actor, dealId: string, action: string, after: unknown = null) => audit(tx, actor, "deal", dealId, `portal_${action}`, null, after);

// ---- Notifications. Titles and emails never carry document names or message text.

type Note = { kind: string; title: string; email?: TemplateKind };

// Clients with portal access on the deal; applicantContactId set = only that applicant.
export async function notifyClients(db: Db, dealId: string, applicantContactId: string | null, n: Note) {
  const rows = await db.select({ c: clients }).from(dealBorrowers)
    .innerJoin(clients, eq(clients.contactId, dealBorrowers.contactId))
    .where(and(eq(dealBorrowers.dealId, dealId), eq(dealBorrowers.portalAccess, true), isNotNull(clients.accountId), isNull(clients.disabledAt),
      applicantContactId ? eq(dealBorrowers.contactId, applicantContactId) : undefined));
  if (!rows.length) return;
  await db.insert(notifications).values(rows.map(({ c }) => ({ organizationId: c.organizationId, clientId: c.id, dealId, kind: n.kind, title: n.title, href: clientHref(dealId) })));
  if (!n.email) return;
  const names = await db.select({ id: contacts.id, first: contacts.firstName }).from(contacts).where(inArray(contacts.id, rows.map((r) => r.c.contactId)));
  for (const { c } of rows.filter((r) => r.c.emailNotifications))
    await sendEmail(db, { organizationId: c.organizationId, kind: n.email, to: c.email, vars: { name: names.find((x) => x.id === c.contactId)?.first ?? "", link: `${appUrl()}${clientHref(dealId)}` } });
}

// The deal's agent and assignee (active ones), except whoever caused it.
export async function notifyStaff(db: Db, deal: { id: string; organizationId: string; agentId: string; assigneeId: string | null }, title: string, kind: string, except?: string) {
  const ids = [...new Set([deal.agentId, deal.assigneeId].filter((x): x is string => !!x && x !== except))];
  const active = ids.length ? await db.select({ id: users.id }).from(users).where(and(inArray(users.id, ids), isNull(users.deactivatedAt))) : [];
  if (active.length) await db.insert(notifications).values(active.map((u) => ({ organizationId: deal.organizationId, userId: u.id, dealId: deal.id, kind, title, href: staffHref(deal.id) })));
}

// ---- Uploads (staff and clients). The browser PUTs the bytes straight to storage; finishUpload checks them.

export type Uploader = { userId: string; clientId?: undefined } | { clientId: string; userId?: undefined };
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];

export function safeFileName(raw: unknown) {
  const name = (typeof raw === "string" ? raw : "").replace(/[\\/"\x00-\x1f<>:|?*]/g, "_").trim().slice(-200);
  if (!name || /^\.+$/.test(name)) throw new ValidationError("The file needs a name");
  return name;
}

export async function startUpload(db: Db, who: Uploader, deal: { id: string; organizationId: string }, input: { fileName?: unknown; size?: unknown; contentType?: unknown }) {
  const size = Number(input.size);
  if (!Number.isInteger(size) || size <= 0) throw new ValidationError("The file is empty");
  if (size > MAX_UPLOAD) throw new ValidationError("Files can be up to 10 MB");
  if (!ALLOWED.includes(String(input.contentType))) throw new ValidationError("Only PDF, JPEG and PNG files can be uploaded");
  const [f] = await db.insert(files).values({
    organizationId: deal.organizationId, dealId: deal.id, fileName: safeFileName(input.fileName), size, uploadedByUserId: who.userId, uploadedByClientId: who.clientId,
  }).returning({ id: files.id });
  return { fileId: f.id, url: await uploadUrl(f.id) };
}

// The bytes decide: real type by magic number, real size, then the malware scan. Rejected files are deleted.
export async function finishUpload(db: Db, who: Uploader, fileId: string) {
  const [f] = UUID.test(fileId) ? await db.select().from(files).where(eq(files.id, fileId)) : [];
  if (!f || f.scanStatus !== "pending" || (who.userId ? f.uploadedByUserId !== who.userId : f.uploadedByClientId !== who.clientId)) throw new Forbidden("Upload not found");
  let bytes: Buffer;
  try {
    bytes = await getFile(fileId);
  } catch {
    throw new ValidationError("The upload didn't arrive. Please try again.");
  }
  const reject = async (msg: string) => {
    await removeFile(fileId);
    await db.delete(files).where(eq(files.id, fileId));
    throw new ValidationError(msg);
  };
  if (bytes.length > MAX_UPLOAD) await reject("Files can be up to 10 MB");
  const type = sniffType(bytes);
  if (!type) await reject("Only PDF, JPEG and PNG files can be uploaded");
  const scan = await scanBytes(bytes);
  if (scan === "infected") await reject("This file failed the malware scan and was deleted");
  const [done] = await db.update(files).set({ contentType: type, size: bytes.length, scanStatus: scan }).where(eq(files.id, fileId)).returning();
  return done;
}

// Files a poster may attach: theirs, finished, on this deal, not used anywhere yet.
export async function claimFiles(tx: Tx, who: Uploader, dealId: string, raw: unknown) {
  const ids = [...new Set(Array.isArray(raw) ? raw.map(String) : [])];
  if (!ids.length) return [];
  if (ids.length > 5 || ids.some((x) => !UUID.test(x))) throw new ValidationError("Attach up to 5 files");
  const rows = await tx.select({ id: files.id, v: documentVersions.id, a: messageAttachments.messageId }).from(files)
    .leftJoin(documentVersions, eq(documentVersions.fileId, files.id)).leftJoin(messageAttachments, eq(messageAttachments.fileId, files.id))
    .where(and(inArray(files.id, ids), eq(files.dealId, dealId), inArray(files.scanStatus, ["clean", "not_scanned"]),
      who.userId ? eq(files.uploadedByUserId, who.userId) : eq(files.uploadedByClientId, who.clientId!)));
  if (rows.length !== ids.length || rows.some((r) => r.v || r.a)) throw new ValidationError("One of the files can't be attached. Upload it again.");
  return ids;
}

// ---- Invitations

const newToken = () => randomBytes(32).toString("base64url");
const inviteLink = (token: string) => `${appUrl()}/portal/accept?token=${token}`;

async function sendInvite(db: Db, inv: { id: string; organizationId: string; email: string; expiresAt: Date; contactId: string }, token: string) {
  const [c] = await db.select({ first: contacts.firstName }).from(contacts).where(eq(contacts.id, inv.contactId));
  const link = inviteLink(token);
  const delivery = await sendEmail(db, {
    organizationId: inv.organizationId, kind: "invitation", to: inv.email, invitationId: inv.id,
    vars: { name: c.first, link, expires: inv.expiresAt.toLocaleDateString("en-CA", { dateStyle: "long" }) },
  });
  await db.update(clientInvitations).set({ sentCount: sql`${clientInvitations.sentCount} + 1`, lastSentAt: new Date() }).where(eq(clientInvitations.id, inv.id));
  // The link is only handed back when the email didn't go out, so staff can pass it on another way. It is never stored.
  return { status: delivery.status, error: delivery.error, link: delivery.status === "sent" ? null : link };
}

export async function inviteApplicant(db: Db, actor: Actor, dealId: string, contactId: string) {
  const deal = await staffDeal(db, actor, dealId);
  const [b] = UUID.test(contactId)
    ? await db.select({ c: contacts }).from(dealBorrowers).innerJoin(contacts, eq(contacts.id, dealBorrowers.contactId)).where(and(eq(dealBorrowers.dealId, dealId), eq(dealBorrowers.contactId, contactId)))
    : [];
  if (!b) throw new ValidationError("That person isn't an applicant on this deal");
  const email = b.c.email?.trim().toLowerCase() ?? "";
  if (!EMAIL.test(email)) throw new ValidationError("Add a valid email address to the applicant's contact record first");
  const [org] = await db.select({ days: organizations.inviteExpiryDays }).from(organizations).where(eq(organizations.id, deal.organizationId));
  const token = newToken();
  const inv = await db.transaction(async (tx) => {
    let [client] = await tx.select().from(clients).where(eq(clients.contactId, contactId));
    if (!client) [client] = await tx.insert(clients).values({ organizationId: deal.organizationId, contactId, email }).returning();
    else if (client.disabledAt) await tx.update(clients).set({ disabledAt: null }).where(eq(clients.id, client.id));
    // A new invitation replaces any still-pending one for the same person and deal.
    await tx.update(clientInvitations).set({ status: "revoked" })
      .where(and(eq(clientInvitations.dealId, dealId), eq(clientInvitations.contactId, contactId), eq(clientInvitations.status, "pending")));
    const [row] = await tx.insert(clientInvitations).values({
      organizationId: deal.organizationId, dealId, contactId, clientId: client.id, email, tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + org.days * 86_400_000), createdBy: actor.id,
    }).returning();
    await portalAudit(tx, actor, dealId, "invite", { invitationId: row.id, contactId });
    return row;
  });
  return { invitationId: inv.id, ...(await sendInvite(db, inv, token)) };
}

async function staffInvitation(db: Db, actor: Actor, invitationId: string) {
  const [row] = UUID.test(invitationId)
    ? await db.select({ i: clientInvitations }).from(clientInvitations).innerJoin(deals, eq(deals.id, clientInvitations.dealId)).where(and(eq(clientInvitations.id, invitationId), dealScope(actor)))
    : [];
  if (!row) throw new Forbidden("Invitation not found");
  return row.i;
}

// Resending issues a fresh link (only hashes are stored) with a fresh expiry; the old link stops working.
export async function resendInvitation(db: Db, actor: Actor, invitationId: string) {
  const inv = await staffInvitation(db, actor, invitationId);
  if (inv.status !== "pending") throw new ValidationError("Only a pending invitation can be resent");
  const [org] = await db.select({ days: organizations.inviteExpiryDays }).from(organizations).where(eq(organizations.id, inv.organizationId));
  const token = newToken();
  const [row] = await db.transaction(async (tx) => {
    await portalAudit(tx, actor, inv.dealId, "invite_resend", { invitationId });
    return tx.update(clientInvitations).set({ tokenHash: hashToken(token), expiresAt: new Date(Date.now() + org.days * 86_400_000) }).where(eq(clientInvitations.id, invitationId)).returning();
  });
  return sendInvite(db, row, token);
}

export async function revokeInvitation(db: Db, actor: Actor, invitationId: string) {
  const inv = await staffInvitation(db, actor, invitationId);
  if (inv.status !== "pending") throw new ValidationError("Only a pending invitation can be revoked");
  await db.transaction(async (tx) => {
    await tx.update(clientInvitations).set({ status: "revoked" }).where(eq(clientInvitations.id, invitationId));
    await portalAudit(tx, actor, inv.dealId, "invite_revoke", { invitationId });
  });
}

// Turning access off closes this deal in that applicant's portal at once; turning it back on needs an accepted account.
export async function setPortalAccess(db: Db, actor: Actor, dealId: string, contactId: string, on: boolean) {
  await staffDeal(db, actor, dealId);
  const [c] = UUID.test(contactId) ? await db.select().from(clients).where(eq(clients.contactId, contactId)) : [];
  if (on && !c?.accountId) throw new ValidationError("This applicant hasn't accepted an invitation yet. Send one instead.");
  await db.transaction(async (tx) => {
    const r = await tx.update(dealBorrowers).set({ portalAccess: on }).where(and(eq(dealBorrowers.dealId, dealId), eq(dealBorrowers.contactId, contactId))).returning();
    if (!r.length) throw new ValidationError("That person isn't an applicant on this deal");
    await portalAudit(tx, actor, dealId, on ? "access_on" : "access_off", { contactId });
  });
}

// ---- Document requests

function requestInput(input: Record<string, unknown>) {
  const due = text(input.dueDate, "Due date", 10, false);
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new ValidationError("Due date must be a date");
  return { category: text(input.category, "Category", 60, false) || "General", description: text(input.description, "Description", 1000, false), dueDate: due || null };
}

async function applicantOf(db: Db, dealId: string, raw: unknown) {
  if (!raw) return null;
  const contactId = String(raw);
  const [b] = UUID.test(contactId) ? await db.select().from(dealBorrowers).where(and(eq(dealBorrowers.dealId, dealId), eq(dealBorrowers.contactId, contactId))) : [];
  if (!b) throw new ValidationError("That person isn't an applicant on this deal");
  return contactId;
}

// One request ({name, category, ...}) or a whole checklist ({checklistId}). applicantContactId set = private to that applicant.
export async function requestDocuments(db: Db, actor: Actor, dealId: string, input: Record<string, unknown>) {
  const deal = await staffDeal(db, actor, dealId);
  const applicantContactId = await applicantOf(db, dealId, input.applicantContactId);
  let items: { name: string; category: string; description: string; dueDate: string | null }[];
  if (input.checklistId) {
    const [list] = UUID.test(String(input.checklistId))
      ? await db.select().from(documentChecklists).where(and(eq(documentChecklists.id, String(input.checklistId)), eq(documentChecklists.organizationId, actor.organizationId), eq(documentChecklists.active, true)))
      : [];
    if (!list) throw new ValidationError("Checklist not found");
    const { dueDate } = requestInput(input);
    items = list.items.map((i) => ({ ...i, dueDate }));
  } else items = [{ name: text(input.name, "Document name", 120), ...requestInput(input) }];
  const rows = await db.transaction(async (tx) => {
    const added = await tx.insert(documentRequests).values(items.map((i) => ({ dealId, applicantContactId, ...i, createdBy: actor.id }))).returning({ id: documentRequests.id });
    await portalAudit(tx, actor, dealId, "request", { count: added.length, applicantContactId, checklistId: input.checklistId ?? null });
    return added;
  });
  await notifyClients(db, deal.id, applicantContactId, { kind: "document_request", title: `${rows.length} document${rows.length > 1 ? "s" : ""} requested`, email: "document_request" });
  return rows;
}

async function staffRequest(db: Db, actor: Actor, requestId: string) {
  const [row] = UUID.test(requestId)
    ? await db.select({ r: documentRequests, deal: deals }).from(documentRequests).innerJoin(deals, eq(deals.id, documentRequests.dealId))
      .where(and(eq(documentRequests.id, requestId), isNull(documentRequests.deletedAt), dealScope(actor)))
    : [];
  if (!row) throw new Forbidden("Request not found");
  return row;
}

const reviewMoves: Record<string, RequestStatus[]> = {
  under_review: ["uploaded"],
  accepted: ["uploaded", "under_review"],
  replacement_required: ["uploaded", "under_review", "accepted"],
};

export async function reviewRequest(db: Db, actor: Actor, requestId: string, to: string, reason?: unknown) {
  const { r, deal } = await staffRequest(db, actor, requestId);
  if (!reviewMoves[to]?.includes(r.status)) throw new ValidationError(`A ${r.status.replace("_", " ")} document can't be marked ${to.replace("_", " ")}`);
  const why = to === "replacement_required" ? text(reason, "A reason for the replacement", 500) : null;
  await db.transaction(async (tx) => {
    await tx.update(documentRequests).set({ status: to as RequestStatus, replacementReason: why, updatedAt: new Date() }).where(eq(documentRequests.id, requestId));
    await portalAudit(tx, actor, deal.id, "review", { requestId, from: r.status, to });
  });
  if (to === "replacement_required") await notifyClients(db, deal.id, r.applicantContactId, { kind: "replacement", title: "A document needs to be replaced", email: "replacement" });
  if (to === "accepted") await notifyClients(db, deal.id, r.applicantContactId, { kind: "accepted", title: "A document was accepted" });
}

export async function remindRequest(db: Db, actor: Actor, requestId: string, now = new Date()) {
  const { r, deal } = await staffRequest(db, actor, requestId);
  if (r.status !== "requested" && r.status !== "replacement_required") throw new ValidationError("Only outstanding documents need a reminder");
  if (r.lastRemindedAt && now.getTime() - r.lastRemindedAt.getTime() < 3_600_000) throw new ValidationError("A reminder was sent in the last hour");
  await db.transaction(async (tx) => {
    await tx.update(documentRequests).set({ lastRemindedAt: now }).where(eq(documentRequests.id, requestId));
    await portalAudit(tx, actor, deal.id, "remind", { requestId });
  });
  await notifyClients(db, deal.id, r.applicantContactId, { kind: "reminder", title: "Reminder: documents are still needed", email: "reminder" });
}

export async function cancelRequest(db: Db, actor: Actor, requestId: string) {
  const { deal } = await staffRequest(db, actor, requestId);
  await db.transaction(async (tx) => {
    await tx.update(documentRequests).set({ deletedAt: new Date() }).where(eq(documentRequests.id, requestId));
    await portalAudit(tx, actor, deal.id, "request_cancel", { requestId });
  });
}

// Shared by staff and clients: a new version moves the request to uploaded.
export async function addVersion(tx: Tx, requestId: string, fileId: string) {
  const [{ n }] = await tx.select({ n: sql<number>`coalesce(max(${documentVersions.version}), 0)::int` }).from(documentVersions).where(eq(documentVersions.requestId, requestId));
  await tx.insert(documentVersions).values({ requestId, fileId, version: n + 1 });
  await tx.update(documentRequests).set({ status: "uploaded", replacementReason: null, updatedAt: new Date() }).where(eq(documentRequests.id, requestId));
  return n + 1;
}

// Staff can upload on the client's behalf (a document received by email, say).
export async function staffAddVersion(db: Db, actor: Actor, requestId: string, fileId: string) {
  const { r, deal } = await staffRequest(db, actor, requestId);
  await db.transaction(async (tx) => {
    await claimFiles(tx, { userId: actor.id }, deal.id, [fileId]);
    const version = await addVersion(tx, r.id, fileId);
    await portalAudit(tx, actor, deal.id, "upload", { requestId, version });
  });
}

// Quarantined (not scanned) files can't be downloaded until an admin releases them.
export async function releaseFile(db: Db, actor: Actor, fileId: string) {
  if (!isAdmin(actor)) throw new Forbidden("Only an admin can release a file from quarantine");
  const [row] = UUID.test(fileId) ? await db.select({ f: files }).from(files).innerJoin(deals, eq(deals.id, files.dealId)).where(and(eq(files.id, fileId), dealScope(actor))) : [];
  if (!row) throw new Forbidden("File not found");
  if (row.f.scanStatus !== "not_scanned") throw new ValidationError("Only a quarantined file can be released");
  await db.transaction(async (tx) => {
    await tx.update(files).set({ scanStatus: "released", releasedBy: actor.id }).where(eq(files.id, fileId));
    await portalAudit(tx, actor, row.f.dealId, "release", { fileId });
  });
}

// ---- Progress (client-facing stage, separate from the internal deal status)

export async function setStage(db: Db, actor: Actor, dealId: string, stageId: string, message: unknown) {
  const deal = await staffDeal(db, actor, dealId);
  const [stage] = UUID.test(stageId) ? await db.select().from(progressStages).where(and(eq(progressStages.id, stageId), eq(progressStages.organizationId, deal.organizationId), eq(progressStages.active, true))) : [];
  if (!stage) throw new ValidationError("Choose a stage");
  const note = text(message, "Message", 1000, false);
  await db.transaction(async (tx) => {
    await tx.update(deals).set({ clientStageId: stage.id }).where(eq(deals.id, dealId));
    await tx.insert(progressUpdates).values({ dealId, stageId: stage.id, message: note, authorId: actor.id });
    await portalAudit(tx, actor, dealId, "stage", { stageId: stage.id, label: stage.label });
  });
  await notifyClients(db, dealId, null, { kind: "progress", title: `Your application is now at: ${stage.label}`, email: "progress" });
}

// ---- Messaging

export const readerOf = (who: Uploader) => (who.userId ? `u:${who.userId}` : `c:${who.clientId}`);

export async function markRead(db: Db | Tx, conversationId: string, who: Uploader, at = new Date()) {
  await db.insert(conversationReads).values({ conversationId, reader: readerOf(who), lastReadAt: at })
    .onConflictDoUpdate({ target: [conversationReads.conversationId, conversationReads.reader], set: { lastReadAt: at } });
}

export async function insertMessage(tx: Tx, conversationId: string, who: Uploader, dealId: string, rawBody: unknown, fileIds: unknown) {
  const body = text(rawBody, "Message", 5000, false);
  const attached = await claimFiles(tx, who, dealId, fileIds);
  if (!body && !attached.length) throw new ValidationError("Write a message or attach a file");
  const [m] = await tx.insert(messages).values({ conversationId, authorUserId: who.userId, authorClientId: who.clientId, body }).returning();
  if (attached.length) await tx.insert(messageAttachments).values(attached.map((fileId) => ({ messageId: m.id, fileId })));
  await markRead(tx, conversationId, who, m.createdAt);
  return m;
}

export async function startConversation(db: Db, actor: Actor, dealId: string, input: Record<string, unknown>) {
  await staffDeal(db, actor, dealId);
  const applicantContactId = await applicantOf(db, dealId, input.applicantContactId);
  const subject = text(input.subject, "Subject", 120);
  const c = await db.transaction(async (tx) => {
    const [c] = await tx.insert(conversations).values({ dealId, applicantContactId, subject }).returning();
    await insertMessage(tx, c.id, { userId: actor.id }, dealId, input.body, input.fileIds);
    await portalAudit(tx, actor, dealId, "conversation", { conversationId: c.id, applicantContactId });
    return c;
  });
  await notifyClients(db, dealId, applicantContactId, { kind: "message", title: "You have a new secure message", email: "message" });
  return c;
}

async function staffConversation(db: Db, actor: Actor, conversationId: string) {
  const [row] = UUID.test(conversationId)
    ? await db.select({ c: conversations }).from(conversations).innerJoin(deals, eq(deals.id, conversations.dealId)).where(and(eq(conversations.id, conversationId), dealScope(actor)))
    : [];
  if (!row) throw new Forbidden("Conversation not found");
  return row.c;
}

export async function staffReply(db: Db, actor: Actor, conversationId: string, body: unknown, fileIds: unknown) {
  const c = await staffConversation(db, actor, conversationId);
  await db.transaction(async (tx) => {
    const m = await insertMessage(tx, c.id, { userId: actor.id }, c.dealId, body, fileIds);
    await portalAudit(tx, actor, c.dealId, "message", { conversationId, messageId: m.id });
  });
  await notifyClients(db, c.dealId, c.applicantContactId, { kind: "message", title: "You have a new secure message", email: "message" });
}

export async function staffMarkRead(db: Db, actor: Actor, conversationId: string) {
  await markRead(db, (await staffConversation(db, actor, conversationId)).id, { userId: actor.id });
}

// ---- Staff notes (never shown to clients) and assignment

export async function addNote(db: Db, actor: Actor, dealId: string, body: unknown) {
  await staffDeal(db, actor, dealId);
  const b = text(body, "Note", 5000);
  await db.transaction(async (tx) => {
    const [n] = await tx.insert(dealNotes).values({ dealId, authorId: actor.id, body: b }).returning({ id: dealNotes.id });
    await portalAudit(tx, actor, dealId, "note", { noteId: n.id });
  });
}

// Admins assign; the assignee must be an active user who could manage the deal's office.
export async function assignDeal(db: Db, actor: Actor, dealId: string, userId: string | null) {
  if (!isAdmin(actor)) throw new Forbidden("Only an admin can assign applications");
  const deal = await staffDeal(db, actor, dealId);
  if (userId) {
    const [u] = UUID.test(userId) ? await db.select().from(users).where(and(eq(users.id, userId), eq(users.organizationId, deal.organizationId), isNull(users.deactivatedAt))) : [];
    if (!u || (actor.role === "office_admin" && u.officeId !== actor.officeId)) throw new ValidationError("Choose an active team member");
  }
  await db.transaction(async (tx) => {
    await tx.update(deals).set({ assigneeId: userId }).where(eq(deals.id, dealId));
    await portalAudit(tx, actor, dealId, "assign", { from: deal.assigneeId, to: userId });
  });
  if (userId && userId !== actor.id) await notifyStaff(db, { ...deal, agentId: userId, assigneeId: null }, `You were assigned ${dealCode(deal.number)}`, "assigned", actor.id);
}

// ---- Reading: the deal's Client Portal tab

export async function portalWorkspace(db: Db, actor: Actor, dealId: string, now = new Date()) {
  const deal = await staffDeal(db, actor, dealId);
  await ensurePortalDefaults(db, deal.organizationId);
  const applicants = await db.select({ contactId: contacts.id, first: contacts.firstName, last: contacts.lastName, email: contacts.email, position: dealBorrowers.position, portalAccess: dealBorrowers.portalAccess, client: clients })
    .from(dealBorrowers).innerJoin(contacts, eq(contacts.id, dealBorrowers.contactId)).leftJoin(clients, eq(clients.contactId, contacts.id))
    .where(eq(dealBorrowers.dealId, dealId)).orderBy(asc(dealBorrowers.position));
  const invites = await db.select().from(clientInvitations).where(eq(clientInvitations.dealId, dealId)).orderBy(desc(clientInvitations.createdAt));
  const deliveries = invites.length
    ? await db.select().from(emailDeliveries).where(inArray(emailDeliveries.invitationId, invites.map((i) => i.id))).orderBy(desc(emailDeliveries.createdAt))
    : [];
  const requests = await db.select().from(documentRequests).where(and(eq(documentRequests.dealId, dealId), isNull(documentRequests.deletedAt))).orderBy(asc(documentRequests.category), asc(documentRequests.createdAt));
  const versions = requests.length
    ? await db.select({ v: documentVersions, f: files, byUser: users.name, byClient: clients.email }).from(documentVersions).innerJoin(files, eq(files.id, documentVersions.fileId))
      .leftJoin(users, eq(users.id, files.uploadedByUserId)).leftJoin(clients, eq(clients.id, files.uploadedByClientId))
      .where(inArray(documentVersions.requestId, requests.map((r) => r.id))).orderBy(desc(documentVersions.version))
    : [];
  const stages = await db.select().from(progressStages).where(and(eq(progressStages.organizationId, deal.organizationId), eq(progressStages.active, true))).orderBy(asc(progressStages.position));
  const updates = await db.select({ u: progressUpdates, label: progressStages.label, by: users.name }).from(progressUpdates)
    .innerJoin(progressStages, eq(progressStages.id, progressUpdates.stageId)).innerJoin(users, eq(users.id, progressUpdates.authorId))
    .where(eq(progressUpdates.dealId, dealId)).orderBy(desc(progressUpdates.publishedAt)).limit(20);
  const notes = await db.select({ id: dealNotes.id, body: dealNotes.body, at: dealNotes.createdAt, by: users.name }).from(dealNotes).innerJoin(users, eq(users.id, dealNotes.authorId))
    .where(eq(dealNotes.dealId, dealId)).orderBy(desc(dealNotes.createdAt));
  const checklists = await db.select({ id: documentChecklists.id, name: documentChecklists.name, items: documentChecklists.items }).from(documentChecklists)
    .where(and(eq(documentChecklists.organizationId, deal.organizationId), eq(documentChecklists.active, true))).orderBy(asc(documentChecklists.name));
  const team = isAdmin(actor)
    ? await db.select({ id: users.id, name: users.name }).from(users)
      .where(and(eq(users.organizationId, deal.organizationId), isNull(users.deactivatedAt), actor.role === "office_admin" ? eq(users.officeId, actor.officeId) : undefined)).orderBy(asc(users.name))
    : null;
  const activity = await db.select({ id: auditLog.id, at: auditLog.at, action: auditLog.action, staff: users.name, client: clients.email }).from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId)).leftJoin(clients, eq(clients.id, auditLog.actorClientId))
    .where(and(eq(auditLog.entity, "deal"), eq(auditLog.entityId, dealId), like(auditLog.action, "portal_%"))).orderBy(desc(auditLog.at)).limit(30);
  const name = (contactId: string | null) => {
    const a = applicants.find((x) => x.contactId === contactId);
    return a ? `${a.first} ${a.last}` : null;
  };
  return {
    deal: { id: deal.id, number: deal.number, assigneeId: deal.assigneeId, clientStageId: deal.clientStageId },
    emailConfigured: emailConfigured(),
    canRelease: isAdmin(actor),
    applicants: applicants.map((a) => ({
      contactId: a.contactId, name: `${a.first} ${a.last}`, email: a.email, primary: a.position === 0, portalAccess: a.portalAccess,
      accountLinked: !!a.client?.accountId, lastSignInAt: a.client?.lastSignInAt ?? null,
      invitations: invites.filter((i) => i.contactId === a.contactId).map((i) => {
        const d = deliveries.find((x) => x.invitationId === i.id);
        return { id: i.id, status: i.status === "pending" && i.expiresAt < now ? "expired" : i.status, email: i.email, expiresAt: i.expiresAt, sentCount: i.sentCount, lastSentAt: i.lastSentAt, acceptedAt: i.acceptedAt, delivery: d ? { status: d.status, error: d.error } : null };
      }),
    })),
    requests: requests.map((r) => ({
      ...r, applicant: name(r.applicantContactId),
      versions: versions.filter((v) => v.v.requestId === r.id).map((v) => ({ id: v.v.id, version: v.v.version, fileId: v.f.id, fileName: v.f.fileName, size: v.f.size, scan: v.f.scanStatus, purged: !!v.f.purgedAt, at: v.v.createdAt, by: v.byUser ?? v.byClient ?? "" })),
    })),
    stages: stages.map((s) => ({ id: s.id, label: s.label })),
    updates: updates.map((u) => ({ id: u.u.id, label: u.label, message: u.u.message, at: u.u.publishedAt, by: u.by })),
    conversations: await conversationsFor(db, { userId: actor.id }, dealId, null),
    notes, checklists, team, activity,
  };
}
export type PortalWorkspace = Awaited<ReturnType<typeof portalWorkspace>>;

// Conversations with messages, attachments and read state. applicant: null = all (staff); a contact id = what that applicant may see.
export async function conversationsFor(db: Db, who: Uploader, dealId: string, applicant: string | null) {
  const convs = await db.select().from(conversations)
    .where(and(eq(conversations.dealId, dealId), applicant ? or(isNull(conversations.applicantContactId), eq(conversations.applicantContactId, applicant)) : undefined))
    .orderBy(desc(conversations.createdAt));
  if (!convs.length) return [];
  const ids = convs.map((c) => c.id);
  const msgs = await db.select({ m: messages, staff: users.name, clientContact: clients.contactId }).from(messages)
    .leftJoin(users, eq(users.id, messages.authorUserId)).leftJoin(clients, eq(clients.id, messages.authorClientId))
    .where(inArray(messages.conversationId, ids)).orderBy(asc(messages.createdAt));
  const names = await db.select({ id: contacts.id, first: contacts.firstName, last: contacts.lastName }).from(contacts)
    .where(inArray(contacts.id, [...new Set(msgs.map((m) => m.clientContact).filter((x): x is string => !!x)), "00000000-0000-0000-0000-000000000000"]));
  const atts = msgs.length
    ? await db.select({ messageId: messageAttachments.messageId, f: files }).from(messageAttachments).innerJoin(files, eq(files.id, messageAttachments.fileId)).where(inArray(messageAttachments.messageId, msgs.map((m) => m.m.id)))
    : [];
  const reads = await db.select().from(conversationReads).where(inArray(conversationReads.conversationId, ids));
  const me = readerOf(who);
  return convs.map((c) => {
    const mine = reads.find((r) => r.conversationId === c.id && r.reader === me)?.lastReadAt;
    // The other side's latest read: clients for staff, staff for clients.
    const theirs = reads.filter((r) => r.conversationId === c.id && r.reader.startsWith(who.userId ? "c:" : "u:")).map((r) => r.lastReadAt.getTime());
    const seenUntil = theirs.length ? Math.max(...theirs) : 0;
    const list = msgs.filter((m) => m.m.conversationId === c.id).map(({ m, staff, clientContact }) => {
      const fromClient = !!m.authorClientId;
      const n = names.find((x) => x.id === clientContact);
      return {
        id: m.id, body: m.purgedAt ? "" : m.body, purged: !!m.purgedAt, at: m.createdAt, fromClient,
        author: fromClient ? (n ? `${n.first} ${n.last}` : "Client") : (staff ?? "Staff"),
        mine: who.userId ? m.authorUserId === who.userId : m.authorClientId === who.clientId,
        seen: fromClient === !!who.clientId && m.createdAt.getTime() <= seenUntil,
        attachments: atts.filter((a) => a.messageId === m.id).map((a) => ({ fileId: a.f.id, fileName: a.f.fileName, size: a.f.size, scan: a.f.scanStatus, purged: !!a.f.purgedAt })),
      };
    });
    // Unread: messages from the other side newer than my last read.
    const unread = list.filter((m) => m.fromClient === !!who.userId && (!mine || m.at > mine)).length;
    return { id: c.id, subject: c.subject, applicantContactId: c.applicantContactId, createdAt: c.createdAt, unread, messages: list };
  });
}

// ---- Firm dashboard, top bar and notifications

const unreadClientMessages = (db: Db, actor: Actor) =>
  db.select({ dealId: conversations.dealId, n: count() }).from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId)).innerJoin(deals, eq(deals.id, conversations.dealId))
    .leftJoin(conversationReads, and(eq(conversationReads.conversationId, conversations.id), eq(conversationReads.reader, `u:${actor.id}`)))
    .where(and(dealScope(actor), isNotNull(messages.authorClientId), or(isNull(conversationReads.lastReadAt), gt(messages.createdAt, conversationReads.lastReadAt))))
    .groupBy(conversations.dealId);

export async function portalDashboard(db: Db, actor: Actor, now = new Date()) {
  const [inv] = await db.select({ pending: sql<number>`count(*) filter (where ${clientInvitations.expiresAt} > ${now})::int`, expired: sql<number>`count(*) filter (where ${clientInvitations.expiresAt} <= ${now})::int` })
    .from(clientInvitations).innerJoin(deals, eq(deals.id, clientInvitations.dealId)).where(and(dealScope(actor), eq(clientInvitations.status, "pending")));
  const reqs = await db.select({ dealId: documentRequests.dealId, status: documentRequests.status, n: count() }).from(documentRequests).innerJoin(deals, eq(deals.id, documentRequests.dealId))
    .where(and(dealScope(actor), isNull(documentRequests.deletedAt))).groupBy(documentRequests.dealId, documentRequests.status);
  const unread = await unreadClientMessages(db, actor);
  const failed = await db.select({ dealId: clientInvitations.dealId, n: count() }).from(emailDeliveries)
    .innerJoin(clientInvitations, eq(clientInvitations.id, emailDeliveries.invitationId)).innerJoin(deals, eq(deals.id, clientInvitations.dealId))
    .where(and(dealScope(actor), eq(clientInvitations.status, "pending"), inArray(emailDeliveries.status, ["failed", "bounced", "complained"]))).groupBy(clientInvitations.dealId);
  const quarantined = await db.select({ dealId: files.dealId, n: count() }).from(files).innerJoin(deals, eq(deals.id, files.dealId))
    .where(and(dealScope(actor), eq(files.scanStatus, "not_scanned"), isNull(files.purgedAt))).groupBy(files.dealId);
  const sum = (xs: { n: number }[]) => xs.reduce((a, x) => a + Number(x.n), 0);
  const review = reqs.filter((r) => r.status === "uploaded" || r.status === "under_review");
  // Applications needing attention: anything waiting on staff.
  const attention = new Map<string, string[]>();
  const flag = (dealId: string, why: string) => attention.set(dealId, [...(attention.get(dealId) ?? []), why]);
  for (const r of review) flag(r.dealId, `${r.n} to review`);
  for (const u of unread) flag(u.dealId, `${u.n} unread message${Number(u.n) > 1 ? "s" : ""}`);
  for (const f of failed) flag(f.dealId, "invitation email failed");
  for (const q of quarantined) flag(q.dealId, `${q.n} file${Number(q.n) > 1 ? "s" : ""} in quarantine`);
  const dealRows = attention.size
    ? await db.select({ id: deals.id, number: deals.number, first: contacts.firstName, last: contacts.lastName, assignee: users.name }).from(deals)
      .leftJoin(dealBorrowers, and(eq(dealBorrowers.dealId, deals.id), eq(dealBorrowers.position, 0))).leftJoin(contacts, eq(contacts.id, dealBorrowers.contactId))
      .leftJoin(users, eq(users.id, deals.assigneeId)).where(inArray(deals.id, [...attention.keys()]))
    : [];
  const activity = await db.select({ id: auditLog.id, at: auditLog.at, action: auditLog.action, dealId: auditLog.entityId, number: deals.number, staff: users.name, client: clients.email }).from(auditLog)
    .innerJoin(deals, eq(deals.id, auditLog.entityId)).leftJoin(users, eq(users.id, auditLog.actorId)).leftJoin(clients, eq(clients.id, auditLog.actorClientId))
    .where(and(dealScope(actor), eq(auditLog.entity, "deal"), like(auditLog.action, "portal_%"))).orderBy(desc(auditLog.at)).limit(15);
  return {
    pendingInvitations: inv.pending, expiredInvitations: inv.expired,
    unreadMessages: sum(unread),
    outstandingDocuments: sum(reqs.filter((r) => r.status === "requested" || r.status === "replacement_required")),
    awaitingReview: sum(review),
    attention: dealRows.map((d) => ({ id: d.id, code: dealCode(d.number), client: d.first ? `${d.first} ${d.last}` : "", assignee: d.assignee, reasons: attention.get(d.id)! })),
    activity: activity.map((a) => ({ ...a, code: dealCode(a.number), who: a.staff ?? a.client ?? "" })),
  };
}

// The top bar: unread client messages (newest first, no message text) and notifications.
export async function topBarPortal(db: Db, actor: Actor) {
  const unread = await unreadClientMessages(db, actor);
  const deal = unread.length ? await db.select({ id: deals.id, number: deals.number }).from(deals).where(inArray(deals.id, unread.map((u) => u.dealId))) : [];
  const items = await db.select().from(notifications).where(eq(notifications.userId, actor.id)).orderBy(desc(notifications.createdAt)).limit(10);
  const [{ n }] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, actor.id), isNull(notifications.readAt)));
  return {
    messages: unread.map((u) => ({ dealId: u.dealId, code: dealCode(deal.find((d) => d.id === u.dealId)?.number ?? 0), count: Number(u.n) })),
    notifications: items.map((i) => ({ id: i.id, title: i.title, href: i.href, at: i.createdAt, read: !!i.readAt })),
    unreadNotifications: n,
  };
}

export async function readStaffNotifications(db: Db, actor: Actor) {
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, actor.id), isNull(notifications.readAt)));
}

// ---- Downloads (the /api/files route): authorization for staff. Clients: portal-client.ts.

export async function staffFile(db: Db, actor: Actor, fileId: string) {
  const [row] = UUID.test(fileId) ? await db.select({ f: files }).from(files).innerJoin(deals, eq(deals.id, files.dealId)).where(and(eq(files.id, fileId), dealScope(actor), ne(files.scanStatus, "pending"))) : [];
  return row?.f ?? null;
}

export const downloadable = (f: { scanStatus: string; purgedAt: Date | null }) =>
  f.purgedAt ? "This file was deleted under the firm's retention policy" : f.scanStatus === "clean" || f.scanStatus === "released" ? null : "This file is in quarantine until it is scanned or released by an admin";

export async function auditDownload(db: Db, actor: Actor, f: { id: string; dealId: string }) {
  await db.transaction((tx) => portalAudit(tx, actor, f.dealId, "download", { fileId: f.id }));
}

