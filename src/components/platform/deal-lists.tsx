"use client";

import { useState, useTransition } from "react";
import { CircleParking, History, RotateCcw } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { moveDealAction } from "@/app/deal/actions";
import { dealCode } from "@/server/deal-status";
import type { DealRow } from "@/server/deals";
import { useSession } from "next-auth/react";
import { placeholderHistorical } from "./placeholder-data";
import { AppShell } from "./shell";
import { blueBtn, greyBtn, Grid, input, Modal, PageHeader, Pager, panel, redBtn } from "./ui";

const fmt = (d: string | null) => !d ? "" : new Date(d + "T00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

const expertStatuses = ["In Progress", "Ready to Submit", "Submitted", "Declined", "Pending", "Approved", "Accepted", "Ready to Close", "Closed", "Confirmed", "Paid", "Complete", "Cancelled", "Rejected"];
const dealStatuses = ["New", "Submitted", "Approved", "Accepted", "Waiting To Close", "Funded", "Complete", "Parked", "Cancelled", "Declined"];

function AsSelect() {
  return (
    <label className="flex items-center gap-2 text-[22px] font-light">
      As:
      <select className="h-[34px] rounded-[3px] border border-[#ccc] px-2 text-sm"><option>{useSession().data?.user?.name}</option></select>
    </label>
  );
}

// Yes/No confirm, or an alert when `onYes` is missing.
type Ask = { text: string; onYes?: () => void } | null;
function Confirm({ ask, close }: { ask: NonNullable<Ask>; close: () => void }) {
  return (
    <Modal
      title={ask.onYes ? "Please confirm" : "Keyway"}
      close={close}
      footer={ask.onYes ? <>
        <button onClick={() => { close(); ask.onYes!(); }} className={cn(blueBtn, "px-4 py-1.5 text-[12.6px]")}>Yes</button>
        <button onClick={close} className={cn(greyBtn, "px-4 py-1.5 text-[12.6px]")}>No</button>
      </> : <button onClick={close} className={cn(blueBtn, "px-4 py-1.5 text-[12.6px]")}>OK</button>}
    >
      <p>{ask.text}</p>
    </Modal>
  );
}

function SelectAllBanner({ all, total, casl }: { all: boolean; total: number; casl?: boolean }) {
  if (!all) return null;
  return (
    <p className="mb-2 bg-[#fcf8e3] p-2 text-center text-[12.6px] text-[#8a6d3b]">
      All the {casl && "CASL "}items are selected for this page, <button className="text-[#428bca] hover:underline">select <b>all</b> {casl && "CASL "}items matching these filters.</button> ({total})
    </p>
  );
}

export function AppHistorical() {
  const [deals, setDeals] = useState(placeholderHistorical);
  const [search, setSearch] = useState("");
  const [appType, setAppType] = useState("All");
  const [expert, setExpert] = useState("All");
  const [newStatus, setNewStatus] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [ask, setAsk] = useState<Ask>(null);

  const q = search.toLowerCase();
  const rows = deals.filter(
    (d) => (appType === "All" || d.appType === appType) && (expert === "All" || d.status === expert) && (!q || [d.name, d.loanCode, d.lender].some((v) => v.toLowerCase().includes(q))),
  );
  const allPicked = rows.length > 0 && rows.every((d) => picked.includes(d.id));
  const apply = () => { setDeals(deals.filter((d) => !picked.includes(d.id))); setPicked([]); setNewStatus(""); };
  const update = () => {
    if (!newStatus) return setAsk({ text: "You must select a status." });
    if (!picked.length) return setAsk({ text: "You must select at least one deal to update the status." });
    const confirm = () => setAsk({ text: "Are you sure you want to update the selected deals?", onYes: apply });
    if (deals.some((d) => picked.includes(d.id) && !d.casl)) setAsk({ text: "At least one record is not CASL compliant. Do you want to continue?", onYes: confirm });
    else confirm();
  };

  return (
    <AppShell>
      <PageHeader icon={History} title="Historical Deals" crumbs={[["Historical Deals"]]}>
        <AsSelect />
      </PageHeader>
      <div className={panel}>
        <div className="flex flex-wrap items-end gap-3 px-[15px] py-2.5 text-[12.6px]">
          <label className="font-semibold text-[#666]">Search:
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your historic deals..." className={cn(input, "mt-1 w-[220px] font-normal")} />
          </label>
          <label className="font-semibold text-[#666]">App Type:
            <select value={appType} onChange={(e) => setAppType(e.target.value)} className={cn(input, "mt-1 w-[140px] font-normal")}>
              {["All", "Pre-Approval", "Approval"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label className="font-semibold text-[#666]">Expert Status:
            <select value={expert} onChange={(e) => setExpert(e.target.value)} className={cn(input, "mt-1 w-[150px] font-normal")}>
              {["All", ...expertStatuses].map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <span className="ml-auto flex flex-wrap items-end gap-2">
            <label className="font-semibold text-[#666]">Change Status to:
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={cn(input, "mt-1 w-[160px] font-normal")}>
                <option value="" />
                {dealStatuses.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <button onClick={update} className={cn(blueBtn, "h-[30px] px-3")}>Update</button>
            <Link href="/deals/historical/restore" className={cn(blueBtn, "flex h-[30px] items-center gap-1 px-3")}><RotateCcw className="size-3.5" /> Restore Historical</Link>
          </span>
        </div>
        <div className="p-[15px] pt-0">
          <SelectAllBanner all={allPicked} total={rows.length} />
          <Grid
            min={900}
            head={[
              <input key="all" type="checkbox" aria-label="Select all" checked={allPicked} onChange={() => setPicked(allPicked ? [] : rows.map((d) => d.id))} />,
              "CASL", "Loan Code", "Name", "Closing Date", "Maturity Date", "Lender", "Rate", "Expert Status",
            ]}
            rows={rows.map((d) => [
              <input key="c" type="checkbox" aria-label={`Select ${d.loanCode}`} checked={picked.includes(d.id)} onChange={() => setPicked(picked.includes(d.id) ? picked.filter((p) => p !== d.id) : [...picked, d.id])} />,
              <input key="casl" type="checkbox" checked={d.casl} readOnly aria-label="CASL" />,
              <Link key="l" href={`/deal?loanCode=${d.loanCode}`} className="text-[#428bca] hover:underline">{d.loanCode}</Link>,
              d.name, fmt(d.closingDate), fmt(d.maturityDate), d.lender, d.rate.toFixed(2) + "%", d.status,
            ])}
          />
          <div className="mt-2"><Pager from={1} to={rows.length} total={rows.length} /></div>
        </div>
      </div>
      {ask && <Confirm ask={ask} close={() => setAsk(null)} />}
    </AppShell>
  );
}

// ponytail: not wired to the database yet, so the list starts empty.
const activeDeals: { id: number; loanCode: string; name: string; stage: string; closingDate?: string }[] = [];
const stages = ["Leads", "Pre-Approvals", "New Deals", "Submitted", "Approved", "Accepted", "Waiting to Close", "Funded + Awaiting Payment", "Declined", "Cancelled"];

export function AppHistoricalRestore() {
  const [deals, setDeals] = useState(activeDeals);
  const [status, setStatus] = useState("All");
  const [picked, setPicked] = useState<number[]>([]);
  const [ask, setAsk] = useState<Ask>(null);
  const rows = deals.filter((d) => status === "All" || d.stage === status);
  const allPicked = rows.length > 0 && rows.every((d) => picked.includes(d.id));
  const restore = () =>
    setAsk(picked.length
      ? { text: "Are you sure you want to restore the selected deals?", onYes: () => { setDeals(deals.filter((d) => !picked.includes(d.id))); setPicked([]); } }
      : { text: "You must select at least one deal to restore to historical." });

  return (
    <AppShell>
      <PageHeader icon={History} title="Restore Historical Deals" crumbs={[["Historical Deals", "/deals/historical"], ["Restore Historical Deals"]]}>
        <AsSelect />
      </PageHeader>
      <div className={panel}>
        <div className="flex flex-wrap items-end gap-3 px-[15px] py-2.5 text-[12.6px]">
          <label className="font-semibold text-[#666]">Deal Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(input, "mt-1 w-[200px] font-normal")}>
              {["All", ...stages].map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <button onClick={restore} className={cn(blueBtn, "ml-auto h-[30px] px-3")}>Restore</button>
        </div>
        <div className="p-[15px] pt-0">
          <SelectAllBanner all={allPicked} total={rows.length} />
          <Grid
            head={[
              <input key="all" type="checkbox" aria-label="Select all" checked={allPicked} onChange={() => setPicked(allPicked ? [] : rows.map((d) => d.id))} />,
              "Loan Code", "Name", "Deal Status", "Closing Date",
            ]}
            rows={rows.map((d) => [
              <input key="c" type="checkbox" aria-label={`Select ${d.loanCode}`} checked={picked.includes(d.id)} onChange={() => setPicked(picked.includes(d.id) ? picked.filter((p) => p !== d.id) : [...picked, d.id])} />,
              d.loanCode, d.name, d.stage, d.closingDate ? fmt(d.closingDate) : "-",
            ])}
          />
          <div className="mt-2"><Pager from={1} to={rows.length} total={rows.length} /></div>
        </div>
      </div>
      {ask && <Confirm ask={ask} close={() => setAsk(null)} />}
    </AppShell>
  );
}

export function AppParked({ deals }: { deals: DealRow[] }) {
  const [search, setSearch] = useState("");
  const [ask, setAsk] = useState<Ask>(null);
  const [, start] = useTransition();
  const q = search.toLowerCase();
  const rows = deals.filter((d) => !q || [d.firstName, d.lastName, dealCode(d.number), d.address].some((v) => v?.toLowerCase().includes(q)));
  // Unparking returns the deal to the status it was parked from.
  const unpark = (d: DealRow) => start(async () => {
    const r = await moveDealAction(d.id, d.previousStatus!);
    if (r.error) setAsk({ text: r.error });
  });
  return (
    <AppShell>
      <PageHeader icon={CircleParking} title="Parked Deals" crumbs={[["Parked Deals"]]}>
        <AsSelect />
      </PageHeader>
      <div className={panel}>
        <div className="flex px-[15px] py-2.5">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className={cn(input, "ml-auto h-[34px] w-[240px]")} />
        </div>
        <div className="p-[15px] pt-0">
          <Grid
            head={["First Name", "Last Name", "Deal #", "Address", "Closing Date", "Conditions Date", "Actions"]}
            rows={rows.map((d) => [
              d.firstName, d.lastName, dealCode(d.number), d.address, fmt(d.closingDate), fmt(d.conditionsDate),
              <span key="a" className="flex gap-1">
                <Link href={`/deal/${d.id}`} className={cn(blueBtn, "px-2 py-0.5 text-xs")}>View</Link>
                <button onClick={() => setAsk({ text: `Unpark deal ${dealCode(d.number)}?`, onYes: () => unpark(d) })} className={cn(redBtn, "px-2 py-0.5 text-xs")}>Unpark</button>
              </span>,
            ])}
          />
          <div className="mt-2"><Pager from={1} to={rows.length} total={rows.length} /></div>
        </div>
      </div>
      {ask && <Confirm ask={ask} close={() => setAsk(null)} />}
    </AppShell>
  );
}
