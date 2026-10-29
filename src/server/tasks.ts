// Tasks: My Day, a deal's reminders and tasks, and the calendar all read and write this one table.
// Deal reminders (closing / conditions dates coming up) are derived from the deals, not stored.
import { and, asc, eq, gte, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { addDays, isDay } from "../lib/dates.ts";
import { dealScope, dealViewers, Forbidden, type Actor } from "./access.ts";
import { defaultSettings, getOrganization } from "./admin.ts";
import { audit } from "./audit.ts";
import { ValidationError } from "./contacts.ts";
import type { Db } from "./db.ts";
import { listDeals } from "./deals.ts";
import { contacts, dealBorrowers, deals, tasks, taskType, users } from "./schema.ts";

export type TaskType = (typeof taskType.enumValues)[number];

const UUID = /^[0-9a-f-]{36}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:00)?$/;

// ponytail: one time zone for everyone; store a zone per user or office once an office opens outside it.
export const TIME_ZONE = process.env.TIME_ZONE ?? "America/Toronto";
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

// A task is visible to its assignee, its creator, and anyone who can see its deal. The deal is joined only when
// the actor can see it, so deal and borrower details never leak through a task.
const visibleDeals = (actor: Actor) => and(eq(deals.id, tasks.dealId), dealScope(actor));
const taskScope = (actor: Actor) =>
  and(eq(tasks.organizationId, actor.organizationId), isNull(tasks.deletedAt), or(eq(tasks.assigneeId, actor.id), eq(tasks.createdBy, actor.id), isNotNull(deals.id)))!;

function selectTasks(db: Db, actor: Actor) {
  return db
    .select({
      id: tasks.id, type: tasks.type, title: tasks.title, dueDate: tasks.dueDate, dueTime: sql<string | null>`to_char(${tasks.dueTime}, 'HH24:MI')`,
      notes: tasks.notes, done: sql<boolean>`${tasks.doneAt} is not null`, assigneeId: tasks.assigneeId, assignee: users.name,
      dealId: deals.id, dealNumber: deals.number, firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.email,
      phone: sql<string | null>`coalesce(${contacts.cellPhone}, ${contacts.homePhone}, ${contacts.workPhone})`,
    })
    .from(tasks)
    .innerJoin(users, eq(users.id, tasks.assigneeId))
    .leftJoin(deals, visibleDeals(actor))
    .leftJoin(dealBorrowers, and(eq(dealBorrowers.dealId, deals.id), eq(dealBorrowers.position, 0)))
    .leftJoin(contacts, eq(contacts.id, dealBorrowers.contactId))
    .$dynamic();
}

export type TaskRow = Awaited<ReturnType<typeof myDay>>[number];
const order = [asc(tasks.dueDate), sql`${tasks.dueTime} nulls first`, asc(tasks.title)];

// My tasks due on `date`; on today, also my open overdue ones.
export function myDay(db: Db, actor: Actor, date: string, now = today()) {
  const due = date === now ? or(eq(tasks.dueDate, date), and(lt(tasks.dueDate, now), isNull(tasks.doneAt))) : eq(tasks.dueDate, date);
  return selectTasks(db, actor).where(and(taskScope(actor), eq(tasks.assigneeId, actor.id), due)).orderBy(...order);
}

export function calendarTasks(db: Db, actor: Actor, from: string, to: string) {
  return selectTasks(db, actor).where(and(taskScope(actor), eq(tasks.assigneeId, actor.id), gte(tasks.dueDate, from), lte(tasks.dueDate, to))).orderBy(...order);
}

// For the top bar badge: my open tasks due today or earlier.
export async function openTaskCount(db: Db, actor: Actor, now = today()) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(tasks)
    .where(and(eq(tasks.organizationId, actor.organizationId), eq(tasks.assigneeId, actor.id), isNull(tasks.deletedAt), isNull(tasks.doneAt), lte(tasks.dueDate, now)));
  return r.n;
}

// The users a deal's tasks can be assigned to: everyone who can open the deal.
export async function assignableUsers(db: Db, actor: Actor, dealId: string) {
  const [deal] = UUID.test(dealId)
    ? await db.select({ organizationId: deals.organizationId, officeId: deals.officeId, agentId: deals.agentId }).from(deals).where(and(eq(deals.id, dealId), dealScope(actor)))
    : [];
  if (!deal) throw new Forbidden("Deal not found");
  return db.select({ id: users.id, name: users.name }).from(users).where(dealViewers(deal)).orderBy(asc(users.name));
}

export async function dealTasks(db: Db, actor: Actor, dealId: string) {
  const assignees = await assignableUsers(db, actor, dealId);
  const rows = await selectTasks(db, actor).where(and(taskScope(actor), eq(tasks.dealId, dealId))).orderBy(...order);
  return { dealId, tasks: rows, assignees };
}

async function visibleTask(db: Db, actor: Actor, id: string) {
  const [row] = UUID.test(id) ? await db.select({ t: tasks }).from(tasks).leftJoin(deals, visibleDeals(actor)).where(and(eq(tasks.id, id), taskScope(actor))) : [];
  if (!row) throw new Forbidden("Task not found");
  return row.t;
}

// A personal task (no deal) is always its creator's; a deal task goes to someone who can open the deal.
async function checkAssignee(db: Db, actor: Actor, dealId: string | null, assigneeId: unknown) {
  const id = typeof assigneeId === "string" && assigneeId ? assigneeId : actor.id;
  if (!dealId) {
    if (id !== actor.id) throw new ValidationError("A task without a deal can only be assigned to yourself");
    return id;
  }
  if (!(await assignableUsers(db, actor, dealId)).some((u) => u.id === id)) throw new ValidationError("That person can't open this deal");
  return id;
}

function clean(input: Record<string, unknown>) {
  const str = (k: string) => (typeof input[k] === "string" ? (input[k] as string).trim() : "");
  const type = input.type as TaskType;
  if (!taskType.enumValues.includes(type)) throw new ValidationError("Unknown task type");
  const title = str("title");
  if (!title || title.length > 200) throw new ValidationError("A task needs a title of up to 200 characters");
  const dueDate = str("dueDate");
  if (!isDay(dueDate)) throw new ValidationError("A task needs a valid date");
  const time = str("dueTime");
  if (time && !TIME.test(time)) throw new ValidationError("Time must be HH:MM");
  const notes = str("notes");
  if (notes.length > 2000) throw new ValidationError("Notes are too long");
  return { type, title, dueDate, dueTime: time ? time.slice(0, 5) : null, notes: notes || null };
}

export async function createTask(db: Db, actor: Actor, input: Record<string, unknown>) {
  const values = clean(input);
  const dealId = typeof input.dealId === "string" && input.dealId ? input.dealId : null;
  const assigneeId = await checkAssignee(db, actor, dealId, input.assigneeId);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(tasks).values({ ...values, dealId, assigneeId, organizationId: actor.organizationId, createdBy: actor.id }).returning();
    await audit(tx, actor, "task", row.id, "create", null, row);
    return row;
  });
}

// Only the keys sent change; `done: true / false` sets or clears the done time.
export async function updateTask(db: Db, actor: Actor, id: string, input: Record<string, unknown>) {
  const t = await visibleTask(db, actor, id);
  const old = { ...clean({ ...t, dueTime: t.dueTime ?? "", notes: t.notes ?? "" }), assigneeId: t.assigneeId, done: !!t.doneAt };
  const next = {
    ...clean({ ...old, dueTime: old.dueTime ?? "", notes: old.notes ?? "", ...input }),
    assigneeId: "assigneeId" in input ? await checkAssignee(db, actor, t.dealId, input.assigneeId) : t.assigneeId,
    done: "done" in input ? input.done === true : old.done,
  };
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => old[k] !== next[k]);
  if (!changed.length) return t;
  const { done, ...cols } = next;
  return db.transaction(async (tx) => {
    const [row] = await tx.update(tasks).set({ ...cols, doneAt: done ? (t.doneAt ?? new Date()) : null, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
    const pick = (o: typeof old) => Object.fromEntries(changed.map((k) => [k, o[k]]));
    await audit(tx, actor, "task", id, "update", pick(old), pick(next));
    return row;
  });
}

export async function removeTask(db: Db, actor: Actor, id: string) {
  const t = await visibleTask(db, actor, id);
  await db.transaction(async (tx) => {
    await tx.update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, id));
    await audit(tx, actor, "task", id, "remove", { title: t.title }, null);
  });
}

// My Day's bulk buttons. Postpone moves a task to the day after today or after its date, whichever is later,
// so an overdue task doesn't stay overdue.
export async function bulkTasks(db: Db, actor: Actor, ids: unknown, op: unknown, now = today()) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 200) throw new ValidationError("Select between 1 and 200 tasks");
  if (op !== "done" && op !== "postpone" && op !== "remove") throw new ValidationError("Unknown action");
  const list = await Promise.all(ids.map((id) => visibleTask(db, actor, String(id))));
  await db.transaction(async (tx) => {
    for (const t of list) {
      const set =
        op === "done" ? { doneAt: t.doneAt ?? new Date() }
        : op === "remove" ? { deletedAt: new Date() }
        : { dueDate: addDays(t.dueDate > now ? t.dueDate : now, 1) };
      await tx.update(tasks).set({ ...set, updatedAt: new Date() }).where(eq(tasks.id, t.id));
      await audit(tx, actor, "task", t.id, op, op === "postpone" ? { dueDate: t.dueDate } : null, op === "postpone" ? set : null);
    }
  });
}

export type ReminderLevel = "Urgent" | "Warning" | "Notice";
const activeStatuses = ["pre_approval", "new_deal", "submitted", "approved", "accepted", "waiting_to_close"] as const;

// Days to the nearer date against the organization's thresholds (default 2 / 7 / 14); past dates are urgent.
export function reminderLevel(dates: (string | null)[], now: string, t = defaultSettings.reminders): ReminderLevel | null {
  const days = dates.filter(isDay).map((d) => (Date.parse(d) - Date.parse(now)) / 864e5);
  if (!days.length) return null;
  const n = Math.min(...days);
  return n <= t.urgent ? "Urgent" : n <= t.warning ? "Warning" : n <= t.notice ? "Notice" : null;
}

// Active deals with a closing or conditions date coming up. The conditions date stops counting once
// "Lender Conditions Met" is ticked.
export async function dealReminders(db: Db, actor: Actor, now = today()) {
  const rows = await listDeals(db, actor, [...activeStatuses]);
  const { reminders } = (await getOrganization(db, actor.organizationId)).settings;
  return rows
    .map((d) => ({ ...d, level: reminderLevel([d.closingDate, d.conditionsMet === "Yes" ? null : d.conditionsDate], now, reminders) }))
    .filter((d): d is typeof d & { level: ReminderLevel } => d.level !== null)
    .sort((a, b) => ["Urgent", "Warning", "Notice"].indexOf(a.level) - ["Urgent", "Warning", "Notice"].indexOf(b.level));
}
