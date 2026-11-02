// Progress steps per deal type (RevoDoc's progress templates, edited on /workflows) and each deal's step checklist.
// A step's todos and auto message become tasks when staff press Create Tasks; Keyway never sends the auto message.
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { addDays, isDay } from "../lib/dates.ts";
import { selectOptions } from "../components/platform/deal-sections.ts";
import { Forbidden, type Actor } from "./access.ts";
import { mustOrgAdmin, text } from "./admin.ts";
import { listAftercare } from "./aftercare.ts";
import { audit } from "./audit.ts";
import { ValidationError } from "./contacts.ts";
import type { Db } from "./db.ts";
import { getDeal } from "./deals.ts";
import { dealSteps, progressSteps, tasks } from "./schema.ts";
import { today } from "./tasks.ts";

export const dealTypes = selectOptions["Application Type"];
export const DEAL_TYPE = "mortgageRequest/Mortgage Breakdown/Application Type";

export function listProgressSteps(db: Db, actor: Actor) {
  return db.select().from(progressSteps).where(eq(progressSteps.organizationId, actor.organizationId)).orderBy(asc(progressSteps.dealType), asc(progressSteps.position));
}

export type StepInput = { dealType: unknown; name: unknown; position: unknown; days: unknown; milestone: unknown; todos: unknown; autoMessage: unknown; prerequisiteId: unknown; active: unknown };

export async function saveProgressStep(db: Db, actor: Actor, id: string | null, input: StepInput) {
  mustOrgAdmin(actor);
  const dealType = String(input.dealType ?? "");
  if (!dealTypes.includes(dealType)) throw new ValidationError("Choose a deal type");
  const whole = (v: unknown, label: string, max: number) => {
    const n = Number(v ?? 0);
    if (!Number.isInteger(n) || n < 0 || n > max) throw new ValidationError(`${label} must be a whole number from 0 to ${max}`);
    return n;
  };
  const todos = (Array.isArray(input.todos) ? input.todos : []).map((t) => text(t, "Todo", 200, false)).filter(Boolean);
  if (todos.length > 20) throw new ValidationError("Up to 20 todos per step");
  const values = {
    dealType, name: text(input.name, "Step", 100), position: whole(input.position, "Order", 999), days: whole(input.days, "Days", 365),
    milestone: input.milestone === true, todos, autoMessage: text(input.autoMessage, "Auto message", 500, false),
    prerequisiteId: input.prerequisiteId ? String(input.prerequisiteId) : null, active: input.active !== false,
  };
  return db.transaction(async (tx) => {
    const steps = await tx.select().from(progressSteps).where(eq(progressSteps.organizationId, actor.organizationId));
    const before = id ? steps.find((s) => s.id === id) : undefined;
    if (id && !before) throw new Forbidden("Step not found");
    if (before && before.dealType !== dealType) throw new ValidationError("A step can't move to another deal type");
    // Following prerequisites from here must stay within the deal type and never come back to this step.
    for (let p = values.prerequisiteId; p; ) {
      const s = steps.find((x) => x.id === p);
      if (!s || s.dealType !== dealType) throw new ValidationError("The prerequisite must be a step of the same deal type");
      if (s.id === id) throw new ValidationError("Two steps can't each need the other first");
      p = s.prerequisiteId;
    }
    if (!before) {
      const [s] = await tx.insert(progressSteps).values({ ...values, organizationId: actor.organizationId }).returning({ id: progressSteps.id });
      await audit(tx, actor, "progress_step", s.id, "create", null, values);
      return s.id;
    }
    await tx.update(progressSteps).set(values).where(eq(progressSteps.id, before.id));
    await audit(tx, actor, "progress_step", before.id, "update", before, values);
    return before.id;
  });
}

// Active steps for the deal's type (its Application Type field).
async function dealAndSteps(db: Db, actor: Actor, dealId: string) {
  const deal = await getDeal(db, actor, dealId);
  if (!deal) throw new Forbidden("Deal not found");
  const dealType = deal.fields[DEAL_TYPE] ?? "";
  const steps = await db.select().from(progressSteps)
    .where(and(eq(progressSteps.organizationId, deal.organizationId), eq(progressSteps.dealType, dealType), eq(progressSteps.active, true)))
    .orderBy(asc(progressSteps.position), asc(progressSteps.name));
  return { deal, dealType, steps };
}

// Targets count days from the day the deal was created.
export async function dealProgress(db: Db, actor: Actor, dealId: string) {
  const { deal, dealType, steps } = await dealAndSteps(db, actor, dealId);
  const done = await db.select().from(dealSteps).where(eq(dealSteps.dealId, dealId));
  const made = await db.selectDistinct({ stepId: tasks.stepId }).from(tasks).where(and(eq(tasks.dealId, dealId), isNull(tasks.deletedAt)));
  const start = today(deal.createdAt);
  return {
    dealId, dealType,
    steps: steps.map((s) => ({
      id: s.id, name: s.name, milestone: s.milestone, todos: s.todos, autoMessage: s.autoMessage, target: addDays(start, s.days),
      prerequisite: steps.find((p) => p.id === s.prerequisiteId)?.name ?? null,
      completedOn: done.find((d) => d.stepId === s.id)?.completedOn ?? null,
      tasksCreated: made.some((m) => m.stepId === s.id),
    })),
    aftercare: await listAftercare(db, actor, dealId),
  };
}

// A step is open once its prerequisite is complete. An inactive prerequisite no longer blocks.
async function openStep(db: Db, actor: Actor, dealId: string, stepId: string) {
  const { deal, steps } = await dealAndSteps(db, actor, dealId);
  const step = steps.find((s) => s.id === stepId);
  if (!step) throw new Forbidden("Step not found");
  const prereq = steps.find((s) => s.id === step.prerequisiteId);
  if (prereq) {
    const [d] = await db.select().from(dealSteps).where(and(eq(dealSteps.dealId, dealId), eq(dealSteps.stepId, prereq.id)));
    if (!d) throw new ValidationError(`Complete "${prereq.name}" first`);
  }
  return { deal, step, steps };
}

export async function completeStep(db: Db, actor: Actor, dealId: string, stepId: string, on: unknown) {
  const { step } = await openStep(db, actor, dealId, stepId);
  if (!isDay(on)) throw new ValidationError("Enter the date the step was completed");
  await db.transaction(async (tx) => {
    const [row] = await tx.insert(dealSteps).values({ dealId, stepId, completedOn: on, completedBy: actor.id }).onConflictDoNothing().returning();
    if (!row) throw new ValidationError(`"${step.name}" is already complete`);
    await audit(tx, actor, "deal", dealId, "step_complete", null, { name: step.name, completedOn: on });
  });
}

export async function reopenStep(db: Db, actor: Actor, dealId: string, stepId: string) {
  const { steps } = await dealAndSteps(db, actor, dealId);
  const step = steps.find((s) => s.id === stepId);
  if (!step) throw new Forbidden("Step not found");
  const next = steps.filter((s) => s.prerequisiteId === stepId).map((s) => s.id);
  const [blocked] = next.length ? await db.select().from(dealSteps).where(and(eq(dealSteps.dealId, dealId), inArray(dealSteps.stepId, next))) : [];
  if (blocked) throw new ValidationError(`Reopen the steps that need "${step.name}" first`);
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(dealSteps).where(and(eq(dealSteps.dealId, dealId), eq(dealSteps.stepId, stepId))).returning();
    if (!row) throw new ValidationError(`"${step.name}" is not complete`);
    await audit(tx, actor, "deal", dealId, "step_reopen", { name: step.name, completedOn: row.completedOn }, null);
  });
}

// Todos become follow-up tasks and the auto message an email reminder, assigned to the actor and due on the
// step's target date (today once that has passed). Once per step, unless those tasks are removed.
export async function createStepTasks(db: Db, actor: Actor, dealId: string, stepId: string) {
  const { deal, step } = await openStep(db, actor, dealId, stepId);
  const [exists] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.dealId, dealId), eq(tasks.stepId, stepId), isNull(tasks.deletedAt))).limit(1);
  if (exists) throw new ValidationError(`Tasks for "${step.name}" already exist`);
  const rows = [
    ...step.todos.map((title) => ({ type: "followup" as const, title, notes: null })),
    ...(step.autoMessage ? [{ type: "email" as const, title: `Send: ${step.name}`, notes: `${step.autoMessage}\n\nAuto message from the progress step. Keyway does not send it.` }] : []),
  ];
  if (!rows.length) throw new ValidationError(`"${step.name}" has no todos or auto message`);
  const now = today();
  const target = addDays(today(deal.createdAt), step.days);
  const dueDate = target < now ? now : target;
  await db.transaction(async (tx) => {
    const made = await tx.insert(tasks).values(rows.map((r) => ({ ...r, dueDate, dealId, stepId, assigneeId: actor.id, createdBy: actor.id, organizationId: actor.organizationId }))).returning();
    for (const t of made) await audit(tx, actor, "task", t.id, "create", null, t);
  });
}
