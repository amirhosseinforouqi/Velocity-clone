// The client portal end to end, plus isolation, RLS, MFA, webhooks and retention, against an in-memory Postgres: `npm test`.
// Synthetic people only. The browser's PUT to storage is stood in for by putFile (the same call the upload route makes).
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { Forbidden, type Actor } from "./access.ts";
import { saveUser } from "./admin.ts";
import { createContact, ValidationError } from "./contacts.ts";
import { createDeal } from "./deals.ts";
import { openDb, type Db } from "./db.ts";
import { applyWebhookEvent, verifyWebhook } from "./email.ts";
import { base32, totp } from "./mfa.ts";
import {
  addNote, finishUpload, inviteApplicant, portalDashboard, portalWorkspace, requestDocuments, reviewRequest, setStage, staffFile, staffReply, startConversation, startUpload,
  topBarPortal,
} from "./portal.ts";
import { runRetention } from "./portal-admin.ts";
import {
  acceptInvitation, clientAddVersion, clientDeal, clientDeals, clientFile, clientFinishUpload, clientMarkRead, clientNotifications, clientReply, clientStartConversation,
  clientStartUpload, getClientAccount, invitationInfo, verifyClientLogin, type ClientAccount,
} from "./portal-client.ts";
import { dealBorrowers, deals, emailDeliveries, files, organizations, users } from "./schema.ts";
import { seedIfEmpty } from "./seed.ts";
import { putFile } from "./storage.ts";
import { enableMfa, startMfa, verifyLogin } from "./users.ts";

let db: Db;
let uploads: string;
const as: Record<string, Actor> = {};
const pdf = new TextEncoder().encode("%PDF-1.4\n% synthetic test file\n%%EOF\n");
const PW = "client-test-password";

before(async () => {
  uploads = await mkdtemp(path.join(tmpdir(), "keyway-portal-"));
  process.env.UPLOAD_DIR = uploads;
  process.env.AUTH_SECRET ??= "test-secret";
  delete process.env.RESEND_API_KEY;
  delete process.env.MALWARE_SCAN_URL;
  db = await openDb();
  await seedIfEmpty(db);
  for (const u of await db.select().from(users)) as[u.email.split("@")[0]] = u;
});
after(() => rm(uploads, { recursive: true, force: true }));

const token = (link: string | null) => new URL(link!).searchParams.get("token")!;

// A deal with two applicants who each have an email address.
async function application(tag: string) {
  const a = await createContact(db, as.agent, { firstName: "Test", lastName: `Primary ${tag}`, email: `primary.${tag}@example.test` });
  const b = await createContact(db, as.agent, { firstName: "Test", lastName: `Co ${tag}`, email: `co.${tag}@example.test` });
  const deal = await createDeal(db, as.agent, a.id, { status: "new_deal" });
  await db.insert(dealBorrowers).values({ dealId: deal.id, contactId: b.id, position: 1 });
  return { deal, a, b };
}

async function invited(dealId: string, contactId: string, password = PW) {
  const inv = await inviteApplicant(db, as.agent, dealId, contactId);
  const done = await acceptInvitation(db, token(inv.link), { newPassword: password });
  return (await getClientAccount(db, done.accountId))!;
}

// Client upload: start (signed URL), the bytes arrive, finish (checks + scan).
async function clientUpload(account: ClientAccount, dealId: string, name = "statement.pdf") {
  const s = await clientStartUpload(db, account, dealId, { fileName: name, size: pdf.length, contentType: "application/pdf" });
  await putFile(s.fileId, pdf);
  return clientFinishUpload(db, account, s.fileId);
}

test("the full workflow: invite, accept, request, upload, replace, message, stage", async () => {
  const { deal, a } = await application("flow");

  // 1. Staff invites. No email provider in tests, so it says so and hands back the link instead of pretending.
  const inv = await inviteApplicant(db, as.agent, deal.id, a.id);
  assert.equal(inv.status, "not_configured");
  assert.match(inv.link!, /\/portal\/accept\?token=/);
  const [delivery] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.invitationId, inv.invitationId));
  assert.equal(delivery.status, "not_configured");
  assert.equal((await portalDashboard(db, as.agent)).pendingInvitations >= 1, true);

  // 2. The client accepts and signs in. The link works once.
  const info = await invitationInfo(db, token(inv.link));
  assert.equal(info?.hasAccount, false);
  await assert.rejects(acceptInvitation(db, token(inv.link), { newPassword: "short" }), /at least 10/);
  const done = await acceptInvitation(db, token(inv.link), { newPassword: PW });
  assert.equal(done.dealId, deal.id);
  await assert.rejects(acceptInvitation(db, token(inv.link), { newPassword: PW }), /no longer valid/);
  assert.equal(await verifyClientLogin(db, `primary.flow@example.test`, "wrong-password"), null);
  const login = await verifyClientLogin(db, " PRIMARY.flow@example.test ", PW);
  assert.equal(login?.kind, "client");
  const account = (await getClientAccount(db, login!.id))!;
  assert.deepEqual((await clientDeals(db, account)).map((d) => d.id), [deal.id]);

  // 3. Staff requests documents (one, and a checklist); the client uploads one.
  const w = await portalWorkspace(db, as.agent, deal.id);
  const [req] = await requestDocuments(db, as.agent, deal.id, { name: "Bank statement", category: "Income" });
  await requestDocuments(db, as.agent, deal.id, { checklistId: w.checklists[0].id });
  let view = await clientDeal(db, account, deal.id);
  assert.ok(view.requests.length > 1);
  assert.match(view.nextAction, /^Upload \d+ requested documents/);
  const f1 = await clientUpload(account, deal.id);
  assert.equal(f1.scan, "not_scanned"); // no scanner configured: quarantined, not passed off as scanned
  await clientAddVersion(db, account, req.id, f1.fileId);
  view = await clientDeal(db, account, deal.id);
  assert.equal(view.requests.find((r) => r.id === req.id)?.status, "uploaded");

  // 4. Staff asks for a replacement (a reason is required); the client uploads version 2.
  await assert.rejects(reviewRequest(db, as.agent, req.id, "replacement_required", " "), ValidationError);
  await reviewRequest(db, as.agent, req.id, "replacement_required", "The last page is missing");
  view = await clientDeal(db, account, deal.id);
  const r = view.requests.find((x) => x.id === req.id)!;
  assert.equal(r.status, "replacement_required");
  assert.equal(r.replacementReason, "The last page is missing");
  const f2 = await clientUpload(account, deal.id, "statement-full.pdf");
  await clientAddVersion(db, account, req.id, f2.fileId);
  view = await clientDeal(db, account, deal.id);
  assert.deepEqual(view.requests.find((x) => x.id === req.id)!.versions.map((v) => v.version), [2, 1]);
  await reviewRequest(db, as.agent, req.id, "accepted");
  assert.equal((await clientDeal(db, account, deal.id)).requests.find((x) => x.id === req.id)!.status, "accepted");
  await assert.rejects(clientAddVersion(db, account, req.id, f2.fileId), /already being reviewed/);

  // 5. Messages both ways, with unread counts and read receipts.
  const c = await startConversation(db, as.agent, deal.id, { subject: "Welcome", body: "Hello from the team", applicantContactId: "" });
  assert.equal((await clientDeal(db, account, deal.id)).conversations[0].unread, 1);
  await clientMarkRead(db, account, c.id);
  assert.equal((await clientDeal(db, account, deal.id)).conversations[0].unread, 0);
  await clientReply(db, account, c.id, "Thanks, uploading now", []);
  assert.equal((await topBarPortal(db, as.agent)).messages.find((m) => m.dealId === deal.id)?.count, 1);
  await staffReply(db, as.agent, c.id, "Got it", []);
  const thread = (await portalWorkspace(db, as.agent, deal.id)).conversations.find((x) => x.id === c.id)!;
  assert.deepEqual(thread.messages.map((m) => m.body), ["Hello from the team", "Thanks, uploading now", "Got it"]);
  assert.equal(thread.messages[0].seen, true); // the client read it
  const own = await clientStartConversation(db, account, deal.id, { subject: "Question", body: "When do we close?", fileIds: [] });
  assert.ok((await portalWorkspace(db, as.agent, deal.id)).conversations.some((x) => x.id === own.id));

  // 6. Staff moves the stage; the client sees done / current / upcoming and a notification.
  const stages = (await portalWorkspace(db, as.agent, deal.id)).stages;
  await setStage(db, as.agent, deal.id, stages[3].id, "Sent to the lender today");
  view = await clientDeal(db, account, deal.id);
  assert.deepEqual(view.stages.map((s) => s.state), stages.map((_, i) => (i < 3 ? "done" : i === 3 ? "current" : "upcoming")));
  assert.equal(view.stage?.label, stages[3].label);
  assert.equal(view.updates[0].message, "Sent to the lender today");
  assert.ok((await clientNotifications(db, account)).some((n) => n.title.includes(stages[3].label)));

  // Downloads: the client reaches their files; staff see the quarantine.
  assert.ok(await clientFile(db, account, f2.fileId));
  assert.ok(await staffFile(db, as.agent, f2.fileId));
});

test("isolation: co-applicants, other clients, staff notes and other firms", async () => {
  const { deal, a, b } = await application("iso");
  const primary = await invited(deal.id, a.id);
  const co = await invited(deal.id, b.id);

  // A request private to the co-applicant, and a shared one.
  const [priv] = await requestDocuments(db, as.agent, deal.id, { name: "Co pay stub", category: "Income", applicantContactId: b.id });
  const [shared] = await requestDocuments(db, as.agent, deal.id, { name: "Purchase agreement", category: "Property" });
  const f = await clientUpload(co, deal.id);
  await clientAddVersion(db, co, priv.id, f.fileId);
  const privateChat = await startConversation(db, as.agent, deal.id, { subject: "Just for you", body: "Private", applicantContactId: b.id });

  const seen = await clientDeal(db, primary, deal.id);
  assert.deepEqual(seen.requests.map((r) => r.id), [shared.id]);
  assert.ok(!seen.conversations.some((c) => c.id === privateChat.id));
  assert.equal(await clientFile(db, primary, f.fileId), null);
  await assert.rejects(clientAddVersion(db, primary, priv.id, f.fileId), Forbidden);
  await assert.rejects(clientReply(db, primary, privateChat.id, "hi", []), Forbidden);
  assert.ok((await clientDeal(db, co, deal.id)).requests.some((r) => r.id === priv.id));

  // A file can't be attached by someone who didn't upload it.
  await assert.rejects(clientAddVersion(db, primary, shared.id, f.fileId), ValidationError);

  // Staff notes never reach a client.
  await addNote(db, as.agent, deal.id, "Internal: lender prefers the second appraisal");
  assert.ok(!JSON.stringify(await clientDeal(db, co, deal.id)).includes("second appraisal"));

  // Another client's application is not found.
  const other = await application("other");
  const stranger = await invited(other.deal.id, other.a.id);
  await assert.rejects(clientDeal(db, stranger, deal.id), Forbidden);
  await assert.rejects(clientStartUpload(db, stranger, deal.id, { fileName: "x.pdf", size: 10, contentType: "application/pdf" }), Forbidden);
  assert.equal(await clientFile(db, stranger, f.fileId), null);

  // Turning access off closes the deal at once.
  await db.update(dealBorrowers).set({ portalAccess: false }).where(eq(dealBorrowers.contactId, a.id));
  await assert.rejects(clientDeal(db, primary, deal.id), Forbidden);

  // Another firm's staff can't see or act on it, even as an org admin.
  const [org] = await db.insert(organizations).values({ name: "Other Firm" }).returning();
  const outsider: Actor = { ...as.admin, organizationId: org.id };
  await assert.rejects(portalWorkspace(db, outsider, deal.id), Forbidden);
  await assert.rejects(inviteApplicant(db, outsider, deal.id, a.id), Forbidden);
  assert.equal(await staffFile(db, outsider, f.fileId), null);
});

test("uploads are checked by their bytes, not their name", async () => {
  const { deal } = await application("bytes");
  await assert.rejects(startUpload(db, { userId: as.agent.id }, deal, { fileName: "a.exe", size: 10, contentType: "application/x-msdownload" }), /Only PDF/);
  await assert.rejects(startUpload(db, { userId: as.agent.id }, deal, { fileName: "big.pdf", size: 11 * 1024 * 1024, contentType: "application/pdf" }), /10 MB/);
  const s = await startUpload(db, { userId: as.agent.id }, deal, { fileName: "../../evil\".pdf", size: 5, contentType: "application/pdf" });
  const [row] = await db.select().from(files).where(eq(files.id, s.fileId));
  assert.ok(!row.fileName.includes("/") && !row.fileName.includes('"'));
  await putFile(s.fileId, new TextEncoder().encode("MZ not really a pdf"));
  await assert.rejects(finishUpload(db, { userId: as.agent.id }, s.fileId), /Only PDF/);
  assert.equal((await db.select().from(files).where(eq(files.id, s.fileId))).length, 0); // rejected files are deleted
});

test("every table has row-level security on", async () => {
  const { rows } = await db.execute<{ relname: string }>(sql`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  assert.deepEqual(rows.map((r) => r.relname), []);
});

test("TOTP matches RFC 6238, and staff with MFA need a code to sign in", async () => {
  const rfc = base32(Buffer.from("12345678901234567890"));
  assert.equal(totp(rfc, 59_000), "287082");
  assert.equal(totp(rfc, 1_111_111_109_000), "081804");

  const pw = "a-long-test-password";
  await saveUser(db, as.admin, null, { name: "Test Mfa", email: "mfa@keyway.test", officeId: as.agent.officeId, role: "agent", password: pw });
  const [u] = await db.select().from(users).where(eq(users.email, "mfa@keyway.test"));
  const setup = startMfa(u);
  const wrong = String((Number(totp(setup.secret)) + 500_000) % 1_000_000).padStart(6, "0");
  await assert.rejects(enableMfa(db, u, setup.sealed, wrong), ValidationError);
  await enableMfa(db, u, setup.sealed, totp(setup.secret));
  assert.equal(await verifyLogin(db, u.email, pw), "mfa");
  assert.equal(await verifyLogin(db, u.email, pw, wrong), null);
  const ok = await verifyLogin(db, u.email, pw, totp(setup.secret));
  assert.equal(typeof ok === "object" && ok?.id, u.id);
});

test("Resend webhooks need a valid signature and update the delivery", async () => {
  const secret = `whsec_${Buffer.from("synthetic-webhook-secret").toString("base64")}`;
  const body = JSON.stringify({ type: "email.bounced", data: { email_id: "synthetic-email-id" } });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", Buffer.from("synthetic-webhook-secret")).update(`msg_1.${ts}.${body}`).digest("base64");
  const headers = (s: string, t = ts) => new Headers({ "svix-id": "msg_1", "svix-timestamp": t, "svix-signature": `v1,${s}` });
  assert.equal(verifyWebhook(secret, headers(sig), body), true);
  assert.equal(verifyWebhook(secret, headers(sig), body.replace("bounced", "delivered")), false);
  assert.equal(verifyWebhook(secret, headers(sig, String(Number(ts) - 3600)), body), false);

  const { deal, a } = await application("hook");
  const inv = await inviteApplicant(db, as.agent, deal.id, a.id);
  await db.update(emailDeliveries).set({ providerId: "synthetic-email-id", status: "sent" }).where(eq(emailDeliveries.invitationId, inv.invitationId));
  assert.equal(await applyWebhookEvent(db, JSON.parse(body)), true);
  const [d] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.invitationId, inv.invitationId));
  assert.equal(d.status, "bounced");
});

test("retention purges closed deals' files and messages and closes portal access", async () => {
  const { deal, a } = await application("retain");
  const account = await invited(deal.id, a.id);
  const [req] = await requestDocuments(db, as.agent, deal.id, { name: "ID", category: "Identity" });
  const f = await clientUpload(account, deal.id);
  await clientAddVersion(db, account, req.id, f.fileId);
  await clientStartConversation(db, account, deal.id, { subject: "Bye", body: "Synthetic message", fileIds: [] });

  const now = new Date();
  await db.update(organizations).set({ retentionDays: 30 }).where(eq(organizations.id, deal.organizationId));
  await db.update(deals).set({ status: "funded", updatedAt: new Date(now.getTime() - 40 * 86_400_000) }).where(eq(deals.id, deal.id));
  const r = await runRetention(db, now);
  assert.ok(r.purgedFiles >= 1);
  const [row] = await db.select().from(files).where(eq(files.id, f.fileId));
  assert.ok(row.purgedAt);
  await assert.rejects(clientDeal(db, account, deal.id), Forbidden);
  const conv = (await portalWorkspace(db, as.agent, deal.id)).conversations[0];
  assert.equal(conv.messages[0].purged, true);
  assert.equal(conv.messages[0].body, "");
  await db.update(organizations).set({ retentionDays: null }).where(eq(organizations.id, deal.organizationId));
});
