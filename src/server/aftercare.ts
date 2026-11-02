// After Care: recurring client touches on a deal (RevoDoc's After Care). An item that is due shows on My Day until
// staff mark it done, which counts the touch and moves Next Date on by the period. Keyway never sends anything itself.
import { and, asc, eq, lte } from "drizzle-orm";
import { isDay } from "../lib/dates.ts";
import { dealScope, Forbidden, type Actor } from "./access.ts";
import { text } from "./admin.ts";
import { audit } from "./audit.ts";
import { ValidationError } from "./contacts.ts";
import type { Db } from "./db.ts";
import { getDeal } from "./deals.ts";
import { aftercare, deals } from "./schema.ts";

// Month-end safe: Jan 31 + 1 month is Feb 28/29.
export function addMonths(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
}

async function mustSee(db: Db, actor: Actor, dealId: string) {
  if (!(await getDeal(db, actor, dealId))) throw new Forbidden("Deal not found");
}

export async function listAftercare(db: Db, actor: Actor, dealId: string) {
  await mustSee(db, actor, dealId);
  return db.select().from(aftercare).where(eq(aftercare.dealId, dealId)).orderBy(asc(aftercare.nextDate));
}

export type AftercareInput = { label: unknown; nextDate: unknown; periodMonths: unknown; maxTimes: unknown; active: unknown };

export async function saveAftercare(db: Db, actor: Actor, dealId: string, id: string | null, input: AftercareInput) {
  await mustSee(db, actor, dealId);
  if (!isDay(input.nextDate)) throw new ValidationError("Enter the next date");
  const whole = (v: unknown, label: string, max: number) => {
    const n = Number(v ?? 0);
    if (!Number.isInteger(n) || n < 0 || n > max) throw new ValidationError(`${label} must be a whole number from 0 to ${max}`);
    return n;
  };
  const values = {
    label: text(input.label, "Label", 100), nextDate: input.nextDate, periodMonths: whole(input.periodMonths, "Period (months)", 120),
    maxTimes: whole(input.maxTimes, "Max times", 100), active: input.active !== false,
  };
  return db.transaction(async (tx) => {
    if (!id) {
      const [row] = await tx.insert(aftercare).values({ ...values, dealId, organizationId: actor.organizationId, createdBy: actor.id }).returning();
      await audit(tx, actor, "deal", dealId, "aftercare_create", null, values);
      return row.id;
    }
    const [before] = await tx.select().from(aftercare).where(and(eq(aftercare.id, id), eq(aftercare.dealId, dealId)));
    if (!before) throw new Forbidden("After care item not found");
    await tx.update(aftercare).set(values).where(eq(aftercare.id, id));
    await audit(tx, actor, "deal", dealId, "aftercare_update", { label: before.label, nextDate: before.nextDate, active: before.active }, values);
    return id;
  });
}

// Counts the touch and moves Next Date on one period. A one-off item (period 0) or one that reached Max Times turns off.
export async function aftercareDone(db: Db, actor: Actor, id: string, now: string) {
  const [item] = await db.select().from(aftercare).where(and(eq(aftercare.id, id), eq(aftercare.organizationId, actor.organizationId)));
  if (!item) throw new Forbidden("After care item not found");
  await mustSee(db, actor, item.dealId);
  if (!item.active) throw new ValidationError(`"${item.label}" is turned off`);
  if (item.nextDate > now) throw new ValidationError(`"${item.label}" isn't due until ${item.nextDate}`);
  const timesDone = item.timesDone + 1;
  const finished = !item.periodMonths || (item.maxTimes > 0 && timesDone >= item.maxTimes);
  const next = { timesDone, active: !finished, nextDate: finished ? item.nextDate : addMonths(item.nextDate, item.periodMonths) };
  await db.transaction(async (tx) => {
    await tx.update(aftercare).set(next).where(eq(aftercare.id, id));
    await audit(tx, actor, "deal", item.dealId, "aftercare_done", { label: item.label, nextDate: item.nextDate }, next);
  });
}

// What My Day lists: active items due on or before the day, on deals the actor can see.
export function dueAftercare(db: Db, actor: Actor, date: string) {
  return db.select({ id: aftercare.id, label: aftercare.label, nextDate: aftercare.nextDate, timesDone: aftercare.timesDone, maxTimes: aftercare.maxTimes, dealId: deals.id, number: deals.number })
    .from(aftercare).innerJoin(deals, eq(deals.id, aftercare.dealId))
    .where(and(dealScope(actor), eq(aftercare.active, true), lte(aftercare.nextDate, date)))
    .orderBy(asc(aftercare.nextDate), asc(deals.number));
}
export type DueAftercare = Awaited<ReturnType<typeof dueAftercare>>[number];
