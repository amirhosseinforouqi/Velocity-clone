"use client";

import { useState } from "react";
import { AlignLeft, ChevronDown, ChevronUp, Cog, ExternalLink, Laptop } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { boardStatuses, dealCode, type DealStatus } from "@/server/deal-status";
import type { DealRow } from "@/server/deals";
import { placeholder } from "./placeholder-data";
import { AppShell, money } from "./shell";

const headers = [
  { name: "Leads", header: "bg-[#d9534f] text-[#f9f9f9]" },
  { name: "Pre-Approvals", header: "bg-[#001f3f] text-[#f9f9f9]" },
  { name: "New Deals", header: "bg-[#00c0ef] text-[#f9f9f9]" },
  { name: "Submitted", header: "bg-[#3c8dbc] text-[#f9f9f9]" },
  { name: "Approved", header: "bg-[#f39c12] text-[#f9f9f9]" },
  { name: "Accepted", header: "bg-[#39cccc] text-[#f9f9f9]" },
  { name: "Waiting to Close", header: "bg-[#3d9970] text-[#f9f9f9]" },
  { name: "Funded + Awaiting Payment", header: "bg-[#00a65a] text-[#f9f9f9]" },
  { name: "Declined", header: "bg-[#eaeaec] text-[#666]" },
  { name: "Cancelled", header: "bg-white text-[#d9534f]" },
];
const stages = headers.map((h, i) => ({ ...h, status: boardStatuses[i][0] as DealStatus }));
const borrower = (d: DealRow) => `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || "(no borrower)";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-11-14" -> "Nov-14-2026", Velocity's MMM-dd-yyyy.
const date = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]}-${d}-${y}`;
};

const label = {
  danger: "bg-[#d9534f]",
  warning: "bg-[#f0ad4e]",
  info: "bg-[#5bc0de]",
};

function Row({ value, tag, color }: { value: string; tag: string; color: string }) {
  return (
    <div className="-mb-px flex items-center border border-[#ddd] bg-white px-3 py-0.5 text-[11.97px] leading-[17px] text-[#666] last:rounded-b">
      <span className="truncate">{value || " "}</span>
      <span className={cn("ml-auto shrink-0 rounded-[2.5px] px-1.5 pt-0.5 pb-[3px] text-[10.17px] leading-none font-bold text-white uppercase", color)}>
        {tag}
      </span>
    </div>
  );
}

function DealCard({ deal }: { deal: DealRow }) {
  return (
    <div className="mb-5 w-full max-w-[270px]">
      <Link href={`/deal/${deal.id}`} className="flex items-center rounded-t border border-[#ddd] bg-[#0073b7] px-3 py-1.5 text-[12.6px] text-white hover:underline">
        <span className="truncate">{borrower(deal)}</span>
        <ExternalLink className="ml-auto size-3 shrink-0" />
      </Link>
      {deal.closingDate && <Row value={date(deal.closingDate)} tag="Close Date" color={label.danger} />}
      {deal.followUpDate && <Row value={date(deal.followUpDate)} tag="Followup" color={label.danger} />}
      {deal.conditionsDate && <Row value={date(deal.conditionsDate)} tag="Conditions" color={label.warning} />}
      {deal.submittedDate && <Row value={date(deal.submittedDate)} tag="Submitted" color={label.info} />}
      {deal.agent && <Row value={deal.agent} tag="Assigned" color={label.info} />}
      {deal.purpose && <Row value={deal.purpose} tag="Purpose" color={label.info} />}
    </div>
  );
}

function StageColumn({ name, header, deals }: { name: string; header: string; deals: DealRow[] }) {
  const [open, setOpen] = useState(true);
  const volume = deals.reduce((a, d) => a + (d.amount ?? 0), 0);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <div className="mb-[25px] w-[310px] shrink-0 rounded-[2px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
      <div className={cn("flex h-[50px] items-start rounded-t-[2px] pt-[15px] pr-2.5 pb-2.5 pl-5 text-sm", header)}>
        <span>{name}</span>
        <button onClick={() => setOpen(!open)} aria-label={open ? "Collapse" : "Expand"} title={open ? "Collapse" : "Expand"} className="ml-auto opacity-80 hover:opacity-100">
          <Chevron className="size-3.5 stroke-[3]" />
        </button>
      </div>
      {open && (
        <>
          <div className="flex gap-5 border-b border-[#f4f4f4] px-5 py-2 text-xs text-[#666]">
            <span>Units: {deals.length}</span>
            <span>Volume: {money(volume)}</span>
          </div>
          <div className="px-5 py-[15px]">
            {deals.map((d) => <DealCard key={d.id} deal={d} />)}
            {deals.length > 3 && (
              <p className="text-center">
                <Link href={`/dashboard/deals/grid?status=${encodeURIComponent(name)}`} className="text-[#428bca] hover:underline">View All</Link>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function AppDeals({ deals }: { deals: DealRow[] }) {
  return (
    <AppShell>
      <section className="relative mx-[25px] mb-10 flex items-center gap-2.5 text-[#666]">
        <Laptop className="size-7 stroke-[1.5]" />
        <h1 className="text-[28px] leading-[38px] font-light">Deals Dashboard</h1>
        <ol className="ml-auto hidden items-center gap-1 text-xs sm:flex">
          <li><Link href="/" className="text-[#444] hover:underline">Home</Link></li>
          <li className="before:mr-1 before:text-[#ccc] before:content-['>']">Deals Dashboard</li>
        </ol>
      </section>
      <section className="flex items-start gap-[30px] overflow-x-scroll px-[25px]">
        {stages.map((s) => <StageColumn key={s.name} {...s} deals={deals.filter((d) => d.status === s.status)} />)}
      </section>
    </AppShell>
  );
}

// Leads have no loan code yet, as in Velocity.
const toGridRow = (d: DealRow) => ({
  ...d,
  name: borrower(d),
  status: stages.find((s) => s.status === d.status)?.name ?? d.status,
  loanCode: d.status === "lead" ? "" : dealCode(d.number),
  login: d.agent,
});
type GridRow = ReturnType<typeof toGridRow>;

const columns: { key: keyof GridRow; label: string; isDate?: boolean }[] = [
  { key: "name", label: "Name" },
  { key: "loanCode", label: "Loan Code" },
  { key: "status", label: "Status" },
  { key: "submittedDate", label: "Submitted", isDate: true },
  { key: "purpose", label: "Purpose" },
  { key: "closingDate", label: "Closing", isDate: true },
  { key: "conditionsDate", label: "Conditions", isDate: true },
  { key: "lender", label: "Lender" },
  { key: "product", label: "Product" },
  { key: "netRate", label: "Net Rate" },
  { key: "login", label: "Associate" },
];

// "2026-11-14" -> "Nov 14, 2026", the grid's MMM dd, yyyy.
const gridDate = (iso?: string | null) => (iso ? date(iso).replace(/-(\d+)-/, " $1, ") : "");

export function AppDealsGrid({ deals, status, noAgent }: { deals: DealRow[]; status?: string; noAgent?: boolean }) {
  const [selected, setSelected] = useState<string[]>(status ? [status] : []);
  const [unassigned, setUnassigned] = useState(false);
  const [noBroker, setNoBroker] = useState(!!noAgent);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [sort, setSort] = useState<{ key: keyof GridRow; reverse: boolean }>({ key: "name", reverse: false });

  // A deal is unassigned once its agent is deactivated and nobody took it over (Admin > Users > Deactivate).
  const rows = deals.map(toGridRow)
    .filter((r) => !selected.length || selected.includes(r.status))
    .filter((r) => !(unassigned || noBroker) || !r.agentActive)
    .filter((r) => (!start || (r.closingDate ?? "") >= start) && (!end || (!!r.closingDate && r.closingDate <= end)))
    .sort((a, b) => String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? "")) * (sort.reverse ? -1 : 1));

  const fieldLabel = "mb-1 block font-bold";
  const dateInput = "h-[34px] rounded-[3px] border border-[#ccc] px-3";
  return (
    <AppShell>
      <section className="relative mx-[25px] mb-5 flex flex-wrap items-center gap-2.5 text-[#666]">
        <Cog className="size-7 stroke-[1.5]" />
        <h1 className="text-[28px] leading-[38px] font-light">Dashboard - Grid</h1>
        <span className="text-[22px] font-light">
          As:{" "}
          <select className="text-base" aria-label="Show deals for"><option>{placeholder.userName}</option></select>
        </span>
        <ol className="ml-auto hidden text-xs sm:block"><li>Dashboard - Grid</li></ol>
      </section>
      <section className="mx-[25px] mb-[25px] rounded-[2px] bg-white text-[#666] shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
        <div className="flex items-center border-b border-[#ddd] pt-[15px] pr-2.5 pb-2.5 pl-5">
          <AlignLeft className="mr-2.5 size-5" />
          <span className="px-[5px] text-[21px] font-light">Dashboard - Grid</span>
          <Link href="/dashboard/deals" className="ml-auto rounded-[3px] border border-[#3d81be] bg-gradient-to-b from-[#428bcd] to-[#3d81be] px-[13px] py-1.5 text-[12.6px] text-white">
            Dashboard - Cards
          </Link>
        </div>
        <div className="px-5 py-[15px] text-[12.6px] leading-[1.9em]">
          <div className="mb-5 flex flex-wrap items-end gap-x-[30px] gap-y-2.5">
            <label className="flex items-center gap-1.5 font-bold">
              <input type="checkbox" checked={unassigned} onChange={(e) => setUnassigned(e.target.checked)} /> Unassigned
            </label>
            <label className="flex items-center gap-1.5 font-bold">
              <input type="checkbox" checked={noBroker} onChange={(e) => setNoBroker(e.target.checked)} /> No Agent
            </label>
            <div className="min-w-[200px] flex-1">
              <span className={fieldLabel}>Status:</span>
              <div className="flex min-h-[34px] flex-wrap items-center gap-1 rounded-[3px] border border-[#ccc] px-1.5 py-1">
                {selected.map((s) => (
                  <span key={s} className="flex items-center gap-1 rounded-[3px] bg-[#428bca] px-1.5 text-xs leading-5 text-white">
                    {s}
                    <button onClick={() => setSelected(selected.filter((x) => x !== s))} aria-label={`Remove ${s}`}>×</button>
                  </span>
                ))}
                <select
                  value=""
                  onChange={(e) => setSelected([...selected, e.target.value])}
                  className="min-w-0 flex-1 bg-transparent text-[#999] outline-none"
                  aria-label="Add status"
                >
                  <option value="">Click here to add status</option>
                  {stages.filter((s) => !selected.includes(s.name)).map((s) => <option key={s.name} className="text-[#333]">{s.name}</option>)}
                </select>
              </div>
            </div>
            <label>
              <span className={fieldLabel}>Start Closing Date:</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={dateInput} />
            </label>
            <label>
              <span className={fieldLabel}>End Closing Date:</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={dateInput} />
            </label>
          </div>
          <div className="min-h-[300px] overflow-x-auto">
            <table className="mb-5 w-full min-w-[900px] table-fixed border border-[#ddd] shadow-[0_0_4px_rgba(0,0,0,0.1)]">
              <thead className="bg-black/60 text-white">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className="border-x border-b border-[#797979] p-2 text-left leading-[1.3] font-normal">
                      <button onClick={() => setSort({ key: c.key, reverse: sort.key === c.key && !sort.reverse })} className="flex items-center gap-1">
                        {c.label}
                        {sort.key === c.key && (sort.reverse ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!rows.length && <tr><td colSpan={columns.length} className="border-t border-[#ddd] p-2">No deals found.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} className="odd:bg-white even:bg-[#fafafa]">
                    {columns.map((c) => (
                      <td key={c.key} className="truncate border-t border-r border-[#ddd] p-2 last:border-r-0">
                        {c.key === "name" ? (
                          r.contactId ? <Link href={`/contacts/${r.contactId}`} className="text-[#428bca] hover:underline">{r.name}</Link> : r.name
                        ) : c.key === "loanCode" ? (
                          r.loanCode && <Link href={`/deal/${r.id}`} className="text-[#428bca] hover:underline">{r.loanCode}</Link>
                        ) : c.isDate ? (
                          gridDate(r[c.key] as string | null)
                        ) : (
                          String(r[c.key] ?? "")
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
