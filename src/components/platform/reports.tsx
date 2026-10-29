"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronLeft, Download, FileChartLine, Plus, Search, Trash2 } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { builderFields, builderOps, Cell, opsFor, Table } from "@/server/reports";
import { AppShell } from "./shell";
import { blueBtn, greenBtn, greyBtn, Grid, input, label, PageHeader, panel } from "./ui";

type Options = { agents: { id: string; name: string }[]; offices: { id: string; name: string }[] };
type Builder = { fields: typeof builderFields; ops: typeof builderOps; opsFor: typeof opsFor; defaultCols: string[] };
type Props = {
  slug: string; title: string; query: string; table: Table | null; error: string; pending: boolean;
  options: Options; builder: Builder; oneTouch: [string, string, boolean][]; slaNote: string;
};

const btn = "flex h-[30px] items-center gap-1 px-3 text-[12.6px]";
const linkCls = "text-[#428bca] hover:underline";

function Box({ title, children, tools }: { title: ReactNode; children: ReactNode; tools?: ReactNode }) {
  return (
    <div className={panel}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#f4f4f4] px-[15px] py-2.5">
        <h3 className="text-lg text-[#444]">{title}</h3>
        <div className="ml-auto flex flex-wrap gap-2">{tools}</div>
      </div>
      <div className="p-[15px]">{children}</div>
    </div>
  );
}

function Alert({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return (
    <p role="alert" className={cn("mx-[25px] mb-5 rounded-[4px] border p-3 text-[12.6px]", warn ? "border-[#faebcc] bg-[#fcf8e3] text-[#8a6d3b]" : "border-[#ebccd1] bg-[#f2dede] text-[#a94442]")}>
      {children}
    </p>
  );
}

const cell = (c: Cell, i: number) => (typeof c === "object" ? <Link key={i} href={c.href} className={linkCls}>{c.text}</Link> : c);

// The server's table, with drilldown links, a Back link and the CSV export of the same query.
function TableView({ slug, query, table, back }: { slug: string; query: string; table: Table; back?: string }) {
  const to = table.back ?? back;
  return (
    <Box
      title={table.title}
      tools={<>
        {to && <Link href={to} className={cn(greyBtn, btn)}><ChevronLeft className="size-3.5" /> Back</Link>}
        <a href={`/reports/${slug}/export${query ? `?${query}` : ""}`} className={cn(greenBtn, btn)}><Download className="size-3.5" /> Export CSV</a>
      </>}
    >
      {table.note && <p className="mb-2 text-[12.6px] text-[#8a6d3b]">{table.note}</p>}
      <Grid
        min={table.head.length > 5 ? 900 : 500}
        head={table.drill ? [...table.head, "Drilldown"] : table.head}
        rows={table.rows.map((r, i) => {
          const cells = r.map(cell);
          if (!table.drill) return cells;
          const d = table.drill[i];
          return [...cells, d ? <Link key="d" href={d} className={cn(blueBtn, "px-2 py-0.5 text-xs")}>Drilldown</Link> : "-"];
        })}
      />
    </Box>
  );
}

function Pick({ name, text, value, options, all }: { name: string; text: string; value: string; options: { id: string; name: string }[]; all: string }) {
  return (
    <label className="text-[12.6px] font-semibold text-[#666]">
      {text}
      <select name={name} defaultValue={value} className={cn(input, "mt-1 w-[170px] font-normal")}>
        <option value="">{all}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>
  );
}

// GET form: the filters live in the URL, so the page, a reload and the CSV all see the same report.
function Filters({ slug, q, options, children }: { slug: string; q: URLSearchParams; options: Options; children?: ReactNode }) {
  return (
    <Form key={q.toString()} action={`/reports/${slug}`} className={cn(panel, "flex flex-wrap items-end gap-3 p-[15px]")}>
      {options.offices.length > 1 && <Pick name="office" text="Office" value={q.get("office") ?? ""} options={options.offices} all="All Offices" />}
      {options.agents.length > 1 && <Pick name="agent" text="Agent" value={q.get("agent") ?? ""} options={options.agents} all="All Agents" />}
      {children}
      <button className={cn(blueBtn, btn)}>Generate</button>
      <Link href={`/reports/${slug}`} className={cn(greyBtn, btn)}>Reset</Link>
    </Form>
  );
}

function OneTouch({ cards, query, table }: { cards: [string, string, boolean][]; query: string; table: Table | null }) {
  if (table) return <TableView slug="one-touch" query={query} table={table} back="/reports/one-touch" />;
  return (
    <div className="mx-[25px] grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(([kind, title, ready]) => (
        <Form key={kind} action="/reports/one-touch" className="bg-white p-[15px] shadow-[0_0_4px_rgba(0,0,0,0.1)]">
          <h3 className="mb-2 flex items-center gap-2 text-lg text-[#444]">
            {title}
            {!ready && <span className="rounded-[3px] bg-[#f0ad4e] px-1.5 py-0.5 text-[11px] font-semibold text-white">Pending</span>}
          </h3>
          <input type="hidden" name="kind" value={kind} />
          {kind !== "deals-all" && (
            <div className="mb-3 flex flex-wrap gap-2">
              {(["start", "end"] as const).map((n) => (
                <label key={n} className="flex-1 text-[12.6px] font-semibold text-[#666]">{n === "start" ? "Start Date" : "End Date"}
                  <input type="date" name={n} disabled={!ready} className={cn(input, "mt-1 font-normal")} />
                </label>
              ))}
            </div>
          )}
          {ready
            ? <button className={cn(blueBtn, "px-3 py-1.5 text-[12.6px]")}>View Report</button>
            : <p className="text-[12.6px] text-[#999]">Needs contact fields (birthday, anniversary, maturity, rate expiry) that aren&apos;t in Keyway yet.</p>}
        </Form>
      ))}
    </div>
  );
}

type Filter = { field: string; op: string; value: string };
type Saved = { name: string; query: string };
const STORE = "keyway.reports";

// ponytail: saved reports live in this browser only; move them to a table if they need to follow the user.
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => { try { return localStorage.getItem(STORE) ?? "[]"; } catch { return "[]"; } };
function parseSaved(raw: string): Saved[] {
  try { return JSON.parse(raw); } catch { return []; }
}
function writeSaved(s: Saved[]) {
  try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* storage blocked: nothing saved */ }
  listeners.forEach((l) => l());
}

function BuildReport({ q, query, table, b }: { q: URLSearchParams; query: string; table: Table | null; b: Builder }) {
  const router = useRouter();
  const fields = Object.keys(b.fields) as (keyof Builder["fields"])[];
  const [step, setStep] = useState(q.get("cols") ? 2 : 0);
  const [name, setName] = useState(q.get("name") ?? "");
  const [cols, setCols] = useState<string[]>(q.get("cols")?.split(",") ?? b.defaultCols);
  const [filters, setFilters] = useState<Filter[]>(q.getAll("f").map((f) => { const [field, op, ...v] = f.split(":"); return { field, op, value: v.join(":") }; }));
  const mine = parseSaved(useSyncExternalStore(subscribe, snapshot, () => "[]"));
  const [error, setError] = useState("");

  const current = () => {
    const p = new URLSearchParams({ name: name.trim(), cols: cols.join(",") });
    for (const f of filters) if (f.value.trim()) p.append("f", `${f.field}:${f.op}:${f.value.trim()}`);
    return p.toString();
  };
  const next = () => {
    if (step === 0 && !name.trim()) return setError("A report name is required.");
    if (step === 1 && !cols.length) return setError("Select at least one column.");
    setError("");
    setStep(step + 1);
  };
  const save = () => {
    writeSaved([...mine.filter((m) => m.name !== name.trim()), { name: name.trim(), query: current() }]);
  };
  const remove = (s: Saved) => { writeSaved(mine.filter((m) => m !== s)); };
  const opsOf = (field: string) => b.opsFor[b.fields[field as keyof Builder["fields"]][1]];
  const steps = ["Report Name", "Columns", "Filters"];

  return (
    <div className="mx-[25px] grid gap-5 lg:grid-cols-[240px_1fr]">
      <div className="h-fit bg-white p-[15px] shadow-[0_0_4px_rgba(0,0,0,0.1)]">
        <h3 className="mb-2 text-lg text-[#444]">My Reports</h3>
        {mine.length ? (
          <ul className="text-[12.6px]">
            {mine.map((s) => (
              <li key={s.name} className="flex items-center gap-2 border-b border-[#eee] py-1.5">
                <Link href={`/reports/build?${s.query}`} className={linkCls}>{s.name}</Link>
                <button onClick={() => remove(s)} aria-label={`Delete ${s.name}`} className="ml-auto text-[#d9534f]"><Trash2 className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        ) : <p className="text-[12.6px] text-[#999]">No saved reports.</p>}
        <p className="mt-2 text-[11px] text-[#999]">Saved in this browser only.</p>
      </div>
      <div className="min-w-0">
        <div className="mb-5 bg-white p-[15px] shadow-[0_0_4px_rgba(0,0,0,0.1)]">
          <ol className="mb-4 flex flex-wrap gap-2 text-[12.6px]">
            {steps.map((s, i) => (
              <li key={s}>
                <button onClick={() => i < step && setStep(i)} className={cn("flex items-center gap-2 rounded-[3px] px-3 py-1.5", i === step ? "bg-[#428bca] text-white" : i < step ? "bg-[#dff0d8] text-[#3c763d]" : "bg-[#f1f1f1] text-[#999]")}>
                  <span className="font-semibold">{i + 1}</span> {s}
                </button>
              </li>
            ))}
          </ol>
          {error && <p className="mb-3 rounded-[4px] border border-[#ebccd1] bg-[#f2dede] p-2 text-[12.6px] text-[#a94442]">{error}</p>}
          {step === 0 && (
            <label className="block max-w-[400px]"><span className={label}>Report Name</span><input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className={input} /></label>
          )}
          {step === 1 && (
            <div className="grid gap-1 text-[12.6px] sm:grid-cols-3">
              {fields.map((f) => (
                <label key={f} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={cols.includes(f)} onChange={() => setCols(cols.includes(f) ? cols.filter((c) => c !== f) : fields.filter((x) => x === f || cols.includes(x)))} /> {b.fields[f][0]}
                </label>
              ))}
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-2 text-[12.6px]">
              <p className="font-semibold text-[#666]">Advanced Filters</p>
              {filters.map((f, i) => {
                const set = (p: Partial<Filter>) => setFilters(filters.map((x, j) => (j === i ? { ...x, ...p } : x)));
                const kind = b.fields[f.field as keyof Builder["fields"]]?.[1];
                return (
                  <div key={i} className="flex flex-wrap gap-2">
                    <select value={f.field} onChange={(e) => set({ field: e.target.value, op: opsOf(e.target.value)[0] })} aria-label="Field" className={cn(input, "w-[160px]")}>
                      {fields.map((o) => <option key={o} value={o}>{b.fields[o][0]}</option>)}
                    </select>
                    <select value={f.op} onChange={(e) => set({ op: e.target.value })} aria-label="Operator" className={cn(input, "w-[130px]")}>
                      {(kind ? opsOf(f.field) : []).map((o) => <option key={o} value={o}>{b.ops[o]}</option>)}
                    </select>
                    <input type={kind === "date" ? "date" : "text"} value={f.value} maxLength={200} onChange={(e) => set({ value: e.target.value })} placeholder="Value" aria-label="Value" className={cn(input, "w-[180px]")} />
                    <button onClick={() => setFilters(filters.filter((_, j) => j !== i))} aria-label="Remove filter" className="text-[#d9534f]"><Trash2 className="size-4" /></button>
                  </div>
                );
              })}
              {filters.length < 10 && (
                <button onClick={() => setFilters([...filters, { field: "status", op: "eq", value: "" }])} className={cn(greyBtn, "flex w-fit items-center gap-1 px-3 py-1.5")}><Plus className="size-3.5" /> Add Filter</button>
              )}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {step > 0 && <button onClick={() => setStep(step - 1)} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Previous</button>}
            {step < 2 ? <button onClick={next} className={cn(blueBtn, "px-3 py-1.5 text-[12.6px]")}>Next</button> : <>
              <button onClick={() => router.push(`/reports/build?${current()}`)} className={cn(blueBtn, "flex items-center gap-1 px-3 py-1.5 text-[12.6px]")}><Search className="size-3.5" /> Generate</button>
              <button onClick={save} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px]")}>Save to My Reports</button>
            </>}
          </div>
        </div>
        {table && step === 2 && <div className="-mx-[25px]"><TableView slug="build" query={query} table={table} /></div>}
      </div>
    </div>
  );
}

export function AppReport({ slug, title, query, table, error, pending, options, builder, oneTouch, slaNote }: Props) {
  const q = new URLSearchParams(query);
  const year = Number(new Date().getFullYear());
  let body: ReactNode;
  if (pending) {
    body = (
      <Alert warn>
        <b>Pending.</b>{" "}
        Credit pulls aren&apos;t connected yet, so there is nothing to report. This report arrives with the credit bureau integration.
      </Alert>
    );
  } else if (slug === "build") {
    body = <BuildReport key={query} q={q} query={query} table={table} b={builder} />;
  } else if (slug === "one-touch") {
    body = <OneTouch cards={oneTouch} query={query} table={table} />;
  } else {
    const drilled = !!table?.back;
    body = <>
      {!drilled && (
        <Filters slug={slug} q={q} options={options}>
          {slug === "production" && q.get("by") && <input type="hidden" name="by" value={q.get("by")!} />}
          {slug === "pipeline" && (
            <label className="text-[12.6px] font-semibold text-[#666]">
              Year
              <select name="year" defaultValue={q.get("year") ?? String(year)} className={cn(input, "mt-1 w-[100px] font-normal")}>
                {[year + 1, year, year - 1, year - 2, year - 3].map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
          )}
        </Filters>
      )}
      {slug === "production" && !drilled && (
        <div className="mx-[25px] mb-2 flex gap-1 text-[12.6px]">
          {([["", "Production"], ["lender", "Funded by Lender"]] as const).map(([by, text]) => {
            const p = new URLSearchParams(q);
            if (by) p.set("by", by); else p.delete("by");
            return <Link key={by} href={`/reports/production${p.size ? `?${p}` : ""}`} className={cn("rounded-[3px] px-3 py-1.5", (q.get("by") ?? "") === by ? "bg-[#428bca] text-white" : "bg-[#f1f1f1] text-[#666]")}>{text}</Link>;
          })}
        </div>
      )}
      {slug === "sla" && !drilled && <p className="mx-[25px] mb-2 text-[12.6px] text-[#666]">{slaNote}</p>}
      {table && <TableView slug={slug} query={query} table={table} />}
    </>;
  }
  return (
    <AppShell>
      <PageHeader icon={FileChartLine} title={title} crumbs={[["Reports"], [title]]} />
      {error && <Alert>{error}</Alert>}
      {body}
    </AppShell>
  );
}
