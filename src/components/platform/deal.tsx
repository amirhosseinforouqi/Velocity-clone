"use client";

import { createContext, startTransition, useActionState, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { CheckCircle, ChevronDown, FileText, Folder } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { deleteDealAction, moveDealAction, saveDealAction } from "@/app/deal/actions";
import { allowedMoves, dealCode, isReinstate, statusLabel, type DealStatus } from "@/server/deal-status";
import type { dealHistory, getDeal } from "@/server/deals";
import { dealMetrics } from "@/server/metrics";
import type { DealCompliance as Compliance } from "@/server/compliance";
import type { LenderChoice } from "@/server/lenders";
import { LENDER, lenderFor, limitsFor, PRODUCT, type Problem } from "@/server/validate";
import { dealTabs, fieldKey, sections, selectOptions, type Group } from "./deal-sections";
import { ComplianceContext, DealCompliance } from "./deal-compliance";
import { ChecklistContext, DealConditions, type Checklist } from "./deal-conditions";
import { DealTasks, TasksContext, type DealTaskList } from "./deal-tasks";
import { AppShell } from "./shell";

type Deal = NonNullable<Awaited<ReturnType<typeof getDeal>>>;
type History = Awaited<ReturnType<typeof dealHistory>>;
type SaveState = { error?: string; ok?: string; problems?: Problem[] };

const input = "h-[30px] w-full rounded-[3px] border border-[#ccc] bg-white px-2 text-[12.6px] text-[#555] outline-none focus:border-[#66afe9] disabled:bg-[#eee]";
const blueBtn = "rounded-[3px] border border-[#3d81be] bg-gradient-to-b from-[#428bcd] to-[#3d81be] px-[13px] py-1.5 text-[12.6px] text-white disabled:opacity-60";

// Workspace actions that have no backend yet; shown disabled so nothing pretends to work.
const notBuilt = [
  "Duplicate", "Reassign file", "Assign to Me", "Remove", "Submit to Lender", "Update Lender",
  "Queue for External CRM", "Respond - Co-Broker", "Print Application (En)", "Print Application (Fr)",
];

// Field values by storage key. `locked` keys mirror the contact or a column and are edited there, not here.
const Values = createContext<{ values: Record<string, string>; locked: Set<string>; lenders: LenderChoice[] }>({ values: {}, locked: new Set(), lenders: [] });

// Lender and Product pick from the lenders this deal's agent may use, grouped; a saved name that's no longer offered stays listed.
function LenderSelect({ name, value }: { name: string; value: string }) {
  const { lenders } = useContext(Values);
  const groups = name === LENDER
    ? [...new Set(lenders.map((l) => l.group))].map((g) => [g, lenders.filter((l) => l.group === g).map((l) => l.name)] as const)
    : lenders.filter((l) => l.products.length).map((l) => [l.name, l.products] as const);
  const offered = groups.some(([, xs]) => xs.includes(value));
  return (
    <select name={name} defaultValue={value} className={input}>
      <option value="">Select...</option>
      {value && !offered && <option>{value}</option>}
      {groups.map(([g, xs]) => <optgroup key={g} label={g}>{xs.map((x) => <option key={x}>{x}</option>)}</optgroup>)}
    </select>
  );
}

function Field({ name, spec }: { name: string; spec: string }) {
  const { values, locked } = useContext(Values);
  const [label, type] = spec.split("|");
  const value = values[name] ?? "";
  const disabled = locked.has(name);
  if (type === "check")
    return (
      <label className="flex items-center gap-2 self-end pb-1.5 text-[12.6px] font-semibold text-[#666]">
        {/* The hidden empty value is sent when the box is unticked, which clears the field. */}
        <input type="hidden" name={name} value="" />
        <input type="checkbox" name={name} value="Yes" defaultChecked={value === "Yes"} /> {label}
      </label>
    );
  const options = selectOptions[label];
  return (
    <label className="block text-[12.6px] text-[#666]">
      <span className="mb-1 block font-semibold">{label}</span>
      {name === LENDER || name === PRODUCT ? (
        <LenderSelect name={name} value={value} />
      ) : type === "select" && options ? (
        <select name={name} defaultValue={value} className={input}>
          <option value="">Select...</option>
          {value && !options.includes(value) && <option>{value}</option>}
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : type === "area" ? (
        <textarea name={name} defaultValue={value} rows={2} maxLength={2000} className={cn(input, "h-auto py-1")} />
      ) : (
        <input name={disabled ? undefined : name} disabled={disabled} type={type === "date" ? "date" : "text"} defaultValue={value} maxLength={2000} className={input} />
      )}
    </label>
  );
}

function Table({ cols, rows }: { cols: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.6px]">
        <thead>
          <tr>{cols.map((c) => <th key={c} className="border-b-2 border-[#ddd] p-2 text-left font-bold whitespace-nowrap">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i} className="odd:bg-[#f9f9f9]">
                {r.map((c, j) => (
                  <td key={j} className="border-t border-[#ddd] p-2">
                    {c.startsWith("Mark as") ? <button type="button" className="text-[#428bca] hover:underline">{c}</button> : c}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr><td colSpan={cols.length} className="border-t border-[#ddd] p-2 text-center text-[#999]">No records found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function GroupView({ group, section }: { group: Group; section: string }) {
  return (
    <div>
      {group.title && <h4 className="mb-2.5 border-b border-[#eee] pb-1 text-[15px] font-semibold text-[#444]">{group.title}</h4>}
      {group.fields && (
        <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {group.fields.map((f) => <Field key={f} spec={f} name={fieldKey({ id: section }, group, f)} />)}
        </div>
      )}
      {group.custom === "conditions" && <DealConditions />}
      {group.custom === "compliance" && <DealCompliance />}
      {(group.custom === "reminders" || group.custom === "tasks") && <DealTasks kind={group.custom} />}
      {/* ponytail: the other workspace tables (notes, messages...) have no storage yet; each gets its own table when built. */}
      {group.cols && <Table cols={group.cols} rows={group.rows ?? []} />}
      {group.buttons && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {group.buttons.map((b) => <button key={b} type="button" disabled title="Not built yet" className={blueBtn}>{b}</button>)}
        </div>
      )}
    </div>
  );
}

export function SectionBox({ id, title, groups, open }: { id?: string; title: string; groups: Group[]; open: boolean }) {
  return (
    <details open={open} className="group mb-5 rounded-[2px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
      <summary className="flex cursor-pointer list-none items-center px-5 py-3 text-lg font-light text-[#444] [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="ml-auto size-4 text-[#999] transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-6 border-t border-[#f4f4f4] px-5 py-[15px]">
        {groups.map((g, i) => <GroupView key={g.title ?? i} group={g} section={id ?? title} />)}
      </div>
    </details>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-3 py-1.5">
      <span className="block text-[11px] text-[#ccc] uppercase">{label}</span>
      <span className="text-[15px] text-white">{children}</span>
    </div>
  );
}

const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(2)}%`);
const money = (n: number | null) => (n === null ? "—" : "$" + n.toLocaleString("en-CA", { maximumFractionDigits: 2 }));
const over = (n: number | null, limit: number) => (n !== null && n > limit ? "text-[#ff9b9b]" : undefined);

// Opens the section holding a reported field and puts the cursor in it (no-op when that section is on another tab).
function focusField(key: string) {
  const el = document.getElementsByName(key)[0];
  el?.closest("details")?.setAttribute("open", "");
  el?.focus();
}

const moveLabel = (from: DealStatus, to: DealStatus) =>
  to === "parked" ? "Park" : to === "cancelled" ? "Cancel" : isReinstate(from) ? `Reinstate to ${statusLabel[to]}` : `Move to ${statusLabel[to]}`;

function Overview({ deal, view, setView, message }: { deal: Deal; view: string; setView: (v: "modern" | "classic") => void; message?: SaveState }) {
  const [moved, setMoved] = useState<{ error?: string }>({});
  const [pending, start] = useTransition();
  const menu = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const remove = () => {
    menu.current?.removeAttribute("open");
    if (!confirm(`Delete deal ${dealCode(deal.number)}? It disappears from every list. An admin can restore it from Admin > Recently Deleted.`)) return;
    start(async () => {
      const r = await deleteDealAction(deal.id);
      if (r.error) setMoved(r);
      else router.push("/");
    });
  };
  const move = (to: DealStatus) => {
    menu.current?.removeAttribute("open");
    if ((to === "parked" || to === "cancelled") && !confirm(`${moveLabel(deal.status, to)} deal ${dealCode(deal.number)}?`)) return;
    start(async () => setMoved(await moveDealAction(deal.id, to)));
  };
  const note = moved.error ?? message?.error;
  const dateInput = "rounded-[3px] bg-white px-1 text-[12.6px] text-[#555]";
  // From the saved values, so the ratios change after Save.
  const m = dealMetrics(deal.fields);
  const LIMITS = limitsFor(lenderFor(deal.fields, useContext(Values).lenders));
  const breakdown: [string, string][] = [
    ["Qualifying rate", pct(m.parts.qualifyingRate)], ["Mortgage payment", money(m.parts.payment)], ["Property taxes", money(m.parts.taxes)],
    ["Heat", money(m.parts.heat)], ["Condo fees", money(m.parts.condo)], ["Other debts", money(m.parts.other)], ["Gross monthly income", money(m.parts.monthlyIncome)],
  ];
  return (
    <div className={cn("z-10 mx-[25px] mb-5 rounded-[3px] bg-[#58595b] p-2.5", view === "modern" && "sticky top-[65px]")}>
      <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[12.6px] text-white">
        View:
        <div className="flex">
          {(["modern", "classic"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn("border border-[#ebebeb] px-[15px] py-[5px] capitalize", view === v ? "bg-[#428bca] text-white" : "bg-white text-[#333]")}
            >
              {v}
            </button>
          ))}
        </div>
        <button type="submit" className={cn(blueBtn, "ml-auto")}>Save</button>
        <details ref={menu} className="relative">
          <summary className={cn(blueBtn, "flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden")}>
            {pending ? "Working..." : "Actions"} <ChevronDown className="size-3.5" />
          </summary>
          <ul className="absolute right-0 z-20 mt-1 w-56 rounded-[3px] border border-[#ddd] bg-white py-1 text-[#333] shadow-lg">
            {allowedMoves(deal.status, deal.previousStatus).map((to) => (
              <li key={to}><button type="button" onClick={() => move(to)} className="w-full px-4 py-1.5 text-left hover:bg-[#f5f5f5]">{moveLabel(deal.status, to)}</button></li>
            ))}
            <li>
              <button type="submit" name="intent" value="validate" onClick={() => menu.current?.removeAttribute("open")} className="w-full px-4 py-1.5 text-left hover:bg-[#f5f5f5]">Save + Validate</button>
            </li>
            <li><button type="button" onClick={remove} className="w-full px-4 py-1.5 text-left text-[#a94442] hover:bg-[#f5f5f5]">Delete Deal</button></li>
            {notBuilt.map((a) => (
              <li key={a}><button type="button" disabled title="Not built yet" className="w-full px-4 py-1.5 text-left text-[#aaa]">{a}</button></li>
            ))}
          </ul>
        </details>
      </div>
      <ul className="flex flex-wrap bg-gradient-to-b from-white to-[#ececec] text-[#444] max-md:text-xs">
        <li className="grid w-[60px] place-items-center bg-[#373839]"><Folder className="size-7 fill-white stroke-white" /></li>
        <li className="w-[30%] min-w-[150px] border-r border-[#d7d7d7] px-[15px] py-[5px]">
          <span className="text-xs text-[#888]">Deal #</span>
          <h2 className="mt-[3px] text-[1.4em] font-medium">{dealCode(deal.number)}</h2>
        </li>
        <li className="border-l border-white px-[15px] py-[5px]">
          <span className="text-xs text-[#888]">Client(s)</span>
          <ul>
            {deal.borrowers.map((b) => (
              <li key={b.id} className="leading-[1.1]"><Link href={`/contacts/${b.id}`} className="text-[#428bca] hover:underline">{b.firstName} {b.lastName}</Link></li>
            ))}
          </ul>
        </li>
        {/* ponytail: reassigning is a later step; the agent is whoever created the deal. */}
        {["Agent", "Assigned"].map((l) => (
          <li key={l} className="px-[15px] py-[5px]">
            <span className="block text-xs text-[#888]">{l}</span>
            <select disabled value={deal.agent} className="text-[12.6px]"><option>{deal.agent}</option></select>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex flex-wrap">
        <Metric label="GDS"><span className={over(m.gds, LIMITS.gds)}>{pct(m.gds)}</span></Metric>
        <Metric label="TDS">
          <details className="relative">
            <summary className={cn("flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden", over(m.tds, LIMITS.tds))}>
              {pct(m.tds)} <ChevronDown className="size-3" />
            </summary>
            <dl className="absolute z-20 mt-1 grid w-64 grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-[3px] border border-[#ddd] bg-white p-3 text-[12px] text-[#333] shadow-lg">
              {breakdown.map(([k, v]) => [<dt key={k}>{k}</dt>, <dd key={k + "v"} className="text-right">{v}</dd>])}
            </dl>
          </details>
        </Metric>
        <Metric label="LTV"><span className={over(m.ltv, LIMITS.uninsuredLtv)}>{pct(m.ltv)}</span></Metric>
        <Metric label="Net Worth">{deal.fields["assetsProperties/Totals/Net Worth"] || "—"}</Metric>
        <Metric label="Status">{statusLabel[deal.status]}</Metric>
        <Metric label="Closing"><input type="date" name="closingDate" defaultValue={deal.closingDate ?? ""} className={dateInput} /></Metric>
        <Metric label="Conditions"><input type="date" name="conditionsDate" defaultValue={deal.conditionsDate ?? ""} className={dateInput} /></Metric>
      </div>
      {(note || message?.ok) && (
        <div className={cn("mt-2.5 flex items-center gap-2 rounded-[3px] border px-[15px] py-2.5", note ? "border-[#ebccd1] bg-[#f2dede] text-[#a94442]" : "border-[#d6e9c6] bg-[#dff0d8] text-[#3c763d]")}>
          {!note && <CheckCircle className="size-4" />} {note ?? message?.ok}
        </div>
      )}
      {message?.problems && (
        <div className={cn("mt-2.5 rounded-[3px] border px-[15px] py-2.5", message.problems.length ? "border-[#ebccd1] bg-[#f2dede] text-[#a94442]" : "border-[#d6e9c6] bg-[#dff0d8] text-[#3c763d]")}>
          {message.problems.length ? (
            <>
              <strong>Validation Errors</strong>
              <ul className="mt-1 list-disc pl-5">
                {message.problems.map((p) => (
                  <li key={p.message}><button type="button" onClick={() => focusField(p.key)} className="text-left hover:underline">{p.message}</button></li>
                ))}
              </ul>
            </>
          ) : "No errors"}
        </div>
      )}
    </div>
  );
}

export function AppDeal({ deal, history, checklist, compliance, tasks, lenders, tab }: { deal: Deal; history: History; checklist: Checklist; compliance: Compliance; tasks: DealTaskList; lenders: LenderChoice[]; tab?: string }) {
  const [view, setView] = useState<"modern" | "classic">("modern");
  const [state, save, saving] = useActionState(async (prev: SaveState | null, form: FormData): Promise<SaveState> => {
    const r = await saveDealAction(deal.id, prev, form);
    return r.error ? r : { ok: "Saved", problems: r.problems };
  }, null);
  const current = dealTabs.find((t) => t.slug === tab);
  const shown = sections.filter((s) => !current || current.sections.includes(s.id));
  const b = deal.borrowers[0];
  const applicant = { "First Name": b?.firstName, "Last Name": b?.lastName, Email: b?.email, "Home Phone": b?.homePhone, "Cell Phone": b?.cellPhone, "Work Phone": b?.workPhone };
  const mirrored = { ...Object.fromEntries(Object.entries(applicant).map(([k, v]) => [`borrowers/Applicant/${k}`, v ?? ""])), "closeOut//Closing Date": deal.closingDate ?? "" };
  const values = { values: { ...deal.fields, ...mirrored }, locked: new Set(Object.keys(mirrored)), lenders };
  const open = !!current || view === "classic";
  return (
    <AppShell deal={{ id: deal.id, number: deal.number }}>
      <section className="relative mx-[25px] mb-5 flex items-center gap-2.5 text-[#666]">
        <FileText className="size-7 stroke-[1.5]" />
        <h1 className="text-[28px] leading-[38px] font-light">{current?.label ?? "Deal Details"}</h1>
        <ol className="ml-auto hidden items-center gap-1 text-xs sm:flex">
          <li><Link href="/" className="text-[#444] hover:underline">Home</Link></li>
          <li className="before:mr-1 before:text-[#ccc] before:content-['>']">
            {current ? <Link href={`/deal/${deal.id}`} className="text-[#444] hover:underline">Deal</Link> : "Deal"}
          </li>
          {current && <li className="before:mr-1 before:text-[#ccc] before:content-['>']">{current.label}</li>}
        </ol>
      </section>
      <ChecklistContext value={checklist}>
      <ComplianceContext value={compliance}>
      <TasksContext value={tasks}>
      <Values value={values}>
        {/* Not action={save}: React resets the form after an action, and selects reset to their mount-time value, which wiped saved choices. */}
        <form
          aria-busy={saving}
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
            startTransition(() => save(data));
          }}
        >
          <Overview deal={deal} view={view} setView={setView} message={state ?? undefined} />
          <div className="mx-[25px]">
            {shown.map((s) => <SectionBox key={s.id} id={s.id} title={s.title} groups={s.groups} open={open} />)}
            {!current && (
              <SectionBox
                title="Status History"
                open={open}
                groups={[{ cols: ["Date", "From", "To", "By"], rows: history.map((h) => [new Date(h.at).toLocaleString("en-CA"), h.from ? statusLabel[h.from] : "Created", statusLabel[h.to], h.actor]) }]}
              />
            )}
          </div>
        </form>
      </Values>
      </TasksContext>
      </ComplianceContext>
      </ChecklistContext>
    </AppShell>
  );
}
