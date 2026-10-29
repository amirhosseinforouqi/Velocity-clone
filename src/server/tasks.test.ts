// Tasks, My Day, the calendar range and deal reminders against an in-memory Postgres: `npm test`.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { addDays, calendarDays, isDay } from "../lib/dates.ts";
import type { Actor } from "./access.ts";
import { listContacts } from "./contacts.ts";
import { createDeal, saveDeal } from "./deals.ts";
import { openDb, type Db } from "./db.ts";
import { auditLog, users } from "./schema.ts";
import { seedIfEmpty } from "./seed.ts";
import { bulkTasks, calendarTasks, createTask, dealReminders, dealTasks, myDay, openTaskCount, reminderLevel, removeTask, updateTask } from "./tasks.ts";

let db: Db;
const as: Record<string, Actor> = {};
const NOW = "2026-03-10";
const task = (input: Record<string, unknown> = {}, actor = as.agent) => createTask(db, actor, { type: "phone", title: "Call about appraisal", dueDate: NOW, ...input });

before(async () => {
  db = await openDb();
  await seedIfEmpty(db);
  for (const u of await db.select().from(users)) as[u.email.split("@")[0]] = u;
});

async function newApplication(actor = as.agent) {
  const [contact] = await listContacts(db, actor);
  return createDeal(db, actor, contact.id, { status: "new_deal" });
}

test("day strings: validation, arithmetic across month ends, calendar grids", () => {
  assert.ok(isDay("2026-02-28") && !isDay("2026-02-30") && !isDay("2026-2-1") && !isDay(null));
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  const month = calendarDays("month", "2026-03-18");
  assert.equal(month.length, 42);
  assert.equal(month[0], "2026-03-01"); // March 2026 starts on a Sunday
  assert.deepEqual(calendarDays("week", "2026-03-18"), ["2026-03-15", "2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19", "2026-03-20", "2026-03-21"]);
});

test("validation rejects bad input", async () => {
  await assert.rejects(task({ type: "fax" }), /Unknown task type/);
  await assert.rejects(task({ title: " " }), /title/);
  await assert.rejects(task({ dueDate: "2026-02-30" }), /valid date/);
  await assert.rejects(task({ dueTime: "25:00" }), /HH:MM/);
});

test("a personal task is private and only its creator's", async () => {
  const t = await task({ type: "personal", title: "Dentist" });
  assert.equal(t.assigneeId, as.agent.id);
  await assert.rejects(task({ assigneeId: as.agent2.id }), /only be assigned to yourself/);
  await assert.rejects(updateTask(db, as.admin, t.id, { title: "x" }), /Task not found/);
  await assert.rejects(removeTask(db, as.agent2, t.id), /Task not found/);
});

test("deal tasks go to people who can open the deal, and everyone who can see the deal sees them", async () => {
  const deal = await newApplication();
  const { assignees } = await dealTasks(db, as.agent, deal.id);
  const ids = assignees.map((u) => u.id);
  for (const ok of [as.agent, as.admin, as["office.admin"], as.assistant]) assert.ok(ids.includes(ok.id));
  for (const no of [as.agent2, as["ottawa.agent"]]) assert.ok(!ids.includes(no.id));

  await assert.rejects(task({ dealId: deal.id, assigneeId: as.agent2.id }), /can't open this deal/);
  await assert.rejects(task({ dealId: deal.id }, as.agent2), /Deal not found/);
  const t = await task({ dealId: deal.id, assigneeId: as.assistant.id, type: "followup", title: "Chase pay stub" });

  assert.equal((await dealTasks(db, as["office.admin"], deal.id)).tasks.length, 1);
  await assert.rejects(dealTasks(db, as.agent2, deal.id), /Deal not found/);
  const [mine] = await myDay(db, as.assistant, NOW, NOW);
  assert.equal(mine.id, t.id);
  assert.equal(mine.dealNumber, deal.number);
});

test("My Day: that day's tasks, plus open overdue ones on today; done, postpone and remove", async () => {
  const actor = as.agent2;
  const old = await task({ title: "Overdue", dueDate: addDays(NOW, -3), dueTime: "09:30" }, actor);
  const done = await task({ title: "Overdue but done", dueDate: addDays(NOW, -2) }, actor);
  await updateTask(db, actor, done.id, { done: true });
  const now = await task({ title: "Today" }, actor);
  await task({ title: "Tomorrow", dueDate: addDays(NOW, 1) }, actor);

  assert.deepEqual((await myDay(db, actor, NOW, NOW)).map((t) => t.title), ["Overdue", "Today"]);
  assert.equal((await myDay(db, actor, NOW, NOW))[0].dueTime, "09:30");
  assert.deepEqual((await myDay(db, actor, addDays(NOW, -3), NOW)).map((t) => t.title), ["Overdue"]);
  assert.equal(await openTaskCount(db, actor, NOW), 2);

  await bulkTasks(db, actor, [old.id], "postpone", NOW);
  await bulkTasks(db, actor, [now.id], "done", NOW);
  assert.deepEqual((await myDay(db, actor, NOW, NOW)).map((t) => [t.title, t.done]), [["Today", true]]);
  assert.deepEqual((await myDay(db, actor, addDays(NOW, 1), NOW)).map((t) => t.title).sort(), ["Overdue", "Tomorrow"]);
  await assert.rejects(bulkTasks(db, actor, [now.id], "send", NOW), /Unknown action/);
  await assert.rejects(bulkTasks(db, as.agent, [now.id], "remove", NOW), /Task not found/); // not agent's task
  await bulkTasks(db, actor, [now.id], "remove", NOW);
  assert.equal((await myDay(db, actor, NOW, NOW)).length, 0);
});

test("updates change only what was sent, audit the diff, and the calendar reads a date range", async () => {
  const t = await task({ title: "Meet at branch", type: "appointment", dueDate: "2026-04-02", dueTime: "14:00" }, as.assistant);
  await updateTask(db, as.assistant, t.id, { dueDate: "2026-04-03" });
  const [row] = await calendarTasks(db, as.assistant, "2026-04-01", "2026-04-30");
  assert.deepEqual([row.title, row.dueDate, row.dueTime], ["Meet at branch", "2026-04-03", "14:00"]);
  const logs = await db.select().from(auditLog).where(and(eq(auditLog.entityId, t.id), eq(auditLog.action, "update")));
  assert.deepEqual([logs[0].before, logs[0].after], [{ dueDate: "2026-04-02" }, { dueDate: "2026-04-03" }]);
  assert.equal((await calendarTasks(db, as.assistant, "2026-05-01", "2026-05-31")).length, 0);
});

test("deal reminders: level from the nearer date; ticking conditions met drops the conditions date", async () => {
  assert.equal(reminderLevel([null, null], NOW), null);
  assert.equal(reminderLevel([addDays(NOW, -1)], NOW), "Urgent");
  assert.equal(reminderLevel([addDays(NOW, 30), addDays(NOW, 2)], NOW), "Urgent");
  assert.equal(reminderLevel([addDays(NOW, 7)], NOW), "Warning");
  assert.equal(reminderLevel([addDays(NOW, 14)], NOW), "Notice");
  assert.equal(reminderLevel([addDays(NOW, 15)], NOW), null);

  const deal = await newApplication(as["ottawa.agent"]);
  await saveDeal(db, as["ottawa.agent"], deal.id, { closingDate: addDays(NOW, 10), conditionsDate: addDays(NOW, 1) });
  const level = async () => (await dealReminders(db, as["ottawa.agent"], NOW)).find((d) => d.id === deal.id)?.level;
  assert.equal(await level(), "Urgent");
  await saveDeal(db, as["ottawa.agent"], deal.id, { "conditions//Lender Conditions Met": "Yes" });
  assert.equal(await level(), "Notice");
  assert.ok(!(await dealReminders(db, as.agent, NOW)).some((d) => d.id === deal.id)); // other office
});
