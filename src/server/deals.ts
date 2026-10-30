import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { fieldKeys } from "../components/platform/deal-sections.ts";
import { dealScope, Forbidden, type Actor } from "./access.ts";
import { audit } from "./audit.ts";
import { applySmartRules } from "./conditions.ts";
import { getContact, ValidationError } from "./contacts.ts";
import type { Db } from "./db.ts";
import { allowedMoves, type DealStatus } from "./deal-status.ts";
import { contacts, dealBorrowers, deals, dealStatusHistory, users } from "./schema.ts";

export { dealCode } from "./deal-status.ts";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateCols = ["closingDate", "conditionsDate", "followUpDate"] as const;
const newStatuses: DealStatus[] = ["lead", "pre_approval", "new_deal"];
// Workspace fields that are also kept as columns, so dashboards and reports can sort and sum them.
const PURPOSE = "mortgageRequest/Mortgage Breakdown/Application Purpose";
const AMOUNTS = ["mortgageRequest/Mortgage Breakdown/Total Mortgage Amount with Premium", "mortgageRequest/Mortgage Breakdown/1st Mortgage Total"];

const today = () => new Date().toISOString().slice(0, 10);

function cleanDate(v: unknown, label: string) {
  const s = typeof v === "string" ? v.trim() : "";
  if (s && !(DATE.test(s) && !Number.isNaN(Date.parse(s)))) throw new ValidationError(`${label} is not a valid date`);
  return s || null;
}

function cleanAmount(v: unknown) {
  const s = typeof v === "string" ? v.replace(/[$,\s]/g, "") : "";
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 2_000_000_000) throw new ValidationError("Mortgage amount must be a positive number");
  return Math.round(n);
}

const field = (key: string) => sql<string | null>`${deals.fields}->>${key}`;

// ponytail: returns every visible deal and the pages filter client-side; add server filters + paging past a few thousand.
export function listDeals(db: Db, actor: Actor, statuses?: DealStatus[]) {
  return db
    .select({
      id: deals.id, number: deals.number, status: deals.status, previousStatus: deals.previousStatus, purpose: deals.purpose, amount: deals.amount,
      closingDate: deals.closingDate, conditionsDate: deals.conditionsDate, followUpDate: deals.followUpDate, submittedDate: deals.submittedDate,
      lender: field("closeOut//Lender"), product: field("closeOut//Product"), netRate: field("mortgageRequest/Rates and Payments/Net Rate"),
      conditionsMet: field("conditions//Lender Conditions Met"),
      agent: users.name, agentActive: sql<boolean>`${users.deactivatedAt} is null`, firstName: contacts.firstName, lastName: contacts.lastName, address: contacts.address, contactId: contacts.id,
    })
    .from(deals)
    .innerJoin(users, eq(users.id, deals.agentId))
    .leftJoin(dealBorrowers, and(eq(dealBorrowers.dealId, deals.id), eq(dealBorrowers.position, 0)))
    .leftJoin(contacts, eq(contacts.id, dealBorrowers.contactId))
    .where(and(dealScope(actor), statuses ? inArray(deals.status, statuses) : undefined))
    .orderBy(asc(deals.closingDate), asc(deals.number));
}

export type DealRow = Awaited<ReturnType<typeof listDeals>>[number];

// Returns null both when the deal doesn't exist and when the actor can't see it, so ids can't be probed.
export async function getDeal(db: Db, actor: Actor, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(deals).where(and(eq(deals.id, id), dealScope(actor)));
  if (!row) return null;
  const [agent] = await db.select({ name: users.name }).from(users).where(eq(users.id, row.agentId));
  const borrowers = await db
    .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.email, homePhone: contacts.homePhone, cellPhone: contacts.cellPhone, workPhone: contacts.workPhone })
    .from(dealBorrowers).innerJoin(contacts, eq(contacts.id, dealBorrowers.contactId))
    .where(eq(dealBorrowers.dealId, id)).orderBy(asc(dealBorrowers.position));
  return { ...row, agent: agent.name, borrowers };
}

export async function findDealByCode(db: Db, actor: Actor, code: string) {
  const n = Number(/^KW-(\d+)$/i.exec(code.trim())?.[1]);
  if (!Number.isSafeInteger(n)) return null;
  const [row] = await db.select({ id: deals.id }).from(deals).where(and(eq(deals.number, n), dealScope(actor)));
  return row?.id ?? null;
}

async function mustGet(db: Db, actor: Actor, id: string) {
  const row = await getDeal(db, actor, id);
  if (!row) throw new Forbidden("Deal not found");
  return row;
}

// Throws ValidationError, so callers can check a new deal before creating anything else (e.g. its contact).
export function newDealValues(input: Record<string, unknown>) {
  const status = input.status as DealStatus;
  if (!newStatuses.includes(status)) throw new ValidationError("A new deal starts as a lead, pre-approval or new deal");
  const values = {
    status,
    amount: cleanAmount(input.amount),
    closingDate: cleanDate(input.closingDate, "Closing date"),
    followUpDate: cleanDate(input.followUpDate, "Follow-up date"),
  };
  const fields: Record<string, string> = {};
  if (typeof input.lender === "string" && input.lender.trim()) fields["closeOut//Lender"] = input.lender.trim().slice(0, 200);
  if (values.amount) fields[AMOUNTS[1]] = String(values.amount);
  return { values, fields };
}

// A lead or new application for a contact the actor can see. The actor becomes the agent.
export async function createDeal(db: Db, actor: Actor, contactId: string, input: Record<string, unknown>) {
  const { values, fields } = newDealValues(input);
  const status = values.status;
  if (!(await getContact(db, actor, contactId))) throw new Forbidden("Contact not found");
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(deals).values({ ...values, fields, organizationId: actor.organizationId, officeId: actor.officeId, agentId: actor.id }).returning();
    await tx.insert(dealBorrowers).values({ dealId: row.id, contactId, position: 0 });
    await tx.insert(dealStatusHistory).values({ dealId: row.id, from: null, to: status, actorId: actor.id });
    await audit(tx, actor, "deal", row.id, "create", null, row);
    await applySmartRules(tx, actor, row);
    return row;
  });
}

// Saves the workspace fields that were sent; unknown keys are ignored, so the client can't write arbitrary JSON.
export async function saveDeal(db: Db, actor: Actor, id: string, input: Record<string, unknown>) {
  const before = await mustGet(db, actor, id);
  const fields = { ...before.fields };
  for (const [k, v] of Object.entries(input)) {
    if (!fieldKeys.has(k)) continue;
    const s = typeof v === "string" ? v.trim() : "";
    if (s.length > 2000) throw new ValidationError(`${k.split("/").pop()} is too long`);
    if (s) fields[k] = s;
    else delete fields[k];
  }
  const cols: Partial<Record<(typeof dateCols)[number], string | null>> = {};
  for (const c of dateCols) if (c in input) cols[c] = cleanDate(input[c], c.replace("Date", " date"));
  const amount = cleanAmount(AMOUNTS.map((k) => fields[k]).find(Boolean));
  const changed = Object.keys({ ...before.fields, ...fields }).filter((k) => before.fields[k] !== fields[k]);
  const pick = (f: Record<string, string>) => Object.fromEntries(changed.map((k) => [k, f[k] ?? null]));
  const oldCols = Object.fromEntries(Object.keys(cols).map((c) => [c, before[c as keyof typeof cols]]));
  return db.transaction(async (tx) => {
    const [row] = await tx.update(deals).set({ ...cols, fields, amount, purpose: fields[PURPOSE] ?? null, updatedAt: new Date() }).where(eq(deals.id, id)).returning();
    await audit(tx, actor, "deal", id, "update", { ...pick(before.fields), ...oldCols }, { ...pick(fields), ...cols });
    await applySmartRules(tx, actor, row);
    return row;
  });
}

// The only way a status changes: checked against the rules, recorded in history and the audit log.
export async function moveDeal(db: Db, actor: Actor, id: string, to: DealStatus) {
  const before = await mustGet(db, actor, id);
  if (!allowedMoves(before.status, before.previousStatus).includes(to)) throw new ValidationError(`A deal can't move from ${before.status} to ${to}`);
  if (to === "cancelled" && actor.role === "assistant") throw new Forbidden("Assistants can't cancel deals");
  const shelving = to === "parked" || to === "cancelled";
  return db.transaction(async (tx) => {
    const [row] = await tx.update(deals).set({
      status: to,
      previousStatus: shelving ? before.status : null,
      submittedDate: to === "submitted" ? (before.submittedDate ?? today()) : before.submittedDate,
      updatedAt: new Date(),
    }).where(eq(deals.id, id)).returning();
    await tx.insert(dealStatusHistory).values({ dealId: id, from: before.status, to, actorId: actor.id });
    await audit(tx, actor, "deal", id, "status", { status: before.status }, { status: to });
    await applySmartRules(tx, actor, row); // a lead becoming an application picks up its checklist
    return row;
  });
}

// Caller must already have loaded the deal through getDeal (which applies the scope).
export function dealHistory(db: Db, id: string) {
  return db.select({ id: dealStatusHistory.id, from: dealStatusHistory.from, to: dealStatusHistory.to, at: dealStatusHistory.at, actor: users.name })
    .from(dealStatusHistory).innerJoin(users, eq(users.id, dealStatusHistory.actorId))
    .where(eq(dealStatusHistory.dealId, id)).orderBy(asc(dealStatusHistory.at));
}

// Deals are never hard-deleted. Deleting hides the deal everywhere (dealScope skips deleted rows); admins see it under
// Admin > Recently Deleted and can restore it.
export async function deleteDeal(db: Db, actor: Actor, id: string) {
  if (actor.role === "assistant") throw new Forbidden("Assistants can't delete deals");
  await mustGet(db, actor, id);
  await db.transaction(async (tx) => {
    await tx.update(deals).set({ deletedAt: new Date() }).where(eq(deals.id, id));
    await audit(tx, actor, "deal", id, "delete", null, null);
  });
}

// Admins only: org admins see the whole organization, office admins their own office.
const deletedScope = (actor: Actor) => {
  if (actor.role !== "org_admin" && actor.role !== "office_admin") throw new Forbidden("Only admins can see deleted deals");
  return and(eq(deals.organizationId, actor.organizationId), isNotNull(deals.deletedAt), actor.role === "office_admin" ? eq(deals.officeId, actor.officeId) : undefined)!;
};

export async function listDeletedDeals(db: Db, actor: Actor) {
  return db
    .select({ id: deals.id, number: deals.number, status: deals.status, amount: deals.amount, deletedAt: deals.deletedAt, agent: users.name, firstName: contacts.firstName, lastName: contacts.lastName })
    .from(deals)
    .innerJoin(users, eq(users.id, deals.agentId))
    .leftJoin(dealBorrowers, and(eq(dealBorrowers.dealId, deals.id), eq(dealBorrowers.position, 0)))
    .leftJoin(contacts, eq(contacts.id, dealBorrowers.contactId))
    .where(deletedScope(actor))
    .orderBy(desc(deals.deletedAt));
}

export async function restoreDeal(db: Db, actor: Actor, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Forbidden("Deal not found");
  await db.transaction(async (tx) => {
    const [row] = await tx.update(deals).set({ deletedAt: null, updatedAt: new Date() }).where(and(eq(deals.id, id), deletedScope(actor))).returning({ id: deals.id });
    if (!row) throw new Forbidden("Deal not found");
    await audit(tx, actor, "deal", id, "restore", null, null);
  });
}
