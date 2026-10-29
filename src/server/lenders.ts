// Lenders and their products: organization admins manage them; deals pick from the active ones their agent may use.
// Deals keep the lender and product by name, so a rename leaves older deals (and the Funded by Lender report) on the old name.
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { lenderFees, lenderGroups, lenderTypes, limitKeys, productFees, underwriterTypes } from "../components/platform/admin-fields.ts";
import type { Actor } from "./access.ts";
import { mustOrgAdmin, text } from "./admin.ts";
import { audit } from "./audit.ts";
import { ValidationError } from "./contacts.ts";
import type { Db } from "./db.ts";
import { lenderProducts, lenders, users, type Fees, type LenderLimits } from "./schema.ts";

const UUID = /^[0-9a-f-]{36}$/i;

const pick = (v: unknown, list: string[], label: string) => {
  if (typeof v !== "string" || !list.includes(v)) throw new ValidationError(`Choose a ${label}`);
  return v;
};

// A blank number is 0. Rates are 0-100 % with up to 3 decimals (25 bps = 0.25); days are whole, up to 10 years.
function number(v: unknown, label: string, max: number, whole: boolean) {
  const s = v === undefined || v === null ? "" : String(v).trim();
  const n = s === "" ? 0 : Number(s);
  if (!Number.isFinite(n) || n < 0 || n > max || (whole ? !Number.isInteger(n) : Math.round(n * 1000) !== n * 1000))
    throw new ValidationError(`${label} must be ${whole ? "a whole number" : "a number with up to 3 decimals"} from 0 to ${max}`);
  return n;
}

function fees(input: Record<string, unknown>, list: readonly (readonly [string, string, ...string[]])[]) {
  const out: Fees = {};
  for (const [k, name] of list) {
    out[k] = number(input[k], `${name} (%)`, 100, false);
    out[`${k}Days`] = number(input[`${k}Days`], `${name} days`, 3650, true);
  }
  return out;
}

export async function listLenders(db: Db, actor: Actor) {
  mustOrgAdmin(actor);
  return db.select().from(lenders).where(eq(lenders.organizationId, actor.organizationId)).orderBy(asc(lenders.name));
}

export type LenderRow = Awaited<ReturnType<typeof listLenders>>[number];

export async function getLender(db: Db, actor: Actor, id: string) {
  mustOrgAdmin(actor);
  if (!UUID.test(id)) return null;
  const [l] = await db.select().from(lenders).where(and(eq(lenders.id, id), eq(lenders.organizationId, actor.organizationId)));
  if (!l) return null;
  return { ...l, products: await db.select().from(lenderProducts).where(eq(lenderProducts.lenderId, l.id)).orderBy(asc(lenderProducts.name)) };
}

async function uniqueName(db: Db, actor: Actor, name: string, id: string | null) {
  const same = await db.select({ id: lenders.id, name: lenders.name }).from(lenders).where(and(eq(lenders.organizationId, actor.organizationId), id ? ne(lenders.id, id) : undefined));
  if (same.some((l) => l.name.toLowerCase() === name.toLowerCase())) throw new ValidationError("Another lender already has this name");
}

// Add Lender only asks for the name and type; everything else is edited on the lender's page.
export async function createLender(db: Db, actor: Actor, input: { name: unknown; type: unknown }) {
  mustOrgAdmin(actor);
  const values = { name: text(input.name, "Lender Name", 100), type: pick(input.type, lenderTypes, "lender type"), displayAs: lenderGroups[0] };
  await uniqueName(db, actor, values.name, null);
  return db.transaction(async (tx) => {
    const [l] = await tx.insert(lenders).values({ ...values, organizationId: actor.organizationId }).returning({ id: lenders.id });
    await audit(tx, actor, "lender", l.id, "create", null, values);
    return l.id;
  });
}

export type LenderInput = Record<string, unknown> & { underwriters?: unknown[]; agentIds?: unknown[]; allAgents?: unknown };

export async function saveLender(db: Db, actor: Actor, id: string, input: LenderInput) {
  const before = await getLender(db, actor, id);
  if (!before) throw new ValidationError("Lender not found");
  const underwriters = [...new Set((input.underwriters ?? []).map((u) => text(u, "Underwriter", 100, false)).filter(Boolean))];
  const defaultUnderwriter = text(input.defaultUnderwriter, "Default Underwriter", 100, false);
  if (defaultUnderwriter && !underwriters.includes(defaultUnderwriter)) throw new ValidationError("The default underwriter must be one of the lender's underwriters");
  const limits: LenderLimits = {};
  for (const [k, name] of limitKeys) if (String(input[k] ?? "").trim()) limits[k] = number(input[k], `${name} (%)`, 100, false);
  const allAgents = input.allAgents === true || input.allAgents === "Yes";
  const agentIds = allAgents ? [] : [...new Set((input.agentIds ?? []).map(String))];
  const found = agentIds.length && agentIds.every((i) => UUID.test(i))
    ? await db.select({ id: users.id }).from(users).where(and(inArray(users.id, agentIds), eq(users.organizationId, actor.organizationId), isNull(users.deactivatedAt)))
    : [];
  if (found.length !== agentIds.length) throw new ValidationError("Submission agents must be active users in your organization");
  if (!allAgents && !agentIds.length) throw new ValidationError("Allow all agents, or add at least one submission agent");
  const values = {
    name: text(input.name, "Lender Name", 100),
    type: pick(input.type, lenderTypes, "lender type"),
    code: text(input.code, "Lender Code", 20, false),
    displayAs: pick(input.displayAs, lenderGroups, "lender group"),
    underwriterType: pick(input.underwriterType, underwriterTypes, "underwriter type"),
    underwriters, defaultUnderwriter, fees: fees(input, lenderFees), limits, allAgents, agentIds,
  };
  await uniqueName(db, actor, values.name, id);
  const was = Object.fromEntries(Object.keys(values).map((k) => [k, before[k as keyof typeof values]]));
  await db.transaction(async (tx) => {
    await tx.update(lenders).set(values).where(eq(lenders.id, id));
    await audit(tx, actor, "lender", id, "update", was, values);
  });
}

// Remove = hide: the lender drops out of deal choices, and its old deals keep the name.
export async function setLenderHidden(db: Db, actor: Actor, id: string, hidden: boolean) {
  const l = await getLender(db, actor, id);
  if (!l) throw new ValidationError("Lender not found");
  await db.transaction(async (tx) => {
    await tx.update(lenders).set({ hiddenAt: hidden ? new Date() : null }).where(eq(lenders.id, id));
    await audit(tx, actor, "lender", id, hidden ? "hide" : "unhide", null, null);
  });
}

export async function saveProduct(db: Db, actor: Actor, lenderId: string, id: string | null, input: Record<string, unknown>) {
  const lender = await getLender(db, actor, lenderId);
  if (!lender) throw new ValidationError("Lender not found");
  const values = { name: text(input.name, "Product Name", 100), term: number(input.term, "Term (years)", 40, true), fees: fees(input, productFees) };
  if (lender.products.some((p) => p.id !== id && p.name.toLowerCase() === values.name.toLowerCase())) throw new ValidationError(`${lender.name} already has a product with this name`);
  const before = id ? lender.products.find((p) => p.id === id) : null;
  if (id && !before) throw new ValidationError("Product not found");
  return db.transaction(async (tx) => {
    if (!before) {
      const [p] = await tx.insert(lenderProducts).values({ ...values, lenderId }).returning({ id: lenderProducts.id });
      await audit(tx, actor, "lender_product", p.id, "create", null, { lenderId, ...values });
      return p.id;
    }
    await tx.update(lenderProducts).set(values).where(eq(lenderProducts.id, before.id));
    await audit(tx, actor, "lender_product", before.id, "update", { name: before.name, term: before.term, fees: before.fees }, values);
    return before.id;
  });
}

// Products are deleted outright; deals keep the product's name as text.
export async function deleteProduct(db: Db, actor: Actor, lenderId: string, id: string) {
  const p = (await getLender(db, actor, lenderId))?.products.find((x) => x.id === id);
  if (!p) throw new ValidationError("Product not found");
  await db.transaction(async (tx) => {
    await tx.delete(lenderProducts).where(eq(lenderProducts.id, id));
    await audit(tx, actor, "lender_product", id, "delete", p, null);
  });
}

// ---- Used by deals

export type LenderChoice = { name: string; group: string; products: string[]; limits: LenderLimits };

// Active lenders the deal's agent may submit to. ponytail: loads every lender and product; fine for a few hundred.
export async function lenderChoices(db: Db, organizationId: string, agentId: string): Promise<LenderChoice[]> {
  const ls = await db.select().from(lenders).where(and(eq(lenders.organizationId, organizationId), isNull(lenders.hiddenAt))).orderBy(asc(lenders.name));
  const usable = ls.filter((l) => l.allAgents || l.agentIds.includes(agentId));
  const ps = usable.length ? await db.select().from(lenderProducts).where(inArray(lenderProducts.lenderId, usable.map((l) => l.id))).orderBy(asc(lenderProducts.name)) : [];
  return usable.map((l) => ({ name: l.name, group: l.displayAs, products: ps.filter((p) => p.lenderId === l.id).map((p) => p.name), limits: l.limits }));
}
