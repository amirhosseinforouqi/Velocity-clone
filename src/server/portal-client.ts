// Client portal, client side. A signed-in client is an account (account_id) with one clients row per firm.
// A client sees a deal only while a clients row of theirs is an applicant on it with portal_access; inside it, only shared
// items and the ones addressed to their own applicant record. Staff notes, internal statuses and other applicants' private
// items are never selected here.
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { Forbidden } from "./access.ts";
import { text } from "./admin.ts";
import { auditClient } from "./audit.ts";
import { ValidationError } from "./contacts.ts";
import type { Db, Tx } from "./db.ts";
import { dealCode } from "./deal-status.ts";
import { hashPassword } from "./password.ts";
import {
  addVersion, claimFiles, conversationsFor, finishUpload, hashToken, insertMessage, markRead, notifyStaff, startUpload, UUID, type Uploader,
} from "./portal.ts";
import {
  clientInvitations, clients, contacts, conversations, dealBorrowers, deals, documentRequests, documentVersions, files,
  messageAttachments, messages, notifications, organizations, progressStages, progressUpdates,
} from "./schema.ts";
import { checkPassword, clearFailures, locked, recordFailure } from "./users.ts";

export type ClientAccount = { accountId: string; email: string; clients: (typeof clients.$inferSelect)[] };
const MIN_PASSWORD = 10;

// ---- Invitations

async function pendingInvitation(db: Db | Tx, token: string, now: Date) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [i] = await db.select().from(clientInvitations).where(eq(clientInvitations.tokenHash, hashToken(token)));
  return i && i.status === "pending" && i.expiresAt > now ? i : null;
}

// Existing sign-in for this person: their own clients row, or (same email) another firm's.
async function existingAccount(db: Db | Tx, inv: { clientId: string | null; email: string }) {
  const [own] = inv.clientId ? await db.select().from(clients).where(and(eq(clients.id, inv.clientId), isNotNull(clients.accountId))) : [];
  if (own) return own;
  const [other] = await db.select().from(clients).where(and(eq(clients.email, inv.email), isNotNull(clients.accountId), isNull(clients.disabledAt))).limit(1);
  return other ?? null;
}

// What the accept page shows. Nothing about the deal itself until the invitation is accepted.
export async function invitationInfo(db: Db, token: string, now = new Date()) {
  const inv = await pendingInvitation(db, token, now);
  if (!inv) return null;
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, inv.organizationId));
  const [c] = await db.select({ first: contacts.firstName }).from(contacts).where(eq(contacts.id, inv.contactId));
  return { firm: org.name, firstName: c.first, email: inv.email, hasAccount: !!(await existingAccount(db, inv)), expiresAt: inv.expiresAt };
}

// New account: newPassword. Existing account (same person, this or another firm): its password, so a leaked link can't take it over.
export async function acceptInvitation(db: Db, token: string, input: { password?: string; newPassword?: string }, now = new Date()) {
  const result = await db.transaction(async (tx) => {
    const inv = await pendingInvitation(tx, token, now);
    if (!inv) throw new ValidationError("This invitation link is no longer valid. Ask your team to send a new one.");
    const existing = await existingAccount(tx, inv);
    let accountId: string, passwordHash: string;
    if (existing) {
      if (locked(`c:${inv.email}`) || !(await checkPassword(input.password ?? "", existing.passwordHash))) {
        recordFailure(`c:${inv.email}`);
        throw new ValidationError("That password isn't right");
      }
      [accountId, passwordHash] = [existing.accountId!, existing.passwordHash!];
    } else {
      const pw = input.newPassword ?? "";
      if (pw.length < MIN_PASSWORD || pw.length > 200) throw new ValidationError(`Choose a password of at least ${MIN_PASSWORD} characters`);
      [accountId, passwordHash] = [randomUUID(), await hashPassword(pw)];
    }
    const [client] = await tx.update(clients).set({ accountId, passwordHash, email: inv.email, disabledAt: null, lastSignInAt: now }).where(eq(clients.contactId, inv.contactId)).returning();
    await tx.update(dealBorrowers).set({ portalAccess: true }).where(and(eq(dealBorrowers.dealId, inv.dealId), eq(dealBorrowers.contactId, inv.contactId)));
    await tx.update(clientInvitations).set({ status: "accepted", acceptedAt: now }).where(eq(clientInvitations.id, inv.id));
    await auditClient(tx, client, "deal", inv.dealId, "portal_invite_accept", { invitationId: inv.id, linked: !!existing });
    const [deal] = await tx.select().from(deals).where(eq(deals.id, inv.dealId));
    return { accountId, email: inv.email, deal };
  });
  clearFailures(`c:${result.email}`);
  await notifyStaff(db, result.deal, `A client accepted their portal invitation on ${dealCode(result.deal.number)}`, "invite_accepted");
  return { accountId: result.accountId, email: result.email, dealId: result.deal.id };
}

// ---- Sign-in and session

export async function verifyClientLogin(db: Db, rawEmail: string, password: string) {
  const email = rawEmail.trim().toLowerCase();
  if (locked(`c:${email}`)) return null;
  const [c] = await db.select().from(clients).where(and(eq(clients.email, email), isNotNull(clients.accountId), isNull(clients.disabledAt))).limit(1);
  if (!c || !(await checkPassword(password, c.passwordHash))) {
    recordFailure(`c:${email}`);
    return null;
  }
  clearFailures(`c:${email}`);
  await db.update(clients).set({ lastSignInAt: new Date() }).where(eq(clients.accountId, c.accountId!));
  return { id: c.accountId!, email, name: email, kind: "client" as const };
}

// Re-loaded on every request, so disabling a client (or a retention purge) takes effect at once.
export async function getClientAccount(db: Db, accountId: string): Promise<ClientAccount | null> {
  if (!UUID.test(accountId)) return null;
  const rows = await db.select().from(clients).where(and(eq(clients.accountId, accountId), isNull(clients.disabledAt)));
  return rows.length ? { accountId, email: rows[0].email, clients: rows } : null;
}

// ---- Access: which of the account's client rows is on this deal, with access.

async function clientOnDeal(db: Db | Tx, account: ClientAccount, dealId: string) {
  const ids = account.clients.map((c) => c.contactId);
  const [row] = UUID.test(dealId)
    ? await db.select({ deal: deals, contactId: dealBorrowers.contactId }).from(dealBorrowers).innerJoin(deals, eq(deals.id, dealBorrowers.dealId))
      .where(and(eq(dealBorrowers.dealId, dealId), inArray(dealBorrowers.contactId, ids), eq(dealBorrowers.portalAccess, true), isNull(deals.deletedAt)))
    : [];
  if (!row) throw new Forbidden("Application not found");
  return { deal: row.deal, client: account.clients.find((c) => c.contactId === row.contactId)! };
}

// Shared (no applicant) or addressed to this applicant.
const mine = (col: typeof documentRequests.applicantContactId | typeof conversations.applicantContactId, contactId: string) => or(isNull(col), eq(col, contactId));

// ---- Reading

export async function clientDeals(db: Db, account: ClientAccount) {
  const ids = account.clients.map((c) => c.contactId);
  const rows = await db.select({ deal: deals, contactId: dealBorrowers.contactId, firm: organizations.name, stage: progressStages.label }).from(dealBorrowers)
    .innerJoin(deals, eq(deals.id, dealBorrowers.dealId)).innerJoin(organizations, eq(organizations.id, deals.organizationId))
    .leftJoin(progressStages, eq(progressStages.id, deals.clientStageId))
    .where(and(inArray(dealBorrowers.contactId, ids), eq(dealBorrowers.portalAccess, true), isNull(deals.deletedAt))).orderBy(desc(deals.createdAt));
  return Promise.all(rows.map(async (r) => {
    const client = account.clients.find((c) => c.contactId === r.contactId)!;
    const [{ n }] = await db.select({ n: count() }).from(documentRequests)
      .where(and(eq(documentRequests.dealId, r.deal.id), isNull(documentRequests.deletedAt), inArray(documentRequests.status, ["requested", "replacement_required"]), mine(documentRequests.applicantContactId, r.contactId)));
    const convs = await conversationsFor(db, { clientId: client.id }, r.deal.id, r.contactId);
    return { id: r.deal.id, code: dealCode(r.deal.number), firm: r.firm, purpose: r.deal.purpose, stage: r.stage, outstanding: n, unread: convs.reduce((a, c) => a + c.unread, 0) };
  }));
}

export async function clientDeal(db: Db, account: ClientAccount, dealId: string) {
  const { deal, client } = await clientOnDeal(db, account, dealId);
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, deal.organizationId));
  const stages = await db.select().from(progressStages).where(and(eq(progressStages.organizationId, deal.organizationId), eq(progressStages.active, true))).orderBy(asc(progressStages.position));
  const current = stages.findIndex((s) => s.id === deal.clientStageId);
  const updates = await db.select({ id: progressUpdates.id, label: progressStages.label, message: progressUpdates.message, at: progressUpdates.publishedAt }).from(progressUpdates)
    .innerJoin(progressStages, eq(progressStages.id, progressUpdates.stageId)).where(eq(progressUpdates.dealId, dealId)).orderBy(desc(progressUpdates.publishedAt)).limit(10);
  const requests = await db.select().from(documentRequests)
    .where(and(eq(documentRequests.dealId, dealId), isNull(documentRequests.deletedAt), mine(documentRequests.applicantContactId, client.contactId)))
    .orderBy(asc(documentRequests.category), asc(documentRequests.createdAt));
  const versions = requests.length
    ? await db.select({ v: documentVersions, f: files }).from(documentVersions).innerJoin(files, eq(files.id, documentVersions.fileId))
      .where(inArray(documentVersions.requestId, requests.map((r) => r.id))).orderBy(desc(documentVersions.version))
    : [];
  const outstanding = requests.filter((r) => r.status === "requested" || r.status === "replacement_required").length;
  const stage = current >= 0 ? stages[current] : null;
  return {
    clientId: client.id, contactId: client.contactId, firm: org.name, code: dealCode(deal.number), purpose: deal.purpose,
    stages: stages.map((s, i) => ({ id: s.id, label: s.label, state: current < 0 ? "upcoming" : i < current ? "done" : i === current ? "current" : "upcoming" })),
    stage: stage && { label: stage.label, description: stage.clientDescription, nextAction: stage.nextAction },
    // The next action: outstanding documents first, then whatever the stage says.
    nextAction: outstanding ? `Upload ${outstanding} requested document${outstanding > 1 ? "s" : ""}.` : (stage?.nextAction || "Nothing to do right now. Your team will be in touch."),
    updates,
    requests: requests.map((r) => ({
      id: r.id, name: r.name, category: r.category, description: r.description, status: r.status, replacementReason: r.replacementReason, dueDate: r.dueDate,
      shared: !r.applicantContactId,
      canUpload: r.status === "requested" || r.status === "uploaded" || r.status === "replacement_required",
      versions: versions.filter((v) => v.v.requestId === r.id).map((v) => ({ version: v.v.version, fileId: v.f.id, fileName: v.f.fileName, size: v.f.size, scan: v.f.scanStatus, at: v.v.createdAt, purged: !!v.f.purgedAt })),
    })),
    conversations: await conversationsFor(db, { clientId: client.id }, dealId, client.contactId),
  };
}
export type ClientDealView = Awaited<ReturnType<typeof clientDeal>>;

// ---- Uploads, versions, messages

export async function clientStartUpload(db: Db, account: ClientAccount, dealId: string, input: { fileName?: unknown; size?: unknown; contentType?: unknown }) {
  const { deal, client } = await clientOnDeal(db, account, dealId);
  return startUpload(db, { clientId: client.id }, deal, input);
}

export async function clientFinishUpload(db: Db, account: ClientAccount, fileId: string) {
  const [f] = UUID.test(fileId) ? await db.select({ by: files.uploadedByClientId, dealId: files.dealId }).from(files).where(eq(files.id, fileId)) : [];
  const client = account.clients.find((c) => c.id === f?.by);
  if (!f || !client) throw new Forbidden("Upload not found");
  await clientOnDeal(db, account, f.dealId); // access may have been revoked mid-upload
  const done = await finishUpload(db, { clientId: client.id }, fileId);
  return { fileId: done.id, fileName: done.fileName, scan: done.scanStatus };
}

export async function clientAddVersion(db: Db, account: ClientAccount, requestId: string, fileId: string) {
  const [r] = UUID.test(requestId) ? await db.select().from(documentRequests).where(and(eq(documentRequests.id, requestId), isNull(documentRequests.deletedAt))) : [];
  if (!r) throw new Forbidden("Request not found");
  const { deal, client } = await clientOnDeal(db, account, r.dealId);
  if (r.applicantContactId && r.applicantContactId !== client.contactId) throw new Forbidden("Request not found");
  if (!["requested", "uploaded", "replacement_required"].includes(r.status)) throw new ValidationError("This document is already being reviewed");
  const who: Uploader = { clientId: client.id };
  await db.transaction(async (tx) => {
    await claimFiles(tx, who, deal.id, [fileId]);
    const version = await addVersion(tx, r.id, fileId);
    await auditClient(tx, client, "deal", deal.id, "portal_upload", { requestId, version });
  });
  await notifyStaff(db, deal, `A client uploaded a document on ${dealCode(deal.number)}`, "client_upload");
}

async function clientConversation(db: Db, account: ClientAccount, conversationId: string) {
  const [c] = UUID.test(conversationId) ? await db.select().from(conversations).where(eq(conversations.id, conversationId)) : [];
  if (!c) throw new Forbidden("Conversation not found");
  const { deal, client } = await clientOnDeal(db, account, c.dealId);
  if (c.applicantContactId && c.applicantContactId !== client.contactId) throw new Forbidden("Conversation not found");
  return { c, deal, client };
}

// A conversation a client starts is between them and the team, not shared with co-applicants.
export async function clientStartConversation(db: Db, account: ClientAccount, dealId: string, input: Record<string, unknown>) {
  const { deal, client } = await clientOnDeal(db, account, dealId);
  const subject = text(input.subject, "Subject", 120);
  const c = await db.transaction(async (tx) => {
    const [c] = await tx.insert(conversations).values({ dealId, applicantContactId: client.contactId, subject }).returning();
    const m = await insertMessage(tx, c.id, { clientId: client.id }, dealId, input.body, input.fileIds);
    await auditClient(tx, client, "deal", dealId, "portal_message", { conversationId: c.id, messageId: m.id });
    return c;
  });
  await notifyStaff(db, deal, `New client message on ${dealCode(deal.number)}`, "client_message");
  return c;
}

export async function clientReply(db: Db, account: ClientAccount, conversationId: string, body: unknown, fileIds: unknown) {
  const { c, deal, client } = await clientConversation(db, account, conversationId);
  await db.transaction(async (tx) => {
    const m = await insertMessage(tx, c.id, { clientId: client.id }, deal.id, body, fileIds);
    await auditClient(tx, client, "deal", deal.id, "portal_message", { conversationId, messageId: m.id });
  });
  await notifyStaff(db, deal, `New client message on ${dealCode(deal.number)}`, "client_message");
}

export async function clientMarkRead(db: Db, account: ClientAccount, conversationId: string) {
  const { c, client } = await clientConversation(db, account, conversationId);
  await markRead(db, c.id, { clientId: client.id });
}

// ---- Downloads: a file the client can reach through a visible request or conversation.

export async function clientFile(db: Db, account: ClientAccount, fileId: string) {
  const [f] = UUID.test(fileId) ? await db.select().from(files).where(and(eq(files.id, fileId), ne(files.scanStatus, "pending"))) : [];
  if (!f) return null;
  let client;
  try {
    ({ client } = await clientOnDeal(db, account, f.dealId));
  } catch {
    return null;
  }
  const [viaRequest] = await db.select({ id: documentVersions.id }).from(documentVersions).innerJoin(documentRequests, eq(documentRequests.id, documentVersions.requestId))
    .where(and(eq(documentVersions.fileId, fileId), isNull(documentRequests.deletedAt), mine(documentRequests.applicantContactId, client.contactId)));
  const [viaMessage] = viaRequest ? [] : await db.select({ id: messageAttachments.messageId }).from(messageAttachments)
    .innerJoin(messages, eq(messages.id, messageAttachments.messageId)).innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(eq(messageAttachments.fileId, fileId), mine(conversations.applicantContactId, client.contactId)));
  return viaRequest || viaMessage ? { file: f, client } : null;
}

export async function auditClientDownload(db: Db, client: typeof clients.$inferSelect, f: { id: string; dealId: string }) {
  await db.transaction((tx) => auditClient(tx, client, "deal", f.dealId, "portal_download", { fileId: f.id }));
}

// ---- Notifications

export async function clientNotifications(db: Db, account: ClientAccount) {
  const ids = account.clients.map((c) => c.id);
  const items = await db.select().from(notifications).where(inArray(notifications.clientId, ids)).orderBy(desc(notifications.createdAt)).limit(20);
  return items.map((i) => ({ id: i.id, title: i.title, href: i.href, at: i.createdAt, read: !!i.readAt }));
}

export async function readClientNotifications(db: Db, account: ClientAccount) {
  await db.update(notifications).set({ readAt: new Date() }).where(and(inArray(notifications.clientId, account.clients.map((c) => c.id)), isNull(notifications.readAt)));
}

// Unread messages across the account, for the portal header.
export async function clientUnread(db: Db, account: ClientAccount) {
  let n = 0;
  for (const d of await clientDeals(db, account)) n += d.unread;
  const [{ c }] = await db.select({ c: count() }).from(notifications).where(and(inArray(notifications.clientId, account.clients.map((x) => x.id)), isNull(notifications.readAt)));
  return { messages: n, notifications: c };
}

// ---- Profile: contact details the client may change, per firm. The email is the sign-in and is changed by the firm.

export async function clientProfile(db: Db, account: ClientAccount) {
  const rows = await db.select({ client: clients, c: contacts, firm: organizations.name }).from(clients)
    .innerJoin(contacts, eq(contacts.id, clients.contactId)).innerJoin(organizations, eq(organizations.id, clients.organizationId))
    .where(inArray(clients.id, account.clients.map((c) => c.id)));
  return rows.map((r) => ({
    clientId: r.client.id, firm: r.firm, name: `${r.c.firstName} ${r.c.lastName}`, email: r.client.email,
    cellPhone: r.c.cellPhone ?? "", homePhone: r.c.homePhone ?? "", workPhone: r.c.workPhone ?? "", address: r.c.address ?? "", emailNotifications: r.client.emailNotifications,
  }));
}

const PHONE = /^[0-9 +().-]{0,30}$/;
export async function saveClientProfile(db: Db, account: ClientAccount, clientId: string, input: Record<string, unknown>) {
  const client = account.clients.find((c) => c.id === clientId);
  if (!client) throw new Forbidden("Profile not found");
  const phones = Object.fromEntries((["cellPhone", "homePhone", "workPhone"] as const).map((k) => {
    const v = text(input[k], "Phone", 30, false);
    if (!PHONE.test(v)) throw new ValidationError("Phone numbers can only contain digits, spaces and + ( ) - .");
    return [k, v || null];
  }));
  const address = text(input.address, "Address", 300, false) || null;
  const emailNotifications = input.emailNotifications === true || input.emailNotifications === "on";
  await db.transaction(async (tx) => {
    await tx.update(contacts).set({ ...phones, address, updatedAt: new Date() }).where(eq(contacts.id, client.contactId));
    await tx.update(clients).set({ emailNotifications }).where(eq(clients.id, client.id));
    await auditClient(tx, client, "contact", client.contactId, "portal_profile", { fields: [...Object.keys(phones), "address", "emailNotifications"] });
  });
}
