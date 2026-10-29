// Reports over the deals the actor can see. Every query goes through dealScope; the report builder only reads
// whitelisted columns and binds every value as a parameter. The page and the CSV export render the same Table.
import { and, asc, eq, ilike, inArray, ne, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { complianceLabels, riskLabels, screeningLabels } from "../components/platform/aml-fields.ts";
import { addDays, isDay } from "../lib/dates.ts";
import { dealScope, type Actor } from "./access.ts";
import { getOrganization, slaStatuses } from "./admin.ts";
import { audit } from "./audit.ts";
import { ValidationError } from "./contacts.ts";
import type { Db } from "./db.ts";
import { dealCode, statusLabel, type DealStatus } from "./deal-status.ts";
import { amlAssessments, contacts, dealBorrowers, deals, dealStatusHistory, offices, users } from "./schema.ts";
import { TIME_ZONE, today } from "./tasks.ts";

export type Cell = string | number | { text: string; href: string };
// drill: one drilldown link (or null) per row, shown as an extra column and left out of the CSV.
export type Table = { title: string; head: string[]; rows: Cell[][]; drill?: (string | null)[]; back?: string; note?: string };

export const reportSlugs = ["build", "one-touch", "production", "pipeline", "sla", "borrower-risk", "sanction-screening"];
// Needs data that doesn't exist yet: credit pulls (integration).
export const pendingReports = ["credit-bureau"];

type URSP = URLSearchParams;
const MAX_ROWS = 5000;
const UUID = /^[0-9a-f-]{36}$/i;
const usd = (n: number) => "$" + n.toLocaleString("en-CA");
const localDate = (col: PgColumn) => sql<string>`((${col}) at time zone ${TIME_ZONE})::date::text`;
const field = (key: string) => sql<string | null>`${deals.fields}->>${key}`;

// Whitelisted report columns. The builder can select and filter these and nothing else.
const columns = {
  number: deals.number,
  borrower: sql<string>`trim(concat(${contacts.firstName}, ' ', ${contacts.lastName}))`,
  status: deals.status,
  amount: deals.amount,
  lender: field("closeOut//Lender"),
  product: field("closeOut//Product"),
  purpose: deals.purpose,
  closingDate: deals.closingDate,
  submittedDate: deals.submittedDate,
  entryDate: localDate(deals.createdAt),
  agent: users.name,
  office: offices.name,
};
type Field = keyof typeof columns;
type Kind = "number" | "text" | "status" | "date" | "money";
export const builderFields: Record<Field, [label: string, kind: Kind]> = {
  number: ["Deal #", "number"], borrower: ["Borrower", "text"], status: ["Status", "status"], amount: ["Mortgage Amount", "money"],
  lender: ["Lender", "text"], product: ["Product", "text"], purpose: ["Purpose", "text"], closingDate: ["Closing Date", "date"],
  submittedDate: ["Submitted Date", "date"], entryDate: ["Entry Date", "date"], agent: ["Agent", "text"], office: ["Office", "text"],
};
export const builderOps = { eq: "equals", ne: "not equals", contains: "contains", gt: "greater than", lt: "less than", gte: "on or after", lte: "on or before" };
type Op = keyof typeof builderOps;
const cmp = { eq: "=", ne: "<>", gt: ">", lt: "<", gte: ">=", lte: "<=" };
export const opsFor: Record<Kind, Op[]> = { text: ["eq", "ne", "contains"], status: ["eq", "ne"], number: ["eq", "ne", "gt", "lt", "gte", "lte"], money: ["eq", "ne", "gt", "lt", "gte", "lte"], date: ["eq", "ne", "gt", "lt", "gte", "lte"] };
export const defaultCols: Field[] = ["number", "borrower", "status", "amount", "lender", "closingDate", "agent"];

// ponytail: loads up to MAX_ROWS scoped deals and aggregates in JS; move the GROUP BYs into SQL once an organization outgrows it.
function dealRows(db: Db, actor: Actor, where?: SQL) {
  return db
    .select({
      id: deals.id, agentId: deals.agentId,
      // The day the deal entered its current status, for SLA ages.
      statusAt: sql<string | null>`(select (max(h.created_at) at time zone ${TIME_ZONE})::date::text from ${dealStatusHistory} h where h.deal_id = ${deals.id} and h."to" = ${deals.status})`,
      ...columns,
    })
    .from(deals)
    .innerJoin(users, eq(users.id, deals.agentId))
    .innerJoin(offices, eq(offices.id, deals.officeId))
    .leftJoin(dealBorrowers, and(eq(dealBorrowers.dealId, deals.id), eq(dealBorrowers.position, 0)))
    .leftJoin(contacts, eq(contacts.id, dealBorrowers.contactId))
    .where(and(dealScope(actor), where))
    .orderBy(asc(deals.closingDate), asc(deals.number))
    .limit(MAX_ROWS);
}
type Row = Awaited<ReturnType<typeof dealRows>>[number];

// Office / agent filters. Only narrow the scope; an id outside it simply matches nothing.
function picked(q: URLSearchParams) {
  const office = q.get("office") ?? "", agent = q.get("agent") ?? "";
  return and(UUID.test(office) ? eq(deals.officeId, office) : undefined, UUID.test(agent) ? eq(deals.agentId, agent) : undefined);
}

const link = (slug: string, q: URLSearchParams, set: Record<string, string | null>) => {
  const p = new URLSearchParams(q);
  for (const [k, v] of Object.entries(set)) if (v === null) p.delete(k); else p.set(k, v);
  return `/reports/${slug}${p.size ? `?${p}` : ""}`;
};
const total = (ds: { amount: number | null }[]) => usd(ds.reduce((s, d) => s + (d.amount ?? 0), 0));
const cap = (ds: unknown[]) => (ds.length >= MAX_ROWS ? `Only the first ${MAX_ROWS} deals are included.` : undefined);

const dealHead = ["Deal #", "Borrower", "Status", "Mortgage Amount", "Lender", "Product", "Closing Date", "Agent", "Office"];
const dealCells = (d: Row): Cell[] => [
  { text: dealCode(d.number), href: `/deal/${d.id}` }, d.borrower, statusLabel[d.status], d.amount == null ? "" : usd(d.amount),
  d.lender ?? "", d.product ?? "", d.closingDate ?? "", d.agent, d.office,
];

// Production: deals that entered each status (or, by lender, were funded) this week, month and year, from the status history.
const prodStatuses: DealStatus[] = ["new_deal", "submitted", "approved", "accepted", "waiting_to_close", "funded", "complete", "declined"];

async function production(db: Db, actor: Actor, q: URSP, now: string): Promise<Table> {
  const byLender = q.get("by") === "lender";
  const year = `${now.slice(0, 4)}-01-01`, month = `${now.slice(0, 7)}-01`;
  const week = addDays(now, -new Date(`${now}T00:00Z`).getUTCDay()); // weeks start on Sunday, like the calendar
  const on = localDate(dealStatusHistory.at);
  const entries = await db
    .selectDistinctOn([dealStatusHistory.dealId, dealStatusHistory.to], { dealId: dealStatusHistory.dealId, status: dealStatusHistory.to, on })
    .from(dealStatusHistory)
    .innerJoin(deals, eq(deals.id, dealStatusHistory.dealId))
    .where(and(dealScope(actor), picked(q), inArray(dealStatusHistory.to, byLender ? ["funded"] : prodStatuses), sql`${on} between ${year} and ${now}`))
    .orderBy(dealStatusHistory.dealId, dealStatusHistory.to, sql`${dealStatusHistory.at} desc`);
  const ids = [...new Set(entries.map((e) => e.dealId))];
  const byId = new Map((ids.length ? await dealRows(db, actor, inArray(deals.id, ids)) : []).map((d) => [d.id, d]));
  const hits = entries.flatMap((e) => (byId.has(e.dealId) ? [{ ...byId.get(e.dealId)!, entered: e.status, on: e.on }] : []));
  const key = (h: (typeof hits)[number]) => (byLender ? h.lender || "(none)" : h.entered);
  const name = (k: string) => (byLender ? k : statusLabel[k as DealStatus] ?? k);

  const group = q.get("group");
  if (group !== null) {
    const ds = hits.filter((h) => key(h) === group);
    return { title: `Production - ${name(group)} (YTD)`, head: dealHead, rows: ds.map(dealCells), back: link("production", q, { group: null }) };
  }
  const periods = (hs: typeof hits) => [week, month, year].flatMap((from) => { const p = hs.filter((h) => h.on >= from); return [p.length, total(p)]; });
  const keys = byLender ? [...new Set(hits.map(key))].sort() : prodStatuses;
  const groups = keys.map((k) => ({ k, hs: hits.filter((h) => key(h) === k) }));
  return {
    title: byLender ? "Funded by Lender" : "Production",
    head: [byLender ? "Lender" : "Deal Status", "WTD Units", "WTD $", "MTD Units", "MTD $", "YTD Units", "YTD $"],
    rows: [...groups.map(({ k, hs }) => [name(k), ...periods(hs)]), ["Totals", ...periods(hits)]],
    drill: [...groups.map(({ k, hs }) => (hs.length ? link("production", q, { group: k }) : null)), null],
    note: cap(entries),
  };
}
// Pipeline: deals expected to close, by closing month. Leads, parked, cancelled and declined deals aren't in it.
const pipelineStatuses: DealStatus[] = ["pre_approval", "new_deal", "submitted", "approved", "accepted", "waiting_to_close", "funded", "complete"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function pipeline(db: Db, actor: Actor, q: URSP, now: string): Promise<Table> {
  const year = /^\d{4}$/.test(q.get("year") ?? "") ? q.get("year")! : now.slice(0, 4);
  const ds = await dealRows(db, actor, and(picked(q), inArray(deals.status, pipelineStatuses), sql`${deals.closingDate} between ${`${year}-01-01`} and ${`${year}-12-31`}`));
  const byMonth = months.map((_, m) => ds.filter((d) => Number(d.closingDate!.slice(5, 7)) === m + 1));
  const m = Number(q.get("month"));
  if (m >= 1 && m <= 12) return { title: `Pipeline - ${months[m - 1]} ${year}`, head: dealHead, rows: byMonth[m - 1].map(dealCells), back: link("pipeline", q, { month: null }) };
  return {
    title: `Pipeline ${year}`,
    head: ["Month", "# Units", "Volume"],
    rows: [...byMonth.map((g, i) => [months[i], g.length, total(g)]), ["Totals", ds.length, total(ds)]],
    drill: [...byMonth.map((g, i) => (g.length ? link("pipeline", q, { month: String(i + 1) }) : null)), null],
    note: cap(ds),
  };
}

// SLA: how long deals have sat in each late stage, against the organization's target number of days.
export async function slaDays(db: Db, organizationId: string): Promise<[DealStatus, number][]> {
  const { sla } = (await getOrganization(db, organizationId)).settings;
  return slaStatuses.map((s) => [s, sla[s]]);
}
const ageOf = (d: Row, now: string) => (d.statusAt ? Math.round((Date.parse(now) - Date.parse(d.statusAt)) / 864e5) : 0);

async function sla(db: Db, actor: Actor, q: URSP, now: string): Promise<Table> {
  const targets = await slaDays(db, actor.organizationId);
  const ds = await dealRows(db, actor, and(picked(q), inArray(deals.status, targets.map(([s]) => s))));
  const over = (d: Row) => ageOf(d, now) > targets.find(([s]) => s === d.status)![1];
  const who = q.get("who"), stage = q.get("stage"), late = q.get("sla") === "over";
  if (who && stage) {
    const rows = ds.filter((d) => d.agentId === who && d.status === stage && over(d) === late);
    return {
      title: `SLA - ${statusLabel[stage as DealStatus] ?? stage} (${late ? "Over" : "Within"})`,
      head: ["Deal #", "Borrower", "Days in Stage", "Target (days)", "Closing Date", "Agent"],
      rows: rows.map((d) => [dealCells(d)[0], d.borrower, ageOf(d, now), targets.find(([s]) => s === d.status)![1], d.closingDate ?? "", d.agent]),
      back: link("sla", q, { who: null, stage: null, sla: null }),
    };
  }
  const agents = [...new Map(ds.map((d) => [d.agentId, d.agent])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const count = (id: string, s: DealStatus, isOver: boolean): Cell => {
    const n = ds.filter((d) => d.agentId === id && d.status === s && over(d) === isOver).length;
    return n ? { text: String(n), href: link("sla", q, { who: id, stage: s, sla: isOver ? "over" : "within" }) } : 0;
  };
  return {
    title: "SLA Summary",
    head: ["Agent", ...targets.flatMap(([s, n]) => [`${statusLabel[s]} - Within ${n}d`, `${statusLabel[s]} - Over`])],
    rows: agents.map(([id, name]) => [name, ...targets.flatMap(([s]) => [count(id, s, false), count(id, s, true)])]),
    note: cap(ds),
  };
}

// Report builder. ?name=…&cols=number,borrower&f=status:eq:Approved (f repeats, up to 10).
function condition(spec: string): SQL {
  const [f, op, ...rest] = spec.split(":");
  const value = rest.join(":").trim();
  const def = builderFields[f as Field];
  if (!def || !opsFor[def[1]].includes(op as Op)) throw new ValidationError(`Invalid filter: ${spec.slice(0, 60)}`);
  if (value.length > 200) throw new ValidationError("A filter value is too long");
  const col = columns[f as Field];
  const kind = def[1];
  if (kind === "text") {
    if (op === "contains") return ilike(col, `%${value.replace(/[\\%_]/g, "\\$&")}%`);
    return op === "eq" ? sql`lower(${col}) = lower(${value})` : sql`coalesce(lower(${col}), '') <> lower(${value})`;
  }
  let v: string | number = value;
  if (kind === "status") {
    v = (Object.entries(statusLabel).find(([k, l]) => k === value || l.toLowerCase() === value.toLowerCase())?.[0]) ?? "";
    if (!v) throw new ValidationError(`Unknown status: ${value.slice(0, 40)}`);
  } else if (kind === "date") {
    if (!isDay(value)) throw new ValidationError(`${def[0]} filter needs a date (YYYY-MM-DD)`);
  } else {
    v = Number(value.replace(/^KW-/i, "").replace(/[$,\s]/g, ""));
    if (!value || !Number.isFinite(v)) throw new ValidationError(`${def[0]} filter needs a number`);
  }
  // op is one of the whitelisted keys above, so the raw operator is never user text.
  return sql`${col} ${sql.raw(cmp[op as Exclude<Op, "contains">])} ${v}`;
}

function builder(db: Db, actor: Actor, q: URSP) {
  const cols = (q.get("cols") ?? "").split(",").filter(Boolean);
  if (!cols.length) return null;
  const bad = cols.find((c) => !(c in builderFields));
  if (bad) throw new ValidationError(`Unknown column: ${bad.slice(0, 40)}`);
  const filters = q.getAll("f").filter(Boolean);
  if (filters.length > 10) throw new ValidationError("At most 10 filters");
  return runBuilder(db, actor, (q.get("name") ?? "").trim().slice(0, 100) || "Custom Report", cols as Field[], and(...filters.map(condition)));
}

async function runBuilder(db: Db, actor: Actor, title: string, cols: Field[], where?: SQL): Promise<Table> {
  const ds = await dealRows(db, actor, where);
  const show = (d: Row, c: Field): Cell => {
    const v = d[c];
    if (c === "number") return dealCells(d)[0];
    if (c === "status") return statusLabel[d.status];
    if (c === "amount") return v == null ? "" : usd(v as number);
    return v == null ? "" : String(v);
  };
  return { title, head: cols.map((c) => builderFields[c][0]), rows: ds.map((d) => cols.map((c) => show(d, c))), note: cap(ds) };
}

// One-touch reports are fixed builder queries over a date range. The contact ones need fields contacts don't have yet.
export const oneTouch: [kind: string, title: string, ready: boolean][] = [
  ["deals-all", "Deals - All", true], ["deals-entry", "Deals - Entry Date", true], ["deals-closing", "Deals - Closing Date", true], ["leads", "Leads", true],
  ["birthdays", "Birthdays", false], ["anniversaries", "Anniversaries", false], ["maturities", "Maturities", false], ["rate-expiries", "Rate Expiries", false], ["contacts", "Contacts", false],
];

const dealHeadFields: Field[] = ["number", "borrower", "status", "amount", "lender", "product", "closingDate", "entryDate", "agent", "office"];

function oneTouchReport(db: Db, actor: Actor, q: URSP) {
  const found = oneTouch.find(([k, , ready]) => k === q.get("kind") && ready);
  if (!found) return null;
  const [kind, title] = found;
  const start = q.get("start") ?? "", end = q.get("end") ?? "";
  if ((start && !isDay(start)) || (end && !isDay(end))) throw new ValidationError("Dates must be YYYY-MM-DD");
  const col = kind === "deals-closing" ? deals.closingDate : columns.entryDate;
  const range = kind === "deals-all" ? undefined : and(start ? sql`${col} >= ${start}` : undefined, end ? sql`${col} <= ${end}` : undefined);
  return runBuilder(db, actor, `${title} Report`, dealHeadFields, and(range, kind === "leads" ? eq(deals.status, "lead") : undefined));
}

// AML: every borrower on the scoped deals past the lead stage, with their assessment or "Not assessed".
// The agent filter gives the per-agent variant. Screening results are what the assessor recorded, not a live list check.
async function aml(db: Db, actor: Actor, q: URSP, kind: "risk" | "screening"): Promise<Table> {
  const rs = await db
    .select({
      id: deals.id, number: deals.number, compliance: deals.complianceStatus, agent: users.name, a: amlAssessments,
      borrower: sql<string>`trim(concat(${contacts.firstName}, ' ', ${contacts.lastName}))`,
    })
    .from(deals)
    .innerJoin(users, eq(users.id, deals.agentId))
    .innerJoin(dealBorrowers, eq(dealBorrowers.dealId, deals.id))
    .innerJoin(contacts, eq(contacts.id, dealBorrowers.contactId))
    .leftJoin(amlAssessments, and(eq(amlAssessments.dealId, deals.id), eq(amlAssessments.contactId, contacts.id)))
    .where(and(dealScope(actor), picked(q), ne(deals.status, "lead")))
    .orderBy(asc(deals.number), asc(dealBorrowers.position))
    .limit(MAX_ROWS);
  const deal = (r: (typeof rs)[number]): Cell => ({ text: dealCode(r.number), href: `/deal/${r.id}` });
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
  if (kind === "risk") return {
    title: "Borrower Risk Assessment",
    head: ["Deal #", "Borrower", "Risk", "Assessed", "Agent", "Compliance Status"],
    rows: rs.map((r) => [deal(r), r.borrower, r.a ? riskLabels[r.a.risk] : "Not assessed", r.a ? day(r.a.updatedAt) : "", r.agent, complianceLabels[r.compliance]]),
    note: cap(rs),
  };
  return {
    title: "Borrower Sanction Screening",
    head: ["Deal #", "Borrower", "Result", "Lists Checked", "Screened On", "Agent"],
    rows: rs.map((r) => [deal(r), r.borrower, screeningLabels[r.a?.screening ?? "not_screened"], r.a?.screeningList ?? "", r.a?.screenedOn ?? "", r.agent]),
    note: [cap(rs), "Results are recorded by hand on each deal; Keyway does not check sanction lists itself."].filter(Boolean).join(" "),
  };
}

// null: the page has nothing to show yet (builder with no columns, one-touch with no report picked).
export async function runReport(db: Db, actor: Actor, slug: string, q: URSP, now = today()): Promise<Table | null> {
  switch (slug) {
    case "production": return production(db, actor, q, now);
    case "pipeline": return pipeline(db, actor, q, now);
    case "sla": return sla(db, actor, q, now);
    case "build": return builder(db, actor, q);
    case "one-touch": return oneTouchReport(db, actor, q);
    case "borrower-risk": return aml(db, actor, q, "risk");
    case "sanction-screening": return aml(db, actor, q, "screening");
    default: return null;
  }
}

// Spreadsheet-safe CSV: quoted, with text that a spreadsheet would run as a formula prefixed by an apostrophe.
export function toCsv(t: Table) {
  const cell = (c: Cell) => {
    const s = typeof c === "object" ? c.text : String(c);
    return `"${(typeof c !== "number" && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  return "﻿" + [t.head, ...t.rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

// Every export is audited: who, which report, which filters, how many rows.
export async function exportReport(db: Db, actor: Actor, slug: string, q: URSP, now = today()) {
  const t = await runReport(db, actor, slug, q, now);
  if (!t) return null;
  await db.transaction((tx) => audit(tx, actor, "report", actor.id, "export", null, { report: slug, query: q.toString(), rows: t.rows.length }));
  return { name: t.title.replace(/[^\w\- ]+/g, "").trim() || "report", csv: toCsv(t) };
}

// Office and agent choices for the filters: only what the actor's scope can contain.
export async function reportOptions(db: Db, actor: Actor) {
  const office = actor.role === "org_admin" ? undefined : eq(offices.id, actor.officeId);
  const agents = await db.select({ id: users.id, name: users.name }).from(users)
    .where(and(eq(users.organizationId, actor.organizationId), actor.role === "agent" ? eq(users.id, actor.id) : office && eq(users.officeId, actor.officeId)))
    .orderBy(asc(users.name));
  const officeList = await db.select({ id: offices.id, name: offices.name }).from(offices)
    .where(and(eq(offices.organizationId, actor.organizationId), office)).orderBy(asc(offices.name));
  return { agents, offices: officeList };
}
