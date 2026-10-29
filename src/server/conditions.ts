// Deal conditions (the checklist), the organization's condition library with smart rules, and the documents that satisfy them.
import { and, asc, eq, isNull } from "drizzle-orm";
import { dealScope, Forbidden, type Actor } from "./access.ts";
import { audit } from "./audit.ts";
import { ValidationError } from "./contacts.ts";
import type { Db, Tx } from "./db.ts";
import type { DealStatus } from "./deal-status.ts";
import { conditionStatus, conditionTemplates, dealConditions, deals, documents, users } from "./schema.ts";
import { getFile, putFile } from "./storage.ts";

export type ConditionStatus = (typeof conditionStatus.enumValues)[number];
export const MAX_UPLOAD = 10 * 1024 * 1024; // keep in step with deal-conditions.tsx and next.config.ts

const UUID = /^[0-9a-f-]{36}$/i;

// Types are decided by the file's first bytes, not its name or the browser's claim.
const signatures: [string, number[]][] = [
  ["application/pdf", [0x25, 0x50, 0x44, 0x46]], // %PDF
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/png", [0x89, 0x50, 0x4e, 0x47]],
];
// A package locked by compliance (compliance.ts) freezes its checklist and documents.
const unlocked = (lockedAt: Date | null) => {
  if (lockedAt) throw new ValidationError("The package is locked by compliance");
};

export const sniffType = (b: Uint8Array) => signatures.find(([, sig]) => sig.every((x, i) => b[i] === x))?.[0] ?? null;

export const matchesRule = (rule: Record<string, string[]>, fields: Record<string, string>) =>
  Object.entries(rule).every(([k, accepted]) => accepted.includes(fields[k] ?? ""));

// Adds the library conditions whose rule matches the deal. Existing ones, waived included, are left alone,
// so a condition someone waived never comes back. Runs inside the save / status-change transaction.
export async function applySmartRules(tx: Tx, actor: Actor, deal: { id: string; organizationId: string; status: DealStatus; fields: Record<string, string>; packageLockedAt: Date | null }) {
  if (deal.status === "lead" || deal.packageLockedAt) return;
  const library = await tx.select().from(conditionTemplates)
    .where(and(eq(conditionTemplates.organizationId, deal.organizationId), eq(conditionTemplates.active, true)));
  const matching = library.filter((t) => matchesRule(t.rule, deal.fields));
  if (!matching.length) return;
  const added = await tx.insert(dealConditions)
    .values(matching.map((t) => ({ dealId: deal.id, templateId: t.id, name: t.name, createdBy: actor.id })))
    .onConflictDoNothing().returning({ name: dealConditions.name });
  if (added.length) await audit(tx, actor, "deal", deal.id, "smart_conditions", null, { added: added.map((a) => a.name) });
}

async function visibleDeal(db: Db, actor: Actor, id: string) {
  const [row] = UUID.test(id) ? await db.select({ id: deals.id, lockedAt: deals.packageLockedAt }).from(deals).where(and(eq(deals.id, id), dealScope(actor))) : [];
  if (!row) throw new Forbidden("Deal not found");
  return row;
}

async function visibleCondition(db: Db, actor: Actor, id: string) {
  const [row] = UUID.test(id)
    ? await db.select({ c: dealConditions, lockedAt: deals.packageLockedAt }).from(dealConditions).innerJoin(deals, eq(deals.id, dealConditions.dealId)).where(and(eq(dealConditions.id, id), dealScope(actor)))
    : [];
  if (!row) throw new Forbidden("Condition not found");
  unlocked(row.lockedAt);
  return row.c;
}

// A deal's checklist with its documents, plus the library conditions not on it yet.
export async function dealChecklist(db: Db, actor: Actor, dealId: string) {
  const { lockedAt } = await visibleDeal(db, actor, dealId);
  const conditions = await db.select().from(dealConditions).where(eq(dealConditions.dealId, dealId)).orderBy(asc(dealConditions.createdAt), asc(dealConditions.name));
  const docs = await db
    .select({ id: documents.id, conditionId: documents.conditionId, fileName: documents.fileName, size: documents.size, at: documents.createdAt, by: users.name })
    .from(documents).innerJoin(users, eq(users.id, documents.uploadedBy))
    .where(and(eq(documents.dealId, dealId), isNull(documents.deletedAt))).orderBy(asc(documents.createdAt));
  const library = await db.select({ id: conditionTemplates.id, name: conditionTemplates.name }).from(conditionTemplates)
    .where(and(eq(conditionTemplates.organizationId, actor.organizationId), eq(conditionTemplates.active, true))).orderBy(asc(conditionTemplates.name));
  return {
    dealId,
    locked: !!lockedAt,
    conditions: conditions.map((c) => ({ id: c.id, name: c.name, status: c.status, documents: docs.filter((d) => d.conditionId === c.id) })),
    library: library.filter((t) => !conditions.some((c) => c.templateId === t.id)),
  };
}

// From the library (templateId) or a custom name.
export async function addCondition(db: Db, actor: Actor, dealId: string, input: { templateId?: unknown; name?: unknown }) {
  unlocked((await visibleDeal(db, actor, dealId)).lockedAt);
  let values: { templateId?: string; name: string };
  if (typeof input.templateId === "string" && input.templateId) {
    const [t] = UUID.test(input.templateId)
      ? await db.select().from(conditionTemplates).where(and(eq(conditionTemplates.id, input.templateId), eq(conditionTemplates.organizationId, actor.organizationId)))
      : [];
    if (!t) throw new ValidationError("Unknown condition");
    values = { templateId: t.id, name: t.name };
  } else {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 200) throw new ValidationError("A condition needs a name of up to 200 characters");
    values = { name };
  }
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(dealConditions).values({ ...values, dealId, createdBy: actor.id }).onConflictDoNothing().returning();
    if (!row) throw new ValidationError("That condition is already on this deal");
    await audit(tx, actor, "condition", row.id, "create", null, row);
    return row;
  });
}

export async function setConditionStatus(db: Db, actor: Actor, id: string, status: unknown) {
  if (!conditionStatus.enumValues.includes(status as ConditionStatus)) throw new ValidationError("Unknown condition status");
  const before = await visibleCondition(db, actor, id);
  return db.transaction(async (tx) => {
    const [row] = await tx.update(dealConditions).set({ status: status as ConditionStatus, updatedAt: new Date() }).where(eq(dealConditions.id, id)).returning();
    await audit(tx, actor, "condition", id, "status", { status: before.status }, { status });
    return row;
  });
}

// Stores the file and marks an outstanding condition as received. The file is written inside the transaction,
// so a failed write leaves no row behind.
export async function uploadDocument(db: Db, actor: Actor, conditionId: string, file: { name: string; bytes: Uint8Array }) {
  const condition = await visibleCondition(db, actor, conditionId);
  if (!file.bytes.length) throw new ValidationError("The file is empty");
  if (file.bytes.length > MAX_UPLOAD) throw new ValidationError("Files must be 10 MB or less");
  const contentType = sniffType(file.bytes);
  if (!contentType) throw new ValidationError("Only PDF, JPEG and PNG files can be uploaded");
  // ponytail: no virus scan; that is a pending integration and must exist before client uploads (step 11).
  const fileName = file.name.replace(/[\\/"\x00-\x1f]/g, "_").trim().slice(-200) || "document";
  return db.transaction(async (tx) => {
    const [doc] = await tx.insert(documents).values({ dealId: condition.dealId, conditionId, fileName, contentType, size: file.bytes.length, uploadedBy: actor.id }).returning();
    if (condition.status === "outstanding") await tx.update(dealConditions).set({ status: "received", updatedAt: new Date() }).where(eq(dealConditions.id, conditionId));
    await audit(tx, actor, "document", doc.id, "upload", null, { fileName, contentType, size: doc.size, conditionId });
    await putFile(doc.id, file.bytes);
    return doc;
  });
}

async function visibleDocument(db: Db, actor: Actor, id: string) {
  const [row] = UUID.test(id)
    ? await db.select({ d: documents, lockedAt: deals.packageLockedAt }).from(documents).innerJoin(deals, eq(deals.id, documents.dealId)).where(and(eq(documents.id, id), isNull(documents.deletedAt), dealScope(actor)))
    : [];
  return row ?? null;
}

// Null when missing or not visible to the actor, so ids can't be probed. Every download is audited.
export async function openDocument(db: Db, actor: Actor, id: string) {
  const doc = (await visibleDocument(db, actor, id))?.d;
  if (!doc) return null;
  await db.transaction((tx) => audit(tx, actor, "document", id, "download", null, null));
  return { doc, bytes: await getFile(id) };
}

// Soft delete: the file is kept for the audit trail and no longer listed or downloadable.
export async function removeDocument(db: Db, actor: Actor, id: string) {
  const found = await visibleDocument(db, actor, id);
  if (!found) throw new Forbidden("Document not found");
  unlocked(found.lockedAt);
  const doc = found.d;
  await db.transaction(async (tx) => {
    await tx.update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, id));
    await audit(tx, actor, "document", id, "remove", { fileName: doc.fileName }, null);
  });
}
