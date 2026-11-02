// Reports against an in-memory Postgres: `npm test`. Synthetic deals only.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { addDays } from "../lib/dates.ts";
import type { Actor } from "./access.ts";
import { createContact, listContacts, ValidationError } from "./contacts.ts";
import { addDealContact, createDeal, saveDeal } from "./deals.ts";
import { openDb, type Db } from "./db.ts";
import { dealCode } from "./deal-status.ts";
import { auditLog, deals, dealStatusHistory, users } from "./schema.ts";
import { deleteSavedReport, exportReport, listSavedReports, reportOptions, reportPresets, runReport, saveReport, toCsv, type Cell, type Table } from "./reports.ts";
import { seedIfEmpty } from "./seed.ts";
import { today } from "./tasks.ts";

let db: Db;
const as: Record<string, Actor & { name: string }> = {};
const NOW = today();
const q = (s = "") => new URLSearchParams(s);
const text = (c: Cell) => (typeof c === "object" ? c.text : String(c));
const row = (t: Table, first: string) => t.rows.find((r) => text(r[0]) === first)!.map(text);
const codes = (t: Table | null) => t!.rows.map((r) => text(r[0]));

before(async () => {
  db = await openDb();
  await seedIfEmpty(db);
  for (const u of await db.select().from(users)) as[u.email.split("@")[0]] = u;
});

const PROGRAM = "mortgageRequest/Mortgage Breakdown/Program";
const RP = "mortgageRequest/Rates and Payments/";

async function deal(input: Record<string, unknown>, actor = as.agent) {
  const [contact] = await listContacts(db, actor);
  return createDeal(db, actor, contact.id, { status: "new_deal", ...input });
}

// Tests may move a deal directly; the app does it through the status machine.
async function move(id: string, to: "approved" | "funded", daysAgo = 0) {
  await db.update(deals).set({ status: to }).where(eq(deals.id, id));
  await db.insert(dealStatusHistory).values({ dealId: id, from: "new_deal", to, actorId: as.agent.id, at: new Date(Date.parse(addDays(NOW, -daysAgo) + "T16:00:00Z")) });
}

test("production counts status entries this week, month and year, per scope", async () => {
  const before = row((await runReport(db, as.agent, "production", q(), NOW))!, "New Deals");
  const d = await deal({ amount: "250000" });
  const after = row((await runReport(db, as.agent, "production", q(), NOW))!, "New Deals");
  for (const i of [1, 3, 5]) assert.equal(Number(after[i]), Number(before[i]) + 1);

  // An entry from last year is not production this year.
  await db.update(dealStatusHistory).set({ at: new Date(`${Number(NOW.slice(0, 4)) - 1}-06-01T12:00:00Z`) }).where(eq(dealStatusHistory.dealId, d.id));
  assert.deepEqual(row((await runReport(db, as.agent, "production", q(), NOW))!, "New Deals"), before);

  // Funded by lender, with a drilldown to the deals.
  const f = await deal({ amount: "333000", lender: "Test Lender A" });
  await move(f.id, "funded");
  const byLender = (await runReport(db, as.agent, "production", q("by=lender"), NOW))!;
  assert.deepEqual(row(byLender, "Test Lender A").slice(5), ["1", "$333,000"]);
  const drill = (await runReport(db, as.agent, "production", q("by=lender&group=Test Lender A"), NOW))!;
  assert.deepEqual(codes(drill), [dealCode(f.number)]);

  // Another office's agent never sees it, even when asking for this agent.
  const other = (await runReport(db, as["ottawa.agent"], "production", q(`by=lender&agent=${as.agent.id}`), NOW))!;
  assert.ok(!other.rows.some((r) => text(r[0]) === "Test Lender A"));
});

test("pipeline groups by closing month, with office filter and drilldown", async () => {
  const year = NOW.slice(0, 4);
  const d = await deal({ amount: "410000", closingDate: `${year}-03-15` });
  const march = (await runReport(db, as.agent, "pipeline", q(`year=${year}&month=3`), NOW))!;
  assert.ok(codes(march).includes(dealCode(d.number)));
  assert.ok(march.back?.startsWith("/reports/pipeline"));
  const elsewhere = (await runReport(db, as.agent, "pipeline", q(`year=${year}&month=3&office=${as["ottawa.agent"].officeId}`), NOW))!;
  assert.equal(elsewhere.rows.length, 0);
  const summary = (await runReport(db, as.agent, "pipeline", q(`year=${year}`), NOW))!;
  assert.equal(summary.rows.length, 13);
  assert.ok(Number(row(summary, "March")[1]) >= 1);
});

test("SLA splits deals by days in stage against the target", async () => {
  const late = await deal({});
  const fresh = await deal({});
  await move(late.id, "approved", 10);
  await move(fresh.id, "approved", 1);
  const over = (await runReport(db, as.agent, "sla", q(`who=${as.agent.id}&stage=approved&sla=over`), NOW))!;
  const within = (await runReport(db, as.agent, "sla", q(`who=${as.agent.id}&stage=approved&sla=within`), NOW))!;
  assert.ok(codes(over).includes(dealCode(late.number)) && !codes(over).includes(dealCode(fresh.number)));
  assert.ok(codes(within).includes(dealCode(fresh.number)));
  assert.equal(over.rows.find((r) => text(r[0]) === dealCode(late.number))![2], 10);
  const summary = (await runReport(db, as.agent, "sla", q(), NOW))!;
  assert.deepEqual(summary.rows.map((r) => r[0]), [as.agent.name]); // an agent only sees their own row
  assert.ok(summary.rows.every((r) => r.length === summary.head.length));
});

test("report builder: whitelisted columns, parameterised filters", async () => {
  const d = await deal({ amount: "987654", lender: "Builder Bank %" });
  const run = (s: string) => runReport(db, as.agent, "build", q(s), NOW);
  assert.equal(await run(""), null);
  await assert.rejects(run("cols=number,passwordHash"), ValidationError);
  await assert.rejects(run("cols=number&f=status:contains:x"), ValidationError);
  await assert.rejects(run("cols=number&f=amount:gt:lots"), ValidationError);
  await assert.rejects(run("cols=number&f=closingDate:gt:2026-02-30"), ValidationError);

  const t = (await run("name=Big&cols=number,amount,lender&f=amount:gte:987654&f=status:eq:New Deals"))!;
  assert.equal(t.title, "Big");
  assert.deepEqual(t.head, ["Deal #", "Mortgage Amount", "Lender"]);
  assert.deepEqual(t.rows.map((r) => r.map(text)), [[dealCode(d.number), "$987,654", "Builder Bank %"]]);

  // Values are data, never SQL or wildcards.
  assert.equal((await run("cols=number&f=lender:eq:' or 1=1 --"))!.rows.length, 0);
  assert.deepEqual(codes(await run("cols=number&f=lender:contains:bank %")), [dealCode(d.number)]);
  assert.equal((await run("cols=number&f=lender:contains:%"))!.rows.length, 1);

  // Program, term and rate type are saved workspace fields and filter like any text column; the computed payment is never stored.
  await saveDeal(db, as.agent, d.id, { [PROGRAM]: "Self Employed", [RP + "Term"]: "5 Years", [RP + "Rate Type"]: "Fixed", [RP + "Calculated Payment"]: "1" });
  const p = (await run("cols=number,program,term,rateType&f=program:eq:self employed&f=rateType:eq:Fixed"))!;
  assert.deepEqual(p.rows.map((r) => r.map(text)), [[dealCode(d.number), "Self Employed", "5 Years", "Fixed"]]);
  assert.equal((await run("cols=number&f=program:eq:Rental"))!.rows.length, 0);
  assert.ok(!(RP + "Calculated Payment" in (await db.select().from(deals).where(eq(deals.id, d.id)))[0].fields));

  // Scope still applies: another office's agent can't find it.
  assert.equal((await runReport(db, as["ottawa.agent"], "build", q("cols=number&f=amount:eq:987654"), NOW))!.rows.length, 0);
  assert.ok((await runReport(db, as.admin, "build", q("cols=number&f=amount:eq:987654"), NOW))!.rows.length === 1);
});

test("one-touch reports are date-ranged builder queries", async () => {
  const d = await deal({ closingDate: "2031-07-04" });
  const t = await runReport(db, as.agent, "one-touch", q("kind=deals-closing&start=2031-07-01&end=2031-07-31"), NOW);
  assert.deepEqual(codes(t), [dealCode(d.number)]);
  assert.equal(await runReport(db, as.agent, "one-touch", q("kind=birthdays"), NOW), null);
  await assert.rejects(runReport(db, as.agent, "one-touch", q("kind=leads&start=soon"), NOW), ValidationError);
});

test("CSV export is formula-safe and audited", async () => {
  const csv = toCsv({ title: "x", head: ["A", "B"], rows: [["=HYPERLINK(\"x\")", 5], [{ text: "KW-1", href: "/deal/1" }, "-2+3"]] });
  assert.equal(csv, '﻿"A","B"\r\n"\'=HYPERLINK(""x"")","5"\r\n"KW-1","\'-2+3"\r\n');

  const out = (await exportReport(db, as.agent, "pipeline", q("year=2031"), NOW))!;
  assert.equal(out.name, "Pipeline 2031");
  assert.ok(out.csv.includes('"Month","# Units","Volume"'));
  const [log] = await db.select().from(auditLog).where(and(eq(auditLog.entity, "report"), eq(auditLog.actorId, as.agent.id)));
  assert.equal((log.after as { report: string }).report, "pipeline");
  assert.equal(await exportReport(db, as.agent, "credit-bureau", q(), NOW), null);
});

test("filter options only list what the actor's scope can contain", async () => {
  const agent = await reportOptions(db, as.agent);
  assert.deepEqual(agent.agents.map((a) => a.id), [as.agent.id]);
  const office = await reportOptions(db, as["office.admin"]);
  assert.ok(office.offices.every((o) => o.id === as["office.admin"].officeId));
  assert.ok(!office.agents.some((a) => a.id === as["ottawa.agent"].id));
  assert.equal((await reportOptions(db, as.admin)).offices.length, 2);
});

test("customer and sales tracking: rate, position, referrer and line of business filters; presets run", async () => {
  const d = await deal({});
  await saveDeal(db, as.agent, d.id, {
    [RP + "Interest Rate"]: "5.25%", [RP + "Term Type"]: "Closed", "insurance//Charge Type": "Second",
    "mortgageRequest/Lender Submission/Line Of Business": "Commercial",
  });
  const run = (s: string, actor = as.agent) => runReport(db, actor, "build", q(s), NOW);
  const mine = `f=number:eq:${d.number}`;
  assert.deepEqual(codes(await run(`cols=number&${mine}&f=rate:gte:5`)), [dealCode(d.number)]);
  assert.equal((await run(`cols=number&${mine}&f=rate:gt:5.25`))!.rows.length, 0);
  assert.deepEqual((await run(`cols=rate,position,lineOfBusiness,termType&${mine}&f=position:eq:second&f=lineOfBusiness:eq:Commercial`))!.rows.map((r) => r.map(text)), [["5.25", "Second", "Commercial", "Closed"]]);

  // Referrer: the free-text referral name, replaced by a Referral Source contact once one is linked.
  await saveDeal(db, as.agent, d.id, { "referral//First Name": "Typed", "referral//Last Name": "Referrer" });
  assert.deepEqual(codes(await run(`cols=number&f=referrer:eq:typed referrer`)), [dealCode(d.number)]);
  const c = await createContact(db, as.agent, { firstName: "Linked", lastName: "Source", role: "Referral Source" });
  await addDealContact(db, as.agent, d.id, c.id, "Referral Source");
  assert.deepEqual(codes(await run(`cols=number&f=referrer:contains:linked`)), [dealCode(d.number)]);

  for (const [, query] of reportPresets) assert.ok((await run(query))!.rows.some((r) => text(r[0]) === dealCode(d.number)));
});

test("saved reports are per user and re-run under the opener's own scope", async () => {
  const d = await deal({ amount: "222111" });
  const query = "name=Mine&cols=number&f=amount:eq:222111";
  await assert.rejects(saveReport(db, as.agent, "cols=number"), /name/);
  await assert.rejects(saveReport(db, as.agent, "name=Empty"), /column/);
  await assert.rejects(saveReport(db, as.agent, "name=Bad&cols=passwordHash"), ValidationError);
  await saveReport(db, as.agent, query);
  await saveReport(db, as.agent, query + "&f=status:eq:New Deals"); // same name updates it
  const [saved, ...rest] = (await listSavedReports(db, as.agent)).filter((r) => r.name === "Mine");
  assert.equal(rest.length, 0);
  assert.ok(saved.query.includes("status"));
  assert.ok(!(await listSavedReports(db, as["ottawa.agent"])).some((r) => r.id === saved.id));

  assert.deepEqual(codes(await runReport(db, as.agent, "build", q(saved.query), NOW)), [dealCode(d.number)]);
  assert.equal((await runReport(db, as["ottawa.agent"], "build", q(saved.query), NOW))!.rows.length, 0);

  await deleteSavedReport(db, as["ottawa.agent"], saved.id);
  assert.ok((await listSavedReports(db, as.agent)).some((r) => r.id === saved.id));
  await deleteSavedReport(db, as.agent, saved.id);
  assert.ok(!(await listSavedReports(db, as.agent)).some((r) => r.id === saved.id));
});
