"use client";

import { useState, type ReactNode } from "react";
import { Calendar, ChevronLeft, ChevronRight, Folder, House, Mail, MessageSquare } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DealStatus } from "@/server/deal-status";
import { AppShell, money } from "./shell";

function Card({ header, border, children }: { header: ReactNode; border?: boolean; children: ReactNode }) {
  return (
    <div className="rounded-[2px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
      <div className={cn("flex min-h-[55px] items-center pt-[15px] pr-[10px] pb-[10px] pl-5", border && "border-b border-[#ddd]")}>
        {header}
      </div>
      <div className="px-5 py-[15px] text-[12.6px]">{children}</div>
    </div>
  );
}

const Title = ({ children }: { children: ReactNode }) => (
  <span className="px-[5px] text-[21px] leading-[30px] font-light text-[#666]">{children}</span>
);

function Stepper({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <>
      <button onClick={onPrev} aria-label="Previous" className="pr-2.5 pl-[20px]"><ChevronLeft className="size-[21px] stroke-[1.25]" /></button>
      <Title>{label}</Title>
      <button onClick={onNext} aria-label="Next" className="pl-[20px]"><ChevronRight className="size-[21px] stroke-[1.25]" /></button>
    </>
  );
}

function EmptyList({ text }: { text: string }) {
  return (
    <ul className="mb-[19px]">
      <li className="rounded-t border border-l-[7px] border-[#666] bg-[#999] py-2.5 pr-[76px] pl-[15px] text-[#efefef]">{text}</li>
      <li className="h-[46px] border-t border-[#ddd]" />
      <li className="h-[46px]" />
      <li className="h-[46px]" />
    </ul>
  );
}

function CalendarCard() {
  const [day, setDay] = useState(() => new Date());
  const shift = (d: number) => setDay((x) => new Date(x.getFullYear(), x.getMonth(), x.getDate() + d));
  const label = day.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <Card border header={<><Calendar className="mr-[3px] size-[21px] stroke-[1.5]" /><Stepper label={label} onPrev={() => shift(-1)} onNext={() => shift(1)} /></>}>
      <EmptyList text="No appointments for today." />
      <EmptyList text="No CRM calendar items for today." />
      <p className="mt-[29px] mb-[13px] text-center">
        <a href="/calendar" className="text-[#428bca] hover:underline">View Full Calendar</a>
      </p>
    </Card>
  );
}

function Stage({ label, count, amount, className }: { label: string; count: number; amount?: number; className: string }) {
  return (
    <li className={cn("absolute w-[120px] text-[#777]", className)}>
      <span className="block text-base leading-[22px]">{label}</span>
      <span className="text-sm leading-6">
        {count}
        {amount !== undefined && <> / <strong>{money(amount)}</strong></>}
      </span>
    </li>
  );
}

type DealSummary = { status: DealStatus; amount: number }[];
const stage = (deals: DealSummary, ...statuses: DealStatus[]) => {
  const ds = deals.filter((d) => statuses.includes(d.status));
  return { count: ds.length, amount: ds.reduce((a, d) => a + d.amount, 0) };
};

// ponytail: counts cover every year; the year stepper is display-only until deals are filtered by date.
function DealsCard({ deals }: { deals: DealSummary }) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const s = {
    leads: { count: stage(deals, "lead").count }, preApproval: stage(deals, "pre_approval"),
    pipeline: stage(deals, "new_deal", "submitted", "approved", "accepted"), wtc: stage(deals, "waiting_to_close"), funded: stage(deals, "funded"),
  };
  const active = deals.filter((d) => !["declined", "cancelled", "complete", "parked"].includes(d.status)).length;
  return (
    <Card header={<><Title>Deals Overview</Title><Stepper label={String(year)} onPrev={() => setYear(year - 1)} onNext={() => setYear(year + 1)} /></>}>
      <div className="mt-2.5 space-y-1.5 text-center text-sm leading-[19px] font-light text-[#666]">
        <p>You currently have <strong className="font-bold text-[#0073b7]">[{active}]</strong> total active deals.</p>
        <p>You have cancelled <strong className="font-bold text-[#00a65a]">[{stage(deals, "cancelled").count}]</strong> deals.</p>
      </div>
      <ul className="relative mx-auto mt-[24px] h-[290px] max-w-[500px] max-sm:-my-[60px] max-sm:scale-[0.55]">
        <Stage label="Pre-Approval" {...s.preApproval} className="top-[3px] left-[calc(50%-65px)] text-center" />
        <Stage label="Leads" {...s.leads} className="top-[94px] left-[calc(50%-251px)] text-right" />
        <Stage label="Pipeline" {...s.pipeline} className="top-[94px] left-[calc(50%+129px)]" />
        <Stage label="Funded" {...s.funded} className="top-[209px] left-[calc(50%-251px)] text-right" />
        <Stage label="WTC" {...s.wtc} className="top-[209px] left-[calc(50%+129px)]" />
      </ul>
      <p className="mt-[27px] mb-[16px] text-center">
        <Link href="/dashboard/deals" className="text-[#428bca] hover:underline">Go to Deals Dashboard</Link>
      </p>
    </Card>
  );
}

const btn = "flex h-[34px] items-center gap-[5px] rounded-[3px] border px-[13px] text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]";

function MessageCard() {
  return (
    <Card
      header={
        <>
          <Title>Message Centre</Title>
          <a href="/messages" className={cn(btn, "ml-auto border-[#3d81be] bg-gradient-to-b from-[#428bcd] to-[#3d81be]")}>
            View All <Folder className="size-3.5 fill-white" />
          </a>
          <button className={cn(btn, "ml-2 border-[#57ad57] bg-gradient-to-b from-[#5cb85c] to-[#57ad57]")}>
            Send Message <Mail className="size-3.5 fill-white stroke-[#57ad57]" />
          </button>
        </>
      }
    >
      <ul className="mb-[76px]">
        <li className="flex h-[85px] items-center justify-center gap-1 rounded-t border border-[#ddd] pt-[15px] pb-3 font-bold text-[#666]">
          <MessageSquare className="size-3.5 fill-[#666]" /> No messages!
        </li>
        <li className="h-20 border-t border-[#ddd]" />
        <li className="h-20" />
        <li className="h-20" />
      </ul>
    </Card>
  );
}

type Crm = { label: string; count: number; color: string }[];

function Donut({ crm }: { crm: Crm }) {
  const total = crm.reduce((a, c) => a + c.count, 0);
  const r = 80;
  const C = 2 * Math.PI * r;
  return (
    <svg width="255" height="240" viewBox="0 0 255 240" aria-label="CRM opportunities chart">
      <g transform="rotate(-90 127.5 120)">
        {!total && <circle cx="127.5" cy="120" r={r} fill="none" stroke="#ddd" strokeWidth="45" />}
        {!!total && crm.map((c, i) => {
          const len = (c.count / total) * C;
          const offset = crm.slice(0, i).reduce((a, p) => a + (p.count / total) * C, 0);
          const el = (
            <circle key={c.label} cx="127.5" cy="120" r={r} fill="none" stroke={c.color} strokeWidth="45" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
          );
          return el;
        })}
      </g>
    </svg>
  );
}

// ponytail: only pre-approvals are counted; birthdays, anniversaries and maturities show 0 until contacts store those dates.
function CrmCard({ preApprovals }: { preApprovals: number }) {
  const crm: Crm = [
    { label: "Pre-Approvals", count: preApprovals, color: "#30718f" },
    { label: "Birthdays", count: 0, color: "#12a4a1" },
    { label: "Anniversaries", count: 0, color: "#1563c5" },
    { label: "Maturities", count: 0, color: "#0092e7" },
  ];
  const total = crm.reduce((a, c) => a + c.count, 0);
  return (
    <Card header={<Title>CRM Overview</Title>}>
      <p className="mt-2.5 text-sm leading-[19px] font-light text-[#666]">
        You have <strong className="font-bold">[{total}]</strong> opportunities over the next 30 days.
      </p>
      <div className="mt-10 flex flex-wrap items-start justify-center gap-[26px]">
        <Donut crm={crm} />
        <ul className="mt-5 border border-[#0d4676] bg-[rgba(240,240,240,0.7)] px-[15px] py-2.5">
          {crm.map((c) => (
            <li key={c.label} className="flex h-6 items-center gap-1">
              <span className="size-[11px]" style={{ background: c.color }} /> {c.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="h-[101px]" />
    </Card>
  );
}


type PortalSummary = Awaited<ReturnType<typeof import("@/server/portal").portalDashboard>>;

// Client portal work waiting on staff. Counts cover the deals this user can see.
function PortalCard({ p }: { p: PortalSummary }) {
  const tiles: [string, number][] = [
    ["Pending invitations", p.pendingInvitations], ["Unread messages", p.unreadMessages], ["Outstanding documents", p.outstandingDocuments], ["Awaiting review", p.awaitingReview],
  ];
  return (
    <div className="min-[1200px]:col-span-2">
      <Card border header={<Title>Client Portal</Title>}>
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map(([t, n]) => <li key={t} className="rounded-[3px] border border-[#ddd] p-3 text-center"><span className="block text-[26px] font-light text-[#428bca]">{n}</span>{t}</li>)}
        </ul>
        {p.expiredInvitations > 0 && <p className="mb-3 text-[#8a6d3b]">{p.expiredInvitations} invitation{p.expiredInvitations > 1 ? "s have" : " has"} expired without being accepted.</p>}
        <h3 className="mb-1 font-semibold text-[#666]">Applications needing attention</h3>
        {p.attention.length ? (
          <ul className="mb-4 divide-y divide-[#eee]">
            {p.attention.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-3 py-1.5">
                <Link href={`/deal/${a.id}/clientPortal`} className="text-[#428bca] hover:underline">{a.code}</Link>
                <span>{a.client}</span><span className="text-[#999]">{a.assignee ?? "Unassigned"}</span><span className="ml-auto text-[#a94442]">{a.reasons.join(", ")}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mb-4 text-[#999]">Nothing waiting on you.</p>}
        <h3 className="mb-1 font-semibold text-[#666]">Recent portal activity</h3>
        {p.activity.length ? (
          <ul className="max-h-[200px] overflow-y-auto">
            {p.activity.map((a) => <li key={a.id} className="py-0.5"><span className="text-[#999]">{new Date(a.at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}</span> {a.code}: {a.action.replace("portal_", "").replaceAll("_", " ")} <span className="text-[#999]">{a.who}</span></li>)}
          </ul>
        ) : <p className="text-[#999]">No activity yet.</p>}
      </Card>
    </div>
  );
}
export function AppHome({ portal, deals }: { portal: PortalSummary; deals: DealSummary }) {
  return (
    <AppShell>
      <header className="relative mx-[25px] mb-5 h-[58px] pl-[60px] text-[#666]">
        <House className="absolute top-0 left-0 size-[50px] fill-[#666] stroke-[#666]" />
        <h1 className="text-[28px] leading-[38px] font-light uppercase">Home</h1>
        <span className="block text-[11px] uppercase">Home</span>
      </header>
      <section className="mx-[25px] grid items-start gap-x-[30px] gap-y-[25px] min-[1200px]:grid-cols-2">
        <CalendarCard />
        <DealsCard deals={deals} />
        <MessageCard />
        <CrmCard preApprovals={stage(deals, "pre_approval").count} />
        <PortalCard p={portal} />
      </section>
    </AppShell>
  );
}
