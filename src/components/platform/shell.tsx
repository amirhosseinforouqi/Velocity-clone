"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Bookmark,
  Calculator,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleParking,
  CirclePlus,
  CircleUserRound,
  CloudSun,
  Contact,
  FileChartLine,
  FileCheck,
  FileText,
  Gauge,
  History,
  House,
  KeyRound,
  LifeBuoy,
  Mail,
  MessageSquareWarning,
  Search,
  Settings,
  Shield,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { topBarAction } from "@/app/deal/actions";
import { readNotificationsAction, topBarPortalAction } from "@/app/deal/portal-actions";
import { logout } from "@/app/login/actions";
import { cn } from "@/lib/utils";
import { dealTabs } from "./deal-sections";
import { dealCode } from "@/server/deal-status";
import { placeholderNewApps, placeholderRecentDeals } from "./placeholder-data";
import { CalculatorModal, calculators, type CalcKind } from "./calculators";
import { AddModal, type AddKind } from "./add";


export const money = (n: number) => "$" + n.toLocaleString("en-CA");

type MenuItem = {
  label: string;
  icon: LucideIcon;
  href?: string;
  expand?: boolean;
  badge?: string;
  children?: { label: string; href?: string; add?: AddKind }[];
};

const DEAL = "Deal"; // replaced by the open deal's menu, hidden when no deal is open
export type OpenDeal = { id: string; number: number };

const menuItems: MenuItem[] = [
  {
    label: "Add",
    icon: CirclePlus,
    expand: true,
    children: [
      { label: "Client Experience", add: "clientExperience" },
      { label: "Application", add: "application" },
      { label: "Contact", add: "contact" },
      { label: "Lead", add: "lead" },
    ],
  },
  { label: "Home", icon: House, href: "/" },
  { label: "Dashboard", icon: Gauge, href: "/dashboard/deals" },
  {
    label: "Contacts",
    icon: Contact,
    expand: true,
    children: [{ label: "List", href: "/contacts" }, { label: "Merge Contacts", href: "/contacts/merge" }],
  },
  { label: "My Day", icon: CloudSun, href: "/my-day" },
  {
    label: "Reports",
    icon: FileChartLine,
    expand: true,
    children: [
      { label: "Build a Report", href: "/reports/build" },
      { label: "One-Touch", href: "/reports/one-touch" },
      { label: "Production", href: "/reports/production" },
      { label: "No Agent Assigned", href: "/dashboard/deals/grid?noAgent=true" },
      { label: "Pipeline", href: "/reports/pipeline" },
      { label: "SLA", href: "/reports/sla" },
      { label: "Credit Bureau", href: "/reports/credit-bureau" },
      { label: "Borrower Risk Assessment", href: "/reports/borrower-risk" },
      { label: "Borrower Sanction Screening", href: "/reports/sanction-screening" },
    ],
  },
  { label: "Calendar", icon: CalendarDays, href: "/calendar" },
  {
    label: DEAL,
    icon: FileText,
    expand: true,
    children: [],
  },
  {
    label: "Previous Deals",
    icon: FileCheck,
    expand: true,
    children: placeholderRecentDeals.map((d) => ({ label: `${d.loanCode} - ${d.name}`, href: `/deal?loanCode=${d.loanCode}` })),
  },
  { label: "Tools", icon: Wrench, expand: true, children: [{ label: "Importer", href: "/tools/importer" }] },
  { label: "Historical Deals", icon: History, href: "/deals/historical" },
  { label: "Parked Deals", icon: CircleParking, href: "/deals/parked" },
  { label: "Admin", icon: Shield, expand: true, children: [
    { label: "Offices", href: "/admin/office/list" }, { label: "Users", href: "/admin/users" }, { label: "User Matrix", href: "/admin/user-matrix" },
    { label: "Lenders", href: "/admin/lenders" }, { label: "Lender Matrix", href: "/admin/lender-matrix" }, { label: "Logs", href: "/admin/logs" }, { label: "Condition Library", href: "/admin/conditions" }, { label: "Compliance", href: "/compliance/dashboard" },
    { label: "Organization", href: "/admin/organization/edit" }, { label: "Client Portal", href: "/admin/client-portal" }, { label: "Progress Stages", href: "/admin/stages" },
    { label: "Document Checklists", href: "/admin/checklists" }, { label: "Email Templates", href: "/admin/email-templates" },
  ] },
  { label: "Support", icon: LifeBuoy, expand: true, children: [{ label: "Email Domains", href: "/support/email-configuration/domains" }, { label: "Webhooks", href: "/support/webhook/list" }] },
];

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute -top-[9px] -right-[10px] grid size-[18px] place-items-center rounded-full bg-[#808080] text-[10px] leading-none text-white">
      {n}
    </span>
  );
}

// ponytail: no help centre yet; one support contact until help content exists.
const helpLinks: [string, string][] = [["Contact support", "mailto:support@example.com"]];

const meLinks: [string, string][] = [
  ["Settings", "/user/settings"],
  ["Profile", "/user/profile"],
  ["Two-Step Verification", "/user/mfa"],
  ["Compliance Settings", "/account/settings/compliance"],
  ["Workflows", "/workflows"],
];

type Menu = "calc" | "help" | "tasks" | "apps" | "msgs" | "rem" | "me" | null;

function Drop({ open, wide, children }: { open: boolean; wide?: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className={cn("absolute top-full right-0 z-40 mt-2 rounded-[3px] border border-[#ddd] bg-white text-[12.6px] font-normal text-[#333] shadow-lg", wide ? "w-[300px]" : "w-[220px]")}>{children}</div>;
}

function Feed({ header, items, all, href, mark, onMark }: { header: string; items: { key: string | number; text: string; sub: string; href: string }[]; all: string; href: string; mark?: string; onMark?: () => void }) {
  return (
    <>
      <p className="border-b border-[#eee] px-3 py-2 font-semibold">{header}</p>
      <ul className="max-h-[260px] overflow-y-auto">
        {items.map((i) => (
          <li key={i.key}><Link href={i.href} className="block border-b border-[#f4f4f4] px-3 py-2 hover:bg-[#f5f5f5]">{i.text}<span className="block text-[11px] text-[#999]">{i.sub}</span></Link></li>
        ))}
      </ul>
      <div className="flex justify-between px-3 py-2">
        {all ? <Link href={href} className="text-[#428bca] hover:underline">{all}</Link> : <span />}
        {mark && <button onClick={onMark} className="text-[#428bca] hover:underline">{mark}</button>}
      </div>
    </>
  );
}

function TopBar() {
  const router = useRouter();
  const [open, setOpen] = useState<Menu>(null);
  const [calc, setCalc] = useState<CalcKind | null>(null);
  const [seen, setSeen] = useState<Menu[]>([]);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("All");
  const toggle = (m: Menu) => setOpen(open === m ? null : m);
  const icon = "size-[18px] fill-[#666] stroke-[#666]";
  const count = (m: Menu, n: number) => (seen.includes(m) ? 0 : n);
  // Unread client portal messages and staff notifications, re-read on navigation and every 30 seconds.
  const [portal, setPortal] = useState<{ messages: { dealId: string; code: string; count: number }[]; notifications: { id: string; title: string; href: string; at: Date; read: boolean }[]; unreadNotifications: number }>({ messages: [], notifications: [], unreadNotifications: 0 });
  // ponytail: refetched on every navigation; move to a layout-level context if it shows up in profiles.
  const path = usePathname();
  const [{ tasks, reminders }, setBar] = useState<Awaited<ReturnType<typeof topBarAction>>>({ tasks: [], reminders: [] });
  useEffect(() => { topBarAction().then(setBar, () => {}); }, [path]);
  useEffect(() => {
    const load = () => topBarPortalAction().then((r) => r.data && setPortal(r.data), () => {});
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 30000);
    return () => clearInterval(t);
  }, [path]);
  const unreadMsgs = portal.messages.reduce((n, m) => n + m.count, 0);
  const readAll = () => { setSeen([...seen, "rem"]); setPortal({ ...portal, unreadNotifications: 0 }); void readNotificationsAction(); };
  return (
    <nav className="fixed inset-x-0 top-0 z-30 flex h-[60px] items-center border-b border-[#eee] bg-white">
      {open && <div className="fixed inset-0 z-30" onClick={() => setOpen(null)} />}
      <Link href="/" className="ml-[19px] flex h-[51px] w-[140px] shrink-0 items-center gap-2 text-[22px] font-semibold tracking-tight text-[#2c3e50] sm:w-[213px]"><KeyRound className="size-6 text-[#3d81be]" />Keyway</Link>
      <form className="mx-4 hidden h-9 w-[819px] shrink md:flex xl:mr-0 xl:ml-[257px]" onSubmit={(e) => { e.preventDefault(); router.push(`/search?q=${encodeURIComponent(q)}&scope=${scope}`); }}>
        <label className="relative flex w-[100px] shrink-0 items-center rounded-l-[3px] bg-gradient-to-b from-[#428bcd] to-[#3d81be] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="h-full w-full appearance-none bg-transparent pl-4 text-sm outline-none" aria-label="Search scope">
            {["All", "Deals", "Contacts", "Leads"].map((o) => <option key={o} className="text-[#333]">{o}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 size-4" />
        </label>
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#666]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-full w-full border border-[#3d81be] pr-0.5 pl-[35px] text-sm text-[#333] outline-none placeholder:text-[#777]"
            placeholder="Search Keyway..."
          />
        </div>
        <Link href="/search?advanced=1" className="flex w-[110px] shrink-0 items-center justify-center border border-[#428bca] bg-white text-[11.2px] text-[#428bca]">
          Advanced Search
        </Link>
      </form>
      <div className="relative z-40 ml-auto flex items-center gap-[14px] pr-[17px] sm:gap-[22px] text-[#666]">
        <span className="relative hidden lg:block">
          <button onClick={() => toggle("calc")} className="flex h-[30px] items-center gap-2 rounded-[3px] border border-[#ccc] px-2.5 text-[12.6px] font-semibold">
            <Calculator className="size-[14px]" /> Calculators <span className="border-x-4 border-t-4 border-x-transparent border-t-[#666]" />
          </button>
          <Drop open={open === "calc"}>
            {calculators.map((c) => <button key={c} onClick={() => { setCalc(c); setOpen(null); }} className="block w-full px-3 py-2 text-left hover:bg-[#f5f5f5]">{c}</button>)}
          </Drop>
        </span>
        <span className="relative hidden sm:block">
          <button onClick={() => toggle("help")} className="flex items-center gap-1 text-xs font-semibold"><MessageSquareWarning className="size-5 fill-[#666] stroke-white" /> Help</button>
          <Drop open={open === "help"} wide>
            <ul className="max-h-[320px] overflow-y-auto">{helpLinks.map(([t, h]) => <li key={t}><a href={h} target="_blank" rel="noreferrer" className="block border-b border-[#f4f4f4] px-3 py-2 hover:bg-[#f5f5f5]">{t}</a></li>)}</ul>
          </Drop>
        </span>
        <span className="relative">
          <button onClick={() => toggle("tasks")} aria-label="Tasks" className="relative block"><Check className="size-[19px] stroke-[#666] stroke-[3.5]" /><Badge n={tasks.length} /></button>
          <Drop open={open === "tasks"} wide>
            <Feed header={`You have ${tasks.length} open tasks`} items={tasks.map((t) => ({ key: t.id, text: t.title, sub: t.dealNumber ? dealCode(t.dealNumber) : "", href: "/my-day" }))} all="See all tasks" href="/my-day" />
          </Drop>
        </span>
        <span className="relative">
          <button onClick={() => toggle("apps")} aria-label="New applications" className="relative block"><Bookmark className={icon} /><Badge n={count("apps", placeholderNewApps.length)} /></button>
          <Drop open={open === "apps"} wide>
            <Feed header={`You have ${count("apps", placeholderNewApps.length)} new applications`} items={placeholderNewApps.map((a) => ({ key: a.id, text: `${a.firstName} ${a.lastName} - ${money(a.amount)}`, sub: `${a.source} · ${a.entryDate}`, href: "/deals/new-applications" }))} all="See all new applications" href="/deals/new-applications" mark="Mark all as viewed" onMark={() => setSeen([...seen, "apps"])} />
          </Drop>
        </span>
        <span className="relative hidden sm:block">
          <button onClick={() => toggle("msgs")} aria-label="Client messages" className="relative block"><Mail className="size-[19px] fill-[#666] stroke-white" /><Badge n={unreadMsgs} /></button>
          <Drop open={open === "msgs"} wide>
            <Feed header={`You have ${unreadMsgs} unread client messages`} items={portal.messages.map((m) => ({ key: m.dealId, text: `${m.count} unread`, sub: m.code, href: `/deal/${m.dealId}/clientPortal` }))} all="See all messages" href="/messages" />
          </Drop>
        </span>
        <span className="relative hidden sm:block">
          <button onClick={() => toggle("rem")} aria-label="Notifications and reminders" className="relative block"><Bell className={icon} /><Badge n={count("rem", reminders.length) + portal.unreadNotifications} /></button>
          <Drop open={open === "rem"} wide>
            {portal.notifications.length > 0 && <Feed header={`You have ${portal.unreadNotifications} new notifications`} items={portal.notifications.map((n) => ({ key: n.id, text: `${n.read ? "" : "• "}${n.title}`, sub: new Date(n.at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }), href: n.href }))} all="" href="" mark="Mark all as read" onMark={readAll} />}
            <Feed header={`You have ${count("rem", reminders.length)} reminders`} items={reminders.map((r) => ({ key: r.id, text: `${r.level}: ${r.firstName ?? ""} ${r.lastName ?? ""}`, sub: r.closingDate ? `Closing ${r.closingDate}` : "", href: `/deal/${r.id}` }))} all="See all reminders" href="/deals/reminders" mark="Mark all as read" onMark={readAll} />
          </Drop>
        </span>
        <span className="relative">
          <button onClick={() => toggle("me")} className="flex items-center gap-1 text-sm font-semibold">
            <Settings className="size-[19px] fill-[#666] stroke-white" /> Me
            <span className="border-x-4 border-t-4 border-x-transparent border-t-[#666]" />
          </button>
          <Drop open={open === "me"}>
            {meLinks.map(([t, h]) => h.startsWith("/")
              ? <Link key={t} href={h} onClick={() => setOpen(null)} className="block px-3 py-2 hover:bg-[#f5f5f5]">{t}</Link>
              : <a key={t} href={h} className="block px-3 py-2 hover:bg-[#f5f5f5]">{t}</a>)}
            <p className="border-t border-[#eee] px-3 py-2 text-[#999]">Access: DEMO0001</p>
            <form action={logout}>
              <button className="block w-full border-t border-[#eee] px-3 py-2 text-left hover:bg-[#f5f5f5]">Log Out</button>
            </form>
          </Drop>
        </span>
      </div>
      {calc && <CalculatorModal kind={calc} close={() => setCalc(null)} />}
    </nav>
  );
}

// Open by default on desktop, closed on mobile; `toggled` flips whichever default applies.
function Sidebar({ toggled, onToggle, deal }: { toggled: boolean; onToggle: () => void; deal?: OpenDeal }) {
  const path = usePathname();
  const menu = menuItems.flatMap((m) => m.label !== DEAL ? [m] : deal ? [{
    ...m, label: `Deal: [${dealCode(deal.number)}]`,
    children: [{ label: "Full Details", href: `/deal/${deal.id}` }, ...dealTabs.map((t) => ({ label: t.label, href: `/deal/${deal.id}/${t.slug}` }))],
  }] : []);
  const [adding, setAdding] = useState<AddKind | null>(null);
  const [expanded, setExpanded] = useState(
    () => menu.find((m) => m.children?.some((c) => c.href?.startsWith("/") && (path + "/").startsWith(c.href + "/")))?.label ?? "",
  );
  return (
    <>
    <aside
      className={cn(
        "fixed top-[60px] bottom-0 left-0 z-20 flex w-[250px] flex-col bg-[#111] transition-transform",
        toggled ? "md:-translate-x-full" : "max-md:-translate-x-full",
      )}
    >
      <button
        onClick={onToggle}
        aria-label="Toggle menu"
        className={cn(
          "absolute top-[30px] -right-3 grid size-[25px] place-items-center rounded-full bg-white text-[#333] shadow",
          toggled ? "md:-right-[30px]" : "max-md:-right-[30px]",
        )}
      >
        <ChevronLeft className={cn("size-4", toggled ? "md:rotate-180" : "max-md:rotate-180")} />
      </button>
      <div className="flex items-center gap-[5px] px-[25px] pt-[22px] pb-[15px] text-sm font-semibold text-[#eee]">
        <CircleUserRound className="size-5 stroke-[1.25]" /> {useSession().data?.user?.name}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto text-[12.6px] text-[#a1a1a1]">
        {menu.map((m) => {
          const inner = (
            <>
              <m.icon className="mr-[11px] size-[15px] shrink-0 stroke-[1.25]" />
              <span>{m.label}</span>
              {m.badge && <span className="ml-1 rounded bg-white px-1 py-px text-[8.8px] leading-3 text-[#111]">{m.badge}</span>}
              {m.expand && <ChevronLeft className={cn("ml-2 size-3.5 stroke-[3] transition-transform", expanded === m.label && "-rotate-90")} />}
            </>
          );
          const cls = "flex items-center px-[15px] py-3 hover:text-white";
          const open = expanded === m.label && m.children;
          return (
            <li key={m.label}>
              {!m.href ? (
                <>
                  <button onClick={() => setExpanded(open ? "" : m.label)} className={cn(cls, "w-full", open && "text-white")}>{inner}</button>
                  {open && (
                    <ul className="bg-[#1e1e1e] py-1">
                      {m.children!.map((c) => (
                        <li key={c.label}>
                          {c.add ? (
                            <button onClick={() => setAdding(c.add!)} className="block w-full py-[7px] pr-[15px] pl-[41px] text-left hover:text-white">{c.label}</button>
                          ) : (
                            <Link href={c.href!} className={cn("block py-[7px] pr-[15px] pl-[41px] hover:text-white", path === c.href && "text-white")}>
                              {c.label}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : m.href.startsWith("/") ? (
                <Link href={m.href} className={cls}>{inner}</Link>
              ) : (
                <a href={m.href} className={cls}>{inner}</a>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
    {adding && <AddModal kind={adding} close={() => setAdding(null)} />}
    </>
  );
}

export function AppShell({ children, deal }: { children: ReactNode; deal?: OpenDeal }) {
  const [toggled, setToggled] = useState(false);
  return (
    <div className="min-h-screen bg-[#f1f1f1] font-sans text-sm text-[#333]">
      <TopBar />
      <Sidebar toggled={toggled} onToggle={() => setToggled(!toggled)} deal={deal} />
      <main className={cn("pt-[75px] pb-6 transition-[margin]", !toggled && "md:ml-[250px]")}>{children}</main>
    </div>
  );
}
