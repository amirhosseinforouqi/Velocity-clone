// Admin: offices, users and roles, organization settings, consent templates, the condition library and the audit log.
// org_admin manages the whole organization. office_admin manages their own office and its users, and can't grant org_admin.
// Every change is audited in the same transaction.
import { and, asc, count, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { officeKeys, orgFeatures, userKeys } from "../components/platform/admin-fields.ts";
import { fieldKeys } from "../components/platform/deal-sections.ts";
import { Forbidden, type Actor, type Role } from "./access.ts";
import { audit } from "./audit.ts";
import { ValidationError } from "./contacts.ts";
import type { Db } from "./db.ts";
import type { DealStatus } from "./deal-status.ts";
import { hashPassword } from "./password.ts";
import { auditLog, conditionTemplates, consentTemplates, contacts, deals, offices, organizations, role, tasks, users, type OrgSettings } from "./schema.ts";

const UUID = /^[0-9a-f-]{36}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const roles = role.enumValues;

export const isAdmin = (a: Actor) => a.role === "org_admin" || a.role === "office_admin";

// officeId given: the actor must be able to manage that office. Omitted: any admin (the query is scoped instead).
function mustAdmin(actor: Actor, officeId?: string) {
  if (actor.role === "org_admin" || (actor.role === "office_admin" && (!officeId || officeId === actor.officeId))) return;
  throw new Forbidden("You don't have access to this");
}
export function mustOrgAdmin(actor: Actor) {
  if (actor.role !== "org_admin") throw new Forbidden("Only an organization admin can do this");
}

export function text(v: unknown, label: string, max = 200, required = true) {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) throw new ValidationError(`${label} is required`);
  if (s.length > max) throw new ValidationError(`${label} is too long`);
  return s;
}

// Whitelisted string fields; anything else in the input is ignored.
function details(input: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.flatMap((k) => {
    const v = text(input[k], k, 5000, false);
    return v ? [[k, v]] : [];
  }));
}

// ---- Offices

export async function listOffices(db: Db, actor: Actor) {
  mustAdmin(actor);
  return db.select().from(offices)
    .where(and(eq(offices.organizationId, actor.organizationId), actor.role === "org_admin" ? undefined : eq(offices.id, actor.officeId)))
    .orderBy(asc(offices.name));
}

export async function getOffice(db: Db, actor: Actor, id: string) {
  if (!UUID.test(id) || !isAdmin(actor) || (actor.role === "office_admin" && id !== actor.officeId)) return null;
  const [o] = await db.select().from(offices).where(and(eq(offices.id, id), eq(offices.organizationId, actor.organizationId)));
  return o ?? null;
}

export async function saveOffice(db: Db, actor: Actor, id: string | null, input: Record<string, unknown>) {
  const values = { name: text(input.name, "Name", 100), details: details(input, officeKeys) };
  if (!id) {
    mustOrgAdmin(actor);
    return db.transaction(async (tx) => {
      const [o] = await tx.insert(offices).values({ ...values, organizationId: actor.organizationId }).returning();
      await audit(tx, actor, "office", o.id, "create", null, values);
      return o.id;
    });
  }
  const before = await getOffice(db, actor, id);
  if (!before) throw new Forbidden("Office not found");
  await db.transaction(async (tx) => {
    await tx.update(offices).set(values).where(eq(offices.id, id));
    await audit(tx, actor, "office", id, "update", { name: before.name, details: before.details }, values);
  });
  return id;
}

// Only an empty office can go: users, contacts and deals keep their office for scoping and history.
export async function deleteOffice(db: Db, actor: Actor, id: string) {
  mustOrgAdmin(actor);
  const office = await getOffice(db, actor, id);
  if (!office) throw new Forbidden("Office not found");
  for (const t of [users, contacts, deals]) {
    const [{ n }] = await db.select({ n: count() }).from(t).where(eq(t.officeId, id));
    if (n) throw new ValidationError(`${office.name} still has users, contacts or deals. Move them to another office first.`);
  }
  await db.transaction(async (tx) => {
    await tx.delete(consentTemplates).where(eq(consentTemplates.officeId, id));
    await tx.delete(offices).where(eq(offices.id, id));
    await audit(tx, actor, "office", id, "delete", { name: office.name, details: office.details }, null);
  });
}

// ---- Users

const userCols = { id: users.id, name: users.name, email: users.email, role: users.role, officeId: users.officeId, office: offices.name, details: users.details, deactivatedAt: users.deactivatedAt };

export async function listUsers(db: Db, actor: Actor) {
  mustAdmin(actor);
  return db.select(userCols).from(users).innerJoin(offices, eq(offices.id, users.officeId))
    .where(and(eq(users.organizationId, actor.organizationId), actor.role === "org_admin" ? undefined : and(eq(users.officeId, actor.officeId), ne(users.role, "org_admin"))))
    .orderBy(asc(users.name));
}

export type AdminUserRow = Awaited<ReturnType<typeof listUsers>>[number];

export async function getUser(db: Db, actor: Actor, id: string) {
  if (!UUID.test(id) || !isAdmin(actor)) return null;
  const [u] = await db.select(userCols).from(users).innerJoin(offices, eq(offices.id, users.officeId))
    .where(and(eq(users.id, id), eq(users.organizationId, actor.organizationId)));
  // An office admin can't see or edit organization admins or people in other offices.
  return u && (actor.role === "org_admin" || (u.officeId === actor.officeId && u.role !== "org_admin")) ? u : null;
}

export type UserInput = { name?: unknown; email?: unknown; officeId?: unknown; role?: unknown; password?: unknown; details?: Record<string, unknown> };

// Create (id null: name, email, office, role and password required) or update (only the given fields change).
export async function saveUser(db: Db, actor: Actor, id: string | null, input: UserInput) {
  const before = id ? await getUser(db, actor, id) : null;
  if (id && !before) throw new Forbidden("User not found");
  const has = (k: keyof UserInput) => !before || (input[k] !== undefined && input[k] !== "");
  const set: Partial<typeof users.$inferInsert> = {};
  if (has("name")) set.name = text(input.name, "Name", 100);
  if (has("email")) {
    set.email = text(input.email, "Email").toLowerCase();
    if (!EMAIL.test(set.email)) throw new ValidationError("Email is not valid");
    const [taken] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, set.email), id ? ne(users.id, id) : undefined));
    if (taken) throw new ValidationError("Another user already has this email");
  }
  if (has("officeId")) {
    const office = await getOffice(db, actor, String(input.officeId ?? ""));
    if (!office) throw new ValidationError("Choose an office you manage");
    set.officeId = office.id;
  }
  if (has("role")) {
    if (!roles.includes(input.role as Role)) throw new ValidationError("Choose a role");
    set.role = input.role as Role;
    if (set.role === "org_admin") mustOrgAdmin(actor);
    if (id === actor.id && set.role !== actor.role) throw new ValidationError("You can't change your own role");
  }
  if (has("password")) {
    const pw = typeof input.password === "string" ? input.password : "";
    if (pw.length < 12 || pw.length > 200) throw new ValidationError("Password must be at least 12 characters");
    set.passwordHash = await hashPassword(pw);
  }
  if (input.details) set.details = details(input.details, userKeys);
  if (set.details?.Mentor && !(await getUser(db, actor, set.details.Mentor))) throw new ValidationError("Choose a mentor from your users");

  const logged = ({ passwordHash, ...rest }: Partial<typeof users.$inferInsert>) => ({ ...rest, ...(passwordHash && { password: "changed" }) });
  return db.transaction(async (tx) => {
    if (!before) {
      const [u] = await tx.insert(users).values({ ...(set as typeof users.$inferInsert), organizationId: actor.organizationId }).returning({ id: users.id });
      await audit(tx, actor, "user", u.id, "create", null, logged(set));
      return u.id;
    }
    await tx.update(users).set(set).where(eq(users.id, before.id));
    await audit(tx, actor, "user", before.id, "update", { name: before.name, email: before.email, role: before.role, officeId: before.officeId, details: before.details }, logged(set));
    return before.id;
  });
}

// Deactivate a user, optionally handing their deals, contacts and open deal tasks to someone in the same office.
// Without a reassignee their deals show under No Agent. ponytail: same-office reassignment only; moving work across offices needs its officeId moved too.
export async function deactivateUser(db: Db, actor: Actor, id: string, reassignTo?: string) {
  const u = await getUser(db, actor, id);
  if (!u) throw new Forbidden("User not found");
  if (u.id === actor.id) throw new ValidationError("You can't deactivate yourself");
  if (u.deactivatedAt) throw new ValidationError(`${u.name} is already deactivated`);
  const to = reassignTo ? await getUser(db, actor, reassignTo) : null;
  if (reassignTo && (!to || to.deactivatedAt || to.id === u.id || to.officeId !== u.officeId)) throw new ValidationError("Reassign to an active user in the same office");
  await db.transaction(async (tx) => {
    let moved = { deals: 0, contacts: 0, tasks: 0 };
    if (to) {
      const d = await tx.update(deals).set({ agentId: to.id, updatedAt: new Date() }).where(and(eq(deals.agentId, u.id), isNull(deals.deletedAt))).returning({ id: deals.id });
      const c = await tx.update(contacts).set({ ownerId: to.id, updatedAt: new Date() }).where(and(eq(contacts.ownerId, u.id), isNull(contacts.deletedAt))).returning({ id: contacts.id });
      const t = await tx.update(tasks).set({ assigneeId: to.id, updatedAt: new Date() })
        .where(and(eq(tasks.assigneeId, u.id), sql`${tasks.dealId} is not null`, isNull(tasks.doneAt), isNull(tasks.deletedAt))).returning({ id: tasks.id });
      moved = { deals: d.length, contacts: c.length, tasks: t.length };
    }
    await tx.update(users).set({ deactivatedAt: new Date() }).where(eq(users.id, u.id));
    await audit(tx, actor, "user", u.id, "deactivate", null, { reassignTo: to?.id ?? null, ...moved });
  });
}

export async function restoreUser(db: Db, actor: Actor, id: string) {
  const u = await getUser(db, actor, id);
  if (!u) throw new Forbidden("User not found");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ deactivatedAt: null }).where(eq(users.id, u.id));
    await audit(tx, actor, "user", u.id, "restore", { deactivatedAt: u.deactivatedAt }, null);
  });
}

// ---- Organization settings

export const defaultSettings: OrgSettings = {
  sla: { approved: 7, accepted: 7, waiting_to_close: 30 },
  reminders: { urgent: 2, warning: 7, notice: 14 },
  features: ["Enable eSign", "Enable My Day", "Enable Global Search", "Enable Importer", "Enable Pipeline Report", "Enable Report Creator", "Enable Deal Close Out", "Enable Scenario Builder - Calculators"],
};
export const slaStatuses: DealStatus[] = ["approved", "accepted", "waiting_to_close"];

export async function getOrganization(db: Db, organizationId: string) {
  const [o] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  const s = o.settings;
  return { id: o.id, name: o.name, settings: { sla: { ...defaultSettings.sla, ...s.sla }, reminders: { ...defaultSettings.reminders, ...s.reminders }, features: s.features ?? defaultSettings.features } };
}

const days = (v: unknown, label: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 365) throw new ValidationError(`${label} must be a whole number of days from 0 to 365`);
  return n;
};

export async function saveOrganization(db: Db, actor: Actor, input: { name: unknown; sla: Record<string, unknown>; reminders: Record<string, unknown>; features: unknown[] }) {
  mustOrgAdmin(actor);
  const name = text(input.name, "Name", 100);
  const sla = Object.fromEntries(slaStatuses.map((s) => [s, days(input.sla[s], "SLA days")]));
  const r = { urgent: days(input.reminders.urgent, "Urgent"), warning: days(input.reminders.warning, "Warning"), notice: days(input.reminders.notice, "Notice") };
  if (!(r.urgent < r.warning && r.warning < r.notice)) throw new ValidationError("Reminder days must go up: urgent, then warning, then notice");
  const features = orgFeatures.filter((f) => input.features.includes(f));
  const before = await getOrganization(db, actor.organizationId);
  const settings = { sla, reminders: r, features };
  await db.transaction(async (tx) => {
    await tx.update(organizations).set({ name, settings }).where(eq(organizations.id, actor.organizationId));
    await audit(tx, actor, "organization", actor.organizationId, "update", { name: before.name, settings: before.settings }, { name, settings });
  });
}

// ---- Consent templates (per office)

export async function listConsents(db: Db, actor: Actor, officeId: string) {
  if (!(await getOffice(db, actor, officeId))) return [];
  return db.select().from(consentTemplates).where(eq(consentTemplates.officeId, officeId)).orderBy(asc(consentTemplates.createdAt));
}

export async function saveConsent(db: Db, actor: Actor, officeId: string, id: string | null, input: Record<string, unknown>) {
  if (!(await getOffice(db, actor, officeId))) throw new Forbidden("Office not found");
  const values = {
    title: text(input.title, "Consent Title"),
    content: text(input.content, "Consent Content", 20000),
    acceptance: input.acceptance === true,
    acceptanceText: text(input.acceptanceText, "Acceptance Text", 500, false) || null,
    signature: input.signature === true,
    pageBreak: input.pageBreak === true,
    active: input.active !== false,
  };
  return db.transaction(async (tx) => {
    if (!id) {
      const [c] = await tx.insert(consentTemplates).values({ ...values, officeId }).returning({ id: consentTemplates.id });
      await audit(tx, actor, "consent_template", c.id, "create", null, values);
      return c.id;
    }
    const [before] = UUID.test(id) ? await tx.select().from(consentTemplates).where(and(eq(consentTemplates.id, id), eq(consentTemplates.officeId, officeId))) : [];
    if (!before) throw new Forbidden("Consent template not found");
    await tx.update(consentTemplates).set({ ...values, updatedAt: new Date() }).where(eq(consentTemplates.id, id));
    await audit(tx, actor, "consent_template", id, "update", before, values);
    return id;
  });
}

export async function deleteConsent(db: Db, actor: Actor, id: string) {
  const [c] = UUID.test(id) ? await db.select().from(consentTemplates).where(eq(consentTemplates.id, id)) : [];
  if (!c || !(await getOffice(db, actor, c.officeId))) throw new Forbidden("Consent template not found");
  await db.transaction(async (tx) => {
    await tx.delete(consentTemplates).where(eq(consentTemplates.id, id));
    await audit(tx, actor, "consent_template", id, "delete", c, null);
  });
}

// ---- Condition library

export async function listConditionTemplates(db: Db, actor: Actor) {
  mustOrgAdmin(actor);
  return db.select().from(conditionTemplates).where(eq(conditionTemplates.organizationId, actor.organizationId)).orderBy(asc(conditionTemplates.name));
}

// rule: workspace field key -> accepted values. Keys must be real workspace fields; empty value lists are dropped.
export async function saveConditionTemplate(db: Db, actor: Actor, id: string | null, input: { name: unknown; rule: unknown; active: unknown }) {
  mustOrgAdmin(actor);
  const rule: Record<string, string[]> = {};
  for (const [k, vs] of Object.entries((input.rule ?? {}) as Record<string, unknown>)) {
    if (!fieldKeys.has(k)) throw new ValidationError(`Unknown field: ${k}`);
    const list = (Array.isArray(vs) ? vs : []).map((v) => text(v, "Rule value", 100, false)).filter(Boolean);
    if (list.length) rule[k] = [...new Set(list)];
  }
  const values = { name: text(input.name, "Condition", 300), rule, active: input.active !== false };
  return db.transaction(async (tx) => {
    if (!id) {
      const [t] = await tx.insert(conditionTemplates).values({ ...values, organizationId: actor.organizationId }).returning({ id: conditionTemplates.id });
      await audit(tx, actor, "condition_template", t.id, "create", null, values);
      return t.id;
    }
    const [before] = UUID.test(id) ? await tx.select().from(conditionTemplates).where(and(eq(conditionTemplates.id, id), eq(conditionTemplates.organizationId, actor.organizationId))) : [];
    if (!before) throw new Forbidden("Condition not found");
    await tx.update(conditionTemplates).set(values).where(eq(conditionTemplates.id, id));
    await audit(tx, actor, "condition_template", id, "update", { name: before.name, rule: before.rule, active: before.active }, values);
    return id;
  });
}

// ---- Logs: the audit table, newest first. Organization admins only, since entries can hold any record's before / after.

export const LOG_PAGE = 25;

export async function listAudit(db: Db, actor: Actor, opts: { entity?: string; page?: number }) {
  mustOrgAdmin(actor);
  const where = and(eq(auditLog.organizationId, actor.organizationId), opts.entity ? eq(auditLog.entity, opts.entity) : undefined);
  const page = Math.max(1, Math.floor(opts.page ?? 1) || 1);
  const [{ total }] = await db.select({ total: count() }).from(auditLog).where(where);
  const rows = await db
    .select({ id: auditLog.id, at: auditLog.at, entity: auditLog.entity, entityId: auditLog.entityId, action: auditLog.action, actor: users.name, before: auditLog.before, after: auditLog.after })
    .from(auditLog).innerJoin(users, eq(users.id, auditLog.actorId))
    .where(where).orderBy(desc(auditLog.at), desc(auditLog.id)).limit(LOG_PAGE).offset((page - 1) * LOG_PAGE);
  const entities = (await db.selectDistinct({ e: auditLog.entity }).from(auditLog).where(eq(auditLog.organizationId, actor.organizationId)).orderBy(asc(auditLog.entity))).map((r) => r.e);
  return { rows, total, page, entities };
}
