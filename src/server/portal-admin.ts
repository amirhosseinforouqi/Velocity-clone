// Client portal administration: email templates, document checklists, progress stages, portal settings, retention.
// Organization admins only. Every change is audited in the same transaction.
import { and, asc, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { Forbidden, type Actor } from "./access.ts";
import { mustOrgAdmin, text } from "./admin.ts";
import { audit } from "./audit.ts";
import { ValidationError } from "./contacts.ts";
import type { Db } from "./db.ts";
import { getTemplate, templateKinds, type TemplateKind } from "./email.ts";
import { ensurePortalDefaults, staffDeal, UUID } from "./portal.ts";
import {
  auditLog, conversations, dealBorrowers, deals, documentChecklists, emailTemplates, files, messages, organizations, progressStages, type ChecklistItem,
} from "./schema.ts";
import { removeFile } from "./storage.ts";

// ---- Settings

export async function portalSettings(db: Db, actor: Actor) {
  mustOrgAdmin(actor);
  const [o] = await db.select({ inviteExpiryDays: organizations.inviteExpiryDays, retentionDays: organizations.retentionDays, requireStaffMfa: organizations.requireStaffMfa })
    .from(organizations).where(eq(organizations.id, actor.organizationId));
  return o;
}

export async function savePortalSettings(db: Db, actor: Actor, input: { inviteExpiryDays: unknown; retentionDays: unknown; requireStaffMfa: unknown }) {
  const before = await portalSettings(db, actor);
  const expiry = Number(input.inviteExpiryDays);
  if (!Number.isInteger(expiry) || expiry < 1 || expiry > 30) throw new ValidationError("Invitations must expire after 1 to 30 days");
  const r = input.retentionDays === "" || input.retentionDays == null ? null : Number(input.retentionDays);
  if (r !== null && (!Number.isInteger(r) || r < 30 || r > 3650)) throw new ValidationError("Retention must be 30 to 3650 days, or blank to keep everything");
  const after = { inviteExpiryDays: expiry, retentionDays: r, requireStaffMfa: input.requireStaffMfa === true };
  await db.transaction(async (tx) => {
    await tx.update(organizations).set(after).where(eq(organizations.id, actor.organizationId));
    await audit(tx, actor, "organization", actor.organizationId, "portal_settings", before, after);
  });
}

// ---- Email templates

export async function listTemplates(db: Db, actor: Actor) {
  mustOrgAdmin(actor);
  return Promise.all((Object.keys(templateKinds) as TemplateKind[]).map(async (kind) => ({ kind, label: templateKinds[kind].label, vars: templateKinds[kind].vars, ...(await getTemplate(db, actor.organizationId, kind)) })));
}

// The {{link}} must stay in, or the email is useless.
export async function saveTemplate(db: Db, actor: Actor, kind: string, input: { subject: unknown; body: unknown }) {
  mustOrgAdmin(actor);
  if (!(kind in templateKinds)) throw new ValidationError("Unknown template");
  const subject = text(input.subject, "Subject", 200), body = text(input.body, "Body", 5000);
  if (!body.includes("{{link}}")) throw new ValidationError("The body must include {{link}}");
  await db.transaction(async (tx) => {
    await tx.insert(emailTemplates).values({ organizationId: actor.organizationId, kind, subject, body, updatedBy: actor.id })
      .onConflictDoUpdate({ target: [emailTemplates.organizationId, emailTemplates.kind], set: { subject, body, updatedBy: actor.id, updatedAt: new Date() } });
    await audit(tx, actor, "email_template", actor.organizationId, "update", null, { kind });
  });
}

export async function resetTemplate(db: Db, actor: Actor, kind: string) {
  mustOrgAdmin(actor);
  await db.transaction(async (tx) => {
    await tx.delete(emailTemplates).where(and(eq(emailTemplates.organizationId, actor.organizationId), eq(emailTemplates.kind, kind)));
    await audit(tx, actor, "email_template", actor.organizationId, "reset", null, { kind });
  });
}

// ---- Document checklists

export async function listChecklists(db: Db, actor: Actor) {
  mustOrgAdmin(actor);
  await ensurePortalDefaults(db, actor.organizationId);
  return db.select().from(documentChecklists).where(eq(documentChecklists.organizationId, actor.organizationId)).orderBy(asc(documentChecklists.name));
}

export async function saveChecklist(db: Db, actor: Actor, id: string | null, input: { name: unknown; items: unknown; active: unknown }) {
  mustOrgAdmin(actor);
  const items: ChecklistItem[] = (Array.isArray(input.items) ? input.items : []).map((i: Record<string, unknown>) => ({
    name: text(i?.name, "Document name", 120), category: text(i?.category, "Category", 60, false) || "General", description: text(i?.description, "Description", 1000, false),
  }));
  if (!items.length || items.length > 50) throw new ValidationError("A checklist needs 1 to 50 documents");
  const values = { name: text(input.name, "Name", 100), items, active: input.active !== false };
  return db.transaction(async (tx) => {
    if (!id) {
      const [c] = await tx.insert(documentChecklists).values({ ...values, organizationId: actor.organizationId }).onConflictDoNothing().returning({ id: documentChecklists.id });
      if (!c) throw new ValidationError("A checklist with that name already exists");
      await audit(tx, actor, "document_checklist", c.id, "create", null, values);
      return c.id;
    }
    const [before] = UUID.test(id) ? await tx.select().from(documentChecklists).where(and(eq(documentChecklists.id, id), eq(documentChecklists.organizationId, actor.organizationId))) : [];
    if (!before) throw new Forbidden("Checklist not found");
    await tx.update(documentChecklists).set(values).where(eq(documentChecklists.id, id));
    await audit(tx, actor, "document_checklist", id, "update", { name: before.name, items: before.items, active: before.active }, values);
    return id;
  });
}

// ---- Progress stages. Hidden (inactive) stages stay on deals already at them; they just can't be chosen.

export async function listStages(db: Db, actor: Actor) {
  mustOrgAdmin(actor);
  await ensurePortalDefaults(db, actor.organizationId);
  return db.select().from(progressStages).where(eq(progressStages.organizationId, actor.organizationId)).orderBy(asc(progressStages.position));
}

export async function saveStage(db: Db, actor: Actor, id: string | null, input: Record<string, unknown>) {
  mustOrgAdmin(actor);
  const position = Number(input.position);
  if (!Number.isInteger(position) || position < 0 || position > 99) throw new ValidationError("Order must be 0 to 99");
  const values = {
    label: text(input.label, "Stage", 60), clientDescription: text(input.clientDescription, "Client description", 500, false),
    nextAction: text(input.nextAction, "Next action", 300, false), position, active: input.active !== false,
  };
  return db.transaction(async (tx) => {
    if (!id) {
      const [s] = await tx.insert(progressStages).values({ ...values, organizationId: actor.organizationId }).returning({ id: progressStages.id });
      await audit(tx, actor, "progress_stage", s.id, "create", null, values);
      return s.id;
    }
    const [before] = UUID.test(id) ? await tx.select().from(progressStages).where(and(eq(progressStages.id, id), eq(progressStages.organizationId, actor.organizationId))) : [];
    if (!before) throw new Forbidden("Stage not found");
    await tx.update(progressStages).set(values).where(eq(progressStages.id, id));
    await audit(tx, actor, "progress_stage", id, "update", before, values);
    return id;
  });
}

// ---- Retention and deletion
// Purging a deal deletes its portal file bytes, blanks its messages and closes portal access. Metadata (names, dates,
// statuses) stays for the audit trail. Run by the daily cron for closed deals past the firm's retention period, or by an admin now.

const closed = ["funded", "declined", "cancelled", "complete"] as const;

async function purge(db: Db, dealId: string, organizationId: string, actor: Actor | null, reason: string, now: Date) {
  const live = await db.select({ id: files.id }).from(files).where(and(eq(files.dealId, dealId), isNull(files.purgedAt)));
  for (const f of live) await removeFile(f.id); // bytes first: a crash leaves rows to retry, never orphaned bytes
  await db.transaction(async (tx) => {
    if (live.length) await tx.update(files).set({ purgedAt: now }).where(inArray(files.id, live.map((f) => f.id)));
    const convs = tx.select({ id: conversations.id }).from(conversations).where(eq(conversations.dealId, dealId));
    await tx.update(messages).set({ body: "", purgedAt: now }).where(and(inArray(messages.conversationId, convs), isNull(messages.purgedAt)));
    await tx.update(dealBorrowers).set({ portalAccess: false }).where(eq(dealBorrowers.dealId, dealId));
    await tx.insert(auditLog).values({ organizationId, actorId: actor?.id, entity: "deal", entityId: dealId, action: "portal_purge", before: null, after: { files: live.length, reason } });
  });
  return live.length;
}

export async function purgeDeal(db: Db, actor: Actor, dealId: string, now = new Date()) {
  mustOrgAdmin(actor);
  const deal = await staffDeal(db, actor, dealId);
  return purge(db, deal.id, deal.organizationId, actor, "manual", now);
}

export async function runRetention(db: Db, now = new Date()) {
  const orgs = await db.select({ id: organizations.id, days: organizations.retentionDays }).from(organizations).where(isNotNull(organizations.retentionDays));
  let purgedDeals = 0, purgedFiles = 0;
  for (const o of orgs) {
    const cutoff = new Date(now.getTime() - o.days! * 86_400_000);
    const due = await db.selectDistinct({ id: deals.id }).from(deals).innerJoin(files, eq(files.dealId, deals.id))
      .where(and(eq(deals.organizationId, o.id), inArray(deals.status, [...closed]), lt(deals.updatedAt, cutoff), isNull(files.purgedAt)));
    for (const d of due) {
      purgedFiles += await purge(db, d.id, o.id, null, `retention ${o.days} days`, now);
      purgedDeals++;
    }
  }
  // Uploads started but never finished (browser closed): delete after a day.
  const stale = await db.select({ id: files.id }).from(files).where(and(eq(files.scanStatus, "pending"), lt(files.createdAt, new Date(now.getTime() - 86_400_000))));
  for (const f of stale) {
    await removeFile(f.id);
    await db.delete(files).where(eq(files.id, f.id));
  }
  return { purgedDeals, purgedFiles, abandonedUploads: stale.length };
}
