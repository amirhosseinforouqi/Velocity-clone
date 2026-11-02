// Tasks, My Day, the calendar range and deal reminders against an in-memory Postgres: `npm test`.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { addDays, calendarDays, isDay } from "../lib/dates.ts";
import type { Actor } from "./access.ts";
import { listContacts } from "./contacts.ts";
import { createDeal, saveDeal } from "./deals.ts";
import { openDb, type Db } from "./db.ts";
import { addMonths, aftercareDone, dueAftercare, saveAftercare } from "./aftercare.ts";
import { runReport } from "./reports.ts";
import { completeStep, createStepTasks, DEAL_TYPE, dealProgress, reopenStep, saveProgressStep } from "./progress.ts";
import { auditLog, tasks, users } from "./schema.ts";
import { seedIfEmpty } from "./seed.ts";
import { bulkTasks, calendarTasks, createTask, dealReminders, dealTasks, myDay, openTaskCount, reminderLevel, removeTask, today, updateTask } from "./tasks.ts";

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

test("progress steps: a checklist per deal type, prerequisites, tasks from todos, scope", async () => {
  const step = (x = {}) => ({ dealType: "Purchase", name: "Step", position: 0, days: 0, milestone: false, todos: [], autoMessage: "", prerequisiteId: null, active: true, ...x });
  await assert.rejects(saveProgressStep(db, as.agent, null, step()), /organization admin/);
  const appraisal = await saveProgressStep(db, as.admin, null, step({ name: "Order appraisal", position: 1, days: 2, todos: ["Book appraiser", " "], autoMessage: "Your appraisal is booked." }));
  const approval = await saveProgressStep(db, as.admin, null, step({ name: "Lender approval", position: 2, days: 10, milestone: true, prerequisiteId: appraisal }));
  await saveProgressStep(db, as.admin, null, step({ dealType: "Refinance", name: "Payout statement" }));
  await assert.rejects(saveProgressStep(db, as.admin, appraisal, step({ name: "Order appraisal", prerequisiteId: approval })), /each need/);
  await assert.rejects(saveProgressStep(db, as.admin, appraisal, step({ dealType: "Refinance" })), /another deal type/);

  const deal = await newApplication();
  await saveDeal(db, as.agent, deal.id, { [DEAL_TYPE]: "Purchase" });
  const p = await dealProgress(db, as.agent, deal.id);
  assert.deepEqual(p.steps.map((s) => [s.name, s.prerequisite]), [["Order appraisal", null], ["Lender approval", "Order appraisal"]]);
  assert.equal(p.steps[0].target, addDays(today(), 2));

  await assert.rejects(completeStep(db, as.agent, deal.id, approval, today()), /Complete "Order appraisal" first/);
  await assert.rejects(createStepTasks(db, as.agent, deal.id, approval), /Complete "Order appraisal" first/);
  await assert.rejects(completeStep(db, as.agent, deal.id, appraisal, "2026-02-30"), /date/);
  await completeStep(db, as.agent, deal.id, appraisal, "2026-10-01");
  await assert.rejects(completeStep(db, as.agent, deal.id, appraisal, "2026-10-01"), /already complete/);
  await completeStep(db, as.agent, deal.id, approval, today());
  await assert.rejects(reopenStep(db, as.agent, deal.id, appraisal), /Reopen the steps/);
  await reopenStep(db, as.agent, deal.id, approval);

  await createStepTasks(db, as.agent, deal.id, appraisal);
  const made = await db.select().from(tasks).where(eq(tasks.stepId, appraisal));
  assert.deepEqual(made.map((t) => [t.type, t.title, t.dueDate, t.assigneeId]).sort(), [
    ["email", "Send: Order appraisal", addDays(today(), 2), as.agent.id],
    ["followup", "Book appraiser", addDays(today(), 2), as.agent.id],
  ]);
  await assert.rejects(createStepTasks(db, as.agent, deal.id, appraisal), /already exist/);
  assert.equal((await dealProgress(db, as.agent, deal.id)).steps[0].tasksCreated, true);

  const other = as["ottawa.agent"];
  await assert.rejects(dealProgress(db, other, deal.id), /not found/);
  await assert.rejects(completeStep(db, other, deal.id, approval, today()), /not found/);
});

test("after care: due on My Day, done rolls the date on, max times and turning off stop it; maturities report", async () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-11-15", 12), "2027-11-15");
  const deal = await newApplication();
  const item = (x = {}) => ({ label: "Annual review", nextDate: NOW, periodMonths: 12, maxTimes: 2, active: true, ...x });
  await assert.rejects(saveAftercare(db, as.agent2, deal.id, null, item()), /Deal not found/);
  await assert.rejects(saveAftercare(db, as.agent, deal.id, null, item({ nextDate: "soon" })), /next date/);
  const id = await saveAftercare(db, as.agent, deal.id, null, item());
  const once = await saveAftercare(db, as.agent, deal.id, null, item({ label: "Closing gift", periodMonths: 0 }));
  const off = await saveAftercare(db, as.agent, deal.id, null, item({ label: "Paused", active: false }));

  const due = async (actor = as.agent, d = NOW) => (await dueAftercare(db, actor, d)).filter((a) => a.dealId === deal.id).map((a) => a.label).sort();
  assert.deepEqual(await due(), ["Annual review", "Closing gift"]);
  assert.deepEqual(await due(as.agent2), []);
  assert.deepEqual(await due(as.agent, addDays(NOW, -1)), []);

  await aftercareDone(db, as.agent, id, NOW);
  await assert.rejects(aftercareDone(db, as.agent, id, NOW), /isn't due until 2027-03-10/);
  await aftercareDone(db, as.agent, once, NOW);
  assert.deepEqual(await due(), []);
  assert.deepEqual(await due(as.agent, "2027-03-10"), ["Annual review"]);
  await aftercareDone(db, as.agent, id, "2027-03-10");
  await assert.rejects(aftercareDone(db, as.agent, id, "2030-01-01"), /turned off/);
  await assert.rejects(aftercareDone(db, as.agent, off, NOW), /turned off/);
  await assert.rejects(aftercareDone(db, as.agent2, off, NOW), /Deal not found/);
  assert.deepEqual(await due(as.agent, "2030-01-01"), []);
  await saveAftercare(db, as.agent, deal.id, off, item({ label: "Paused", active: true }));
  assert.deepEqual(await due(), ["Paused"]);

  await saveDeal(db, as.agent, deal.id, { "mortgageRequest/Payment Summary/Maturity Date": "2031-06-30" });
  const q = (x: Record<string, string>) => new URLSearchParams({ kind: "maturities", ...x });
  const hit = await runReport(db, as.agent, "one-touch", q({ start: "2031-06-01", end: "2031-06-30" }));
  assert.ok(hit!.rows.some((r) => r.at(-1) === "2031-06-30"));
  assert.equal(hit!.head.at(-1), "Maturity Date");
  assert.equal((await runReport(db, as.agent, "one-touch", q({ start: "2031-07-01" })))!.rows.some((r) => r.at(-1) === "2031-06-30"), false);
  assert.equal((await runReport(db, as.agent2, "one-touch", q({})))!.rows.some((r) => r.at(-1) === "2031-06-30"), false);
});
