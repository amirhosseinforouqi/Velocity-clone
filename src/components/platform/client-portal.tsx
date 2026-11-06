"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, Check, CircleAlert, CircleCheck, Clock, CloudUpload, FileText, House, Inbox, KeyRound, LoaderCircle, LogOut, Upload, X, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clientAddVersionAction, clientFinishUploadAction, clientLogout, clientMarkReadAction, clientReplyAction, clientStartConversationAction, clientStartUploadAction,
  readClientNotificationsAction, saveProfileAction,
} from "@/app/portal/actions";
import type { ClientDealView, clientDeals } from "@/server/portal-client";
import { Err, GridPanel, useRun } from "./admin";
import { ConversationList, FileLink, Thread, UploadButton, usePoll } from "./deal-portal";
import { blueBtn, greenBtn, greyBtn, input, label, panel } from "./ui";
import { ACCEPT, statusTone, uploadFile, when } from "./upload";

// ---- Look: the staff app's panels, buttons and fields (ui.tsx).

const btn = "inline-flex h-[30px] items-center justify-center gap-1.5 px-3 text-[12.6px] whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60";
const sub = "text-[12px] font-semibold tracking-wide text-[#999] uppercase";

type Note = { id: string; title: string; href: string | null; at: Date; read: boolean };

// ---- Shell: the staff top bar, without the staff sidebar.

export function PortalShell({ name, unread, notes, children }: { name: string; unread: { messages: number; notifications: number }; notes: Note[]; children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(unread.notifications);
  usePoll(30000);
  const toggle = () => {
    setOpen(!open);
    if (!open && count) { setCount(0); void readClientNotificationsAction(); }
  };
  const nav = [["My applications", "/portal"], ["Profile", "/portal/profile"]] as const;
  return (
    <div className="min-h-screen bg-[#f1f1f1] font-sans text-sm text-[#333]">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[#eee] bg-white">
        <div className="mx-auto flex h-[60px] max-w-[1100px] items-center gap-2 px-4">
          <Link href="/portal" className="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-[#2c3e50]" aria-label="Keyway home">
            <KeyRound className="size-6 text-[#3d81be]" aria-hidden /><span className="hidden sm:inline">Keyway</span>
          </Link>
          <span className="hidden text-xs font-semibold tracking-wide text-[#3d81be] uppercase md:inline">Client Portal</span>
          <nav className="ml-auto flex items-center gap-0.5 sm:gap-1" aria-label="Portal">
            {nav.map(([t, h]) => (
              <Link key={h} href={h} aria-current={path === h ? "page" : undefined}
                className={cn("rounded-[3px] px-2 py-1.5 whitespace-nowrap hover:bg-[#f5f5f5]", path === h && "font-semibold text-[#3d81be]")}>
                {t === "My applications" ? <><span className="sm:hidden">Home</span><span className="hidden sm:inline">{t}</span></> : t}
                {h === "/portal" && unread.messages > 0 && <span className="ml-1 rounded-full bg-[#d9534f] px-1.5 text-[11px] text-white" aria-label={`${unread.messages} unread messages`}>{unread.messages}</span>}
              </Link>
            ))}
            <div className="relative">
              <button onClick={toggle} aria-expanded={open} aria-label={`Notifications${count ? `, ${count} unread` : ""}`} className="relative grid size-9 place-items-center rounded-[3px] hover:bg-[#f5f5f5]">
                <Bell className="size-5 text-[#555]" />
                {count > 0 && <span className="absolute top-0 right-0 grid size-[18px] place-items-center rounded-full bg-[#d9534f] text-[10px] text-white">{count}</span>}
              </button>
              {open && (
                <div className="absolute right-0 z-40 mt-1 w-[min(300px,calc(100vw-2rem))] rounded-[3px] border border-[#ddd] bg-white shadow-lg">
                  <p className="border-b border-[#eee] px-3 py-2 font-semibold">Notifications</p>
                  <ul className="max-h-[320px] overflow-y-auto">
                    {notes.length ? notes.map((n) => {
                      const inner = <>{n.title}<span className="block text-[11px] text-[#999]">{when(n.at)}</span></>;
                      return (
                        <li key={n.id} className="border-b border-[#f4f4f4] last:border-0">
                          {n.href ? <Link href={n.href} onClick={() => setOpen(false)} className="block px-3 py-2 hover:bg-[#f5f5f5]">{inner}</Link> : <p className="px-3 py-2">{inner}</p>}
                        </li>
                      );
                    }) : <li className="px-3 py-3 text-[#999]">You&apos;re all caught up.</li>}
                  </ul>
                </div>
              )}
            </div>
            <form action={clientLogout}><button className="grid h-9 place-items-center rounded-[3px] px-2 whitespace-nowrap hover:bg-[#f5f5f5]" title={name} aria-label={`Sign out ${name}`}><LogOut className="size-5 text-[#555] sm:hidden" aria-hidden /><span className="hidden sm:inline">Sign out</span></button></form>
          </nav>
        </div>
      </header>
      {/* panel's 25px side margin is for the staff sidebar layout; the portal is centred instead */}
      <main className="mx-auto max-w-[1100px] px-4 pt-[75px] pb-6 [&_section]:mx-0">{children}</main>
    </div>
  );
}

// Staff page title (as PageHeader in ui.tsx), without the staff breadcrumbs.
export function PortalTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-[28px] leading-[38px] font-light text-[#666]">{title}</h1>
      {children && <div className="text-[12.6px] text-[#999]">{children}</div>}
    </div>
  );
}

// ---- Home: one card per application, with how far along it is

type DealCard = Awaited<ReturnType<typeof clientDeals>>[number];

export function ApplicationCards({ list }: { list: DealCard[] }) {
  if (!list.length) return <section className={cn(panel, "p-[15px] text-[12.6px] text-[#999]")}>You don&apos;t have access to any applications right now. If you expected one, contact your mortgage team.</section>;
  return (
    <ul className="grid gap-x-5 md:grid-cols-2">
      {list.map((d) => {
        const pct = d.steps ? Math.round((d.step / d.steps) * 100) : 0;
        return (
          <li key={d.id}>
            <Link href={`/portal/applications/${d.id}`} className={cn(panel, "group mx-0 block hover:shadow-[0_0_6px_rgba(0,0,0,0.2)]")}>
              <div className="flex items-start gap-2 border-b border-[#f4f4f4] px-[15px] py-2.5">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-light text-[#666]">{d.purpose ? `${d.purpose} mortgage` : "Mortgage application"}</h2>
                  <p className="text-[11px] text-[#999]">{d.firm} · Application {d.code}</p>
                </div>
                {d.unread > 0 && <span className="rounded-full bg-[#d9534f] px-2 py-0.5 text-[11px] text-white">{d.unread} new message{d.unread > 1 ? "s" : ""}</span>}
              </div>
              <div className="p-[15px] text-[12.6px]">
                <div className="flex justify-between"><span className="font-semibold">{d.stage ?? "Getting started"}</span>{d.step > 0 && <span className="text-[#999]">Step {d.step} of {d.steps}</span>}</div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-[3px] bg-[#f5f5f5] shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]" aria-hidden><div className="h-full bg-[#3d81be]" style={{ width: `${pct}%` }} /></div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {d.outstanding > 0
                    ? <span className="inline-flex items-center gap-1 rounded-[3px] bg-[#f0ad4e] px-1.5 py-0.5 text-[11px] font-semibold text-white"><Upload className="size-3" aria-hidden />{d.outstanding} document{d.outstanding > 1 ? "s" : ""} to upload</span>
                    : d.docs > 0 && <span className="inline-flex items-center gap-1 rounded-[3px] bg-[#5cb85c] px-1.5 py-0.5 text-[11px] font-semibold text-white"><CircleCheck className="size-3" aria-hidden />Nothing to upload</span>}
                  {d.docs > 0 && <span className="text-[#999]">{d.approved} of {d.docs} approved</span>}
                  <span className="ml-auto text-[#428bca] group-hover:underline">Open →</span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ---- Document status, in the client's words, in the staff badge colours

type Req = ClientDealView["requests"][number];
type Group = "todo" | "review" | "ok";
const status: Record<string, { text: string; icon: LucideIcon; group: Group }> = {
  requested: { text: "To upload", icon: Upload, group: "todo" },
  replacement_required: { text: "Needs a new file", icon: CircleAlert, group: "todo" },
  uploaded: { text: "Received", icon: Inbox, group: "review" },
  under_review: { text: "Being reviewed", icon: Clock, group: "review" },
  accepted: { text: "Approved", icon: CircleCheck, group: "ok" },
};
const fallback = { text: "In progress", icon: Clock, group: "review" as Group };
const st = (s: string) => status[s] ?? fallback;
const edge: Record<Group, string> = { todo: "border-l-[#f0ad4e]", review: "border-l-[#5bc0de]", ok: "border-l-[#5cb85c]" };

export function StatusChip({ s }: { s: string }) {
  const { text, icon: Icon } = st(s);
  return <span className={cn("inline-flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white", statusTone[s] ?? "bg-[#777]")}><Icon className="size-3" aria-hidden />{text}</span>;
}

// ---- One application

const clientUpload = (dealId: string) => ({ start: (i: { fileName: string; size: number; contentType: string }) => clientStartUploadAction(dealId, i), finish: clientFinishUploadAction });

export function ClientApplication({ id, d }: { id: string; d: ClientDealView }) {
  usePoll();
  const todo = d.requests.filter((r) => st(r.status).group === "todo").length;
  return (
    // A file dropped outside a drop zone would otherwise open in the browser and leave the page.
    <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}>
      <PortalTitle title={d.purpose ? `Your ${d.purpose.toLowerCase()} mortgage` : "Your mortgage"}>Application {d.code} · with {d.firm}</PortalTitle>
      <Journey d={d} todo={todo} />
      <div className="grid items-start gap-x-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Documents id={id} requests={d.requests} />
        <div>
          <Messages id={id} d={d} />
          <Updates updates={d.updates} />
        </div>
      </div>
    </div>
  );
}

// The stages as a path: done ones ticked, the current one holds the key, the last one is home.
function Journey({ d, todo }: { d: ClientDealView; todo: number }) {
  const at = d.stages.findIndex((s) => s.state === "current");
  return (
    <section className={panel} aria-labelledby="journey">
      <div className="grid gap-4 p-[15px] md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <div>
          <p className={sub} id="journey">Where things stand</p>
          <h2 className="mt-1 text-2xl font-light text-[#444]">{d.stage ? d.stage.label : "Getting started"}</h2>
          {d.stage ? <>
            <p className="text-[12.6px] text-[#999]">Step {at + 1} of {d.stages.length}</p>
            {d.stage.description && <p className="mt-2 max-w-prose text-[12.6px] text-[#555]">{d.stage.description}</p>}
          </> : <p className="mt-1 max-w-prose text-[12.6px] text-[#555]">Your team will mark each step here as your application moves along.</p>}
        </div>
        <div className={cn("rounded-[3px] border p-[15px]", todo ? "border-[#faebcc] bg-[#fcf8e3] text-[#8a6d3b]" : "border-[#d6e9c6] bg-[#dff0d8] text-[#3c763d]")}>
          <p className="text-[12px] font-semibold tracking-wide uppercase">Your next step</p>
          <p className="mt-1 text-[12.6px] font-semibold">{d.nextAction}</p>
        </div>
      </div>
      {d.stages.length > 0 && (
        <ol className="flex flex-col border-t border-[#f4f4f4] px-[15px] py-5 md:flex-row" aria-label="Stages">
          {d.stages.map((s, i) => {
            const last = i === d.stages.length - 1;
            const Icon = s.state === "done" ? Check : s.state === "current" ? KeyRound : last ? House : null;
            return (
              <li key={s.id} aria-current={s.state === "current" ? "step" : undefined} className="relative flex items-center gap-3 pb-5 last:pb-0 md:flex-1 md:flex-col md:pb-0 md:text-center">
                {!last && <span aria-hidden className={cn("absolute top-9 bottom-0 left-[15px] w-0.5 md:top-[15px] md:right-[calc(-50%+18px)] md:bottom-auto md:left-[calc(50%+18px)] md:h-0.5 md:w-auto", s.state === "done" ? "bg-[#5cb85c]" : "bg-[#ddd]")} />}
                <span className={cn("relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  s.state === "done" && "bg-[#5cb85c] text-white",
                  s.state === "current" && "bg-[#3d81be] text-white ring-4 ring-[#3d81be]/20",
                  s.state === "upcoming" && "border-2 border-[#ddd] bg-white text-[#999]")}>
                  {Icon ? <Icon className="size-4" aria-hidden /> : i + 1}
                </span>
                <span className={cn("text-[12.6px] md:mt-2 md:px-1 md:text-xs", s.state === "current" ? "font-semibold text-[#3d81be]" : s.state === "done" ? "text-[#555]" : "text-[#999]")}>
                  {s.label}<span className="sr-only"> ({s.state === "done" ? "completed" : s.state === "current" ? "current stage" : "upcoming"})</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Updates({ updates }: { updates: ClientDealView["updates"] }) {
  return (
    <GridPanel title="Updates from your team">
      {updates.length ? (
        <ol className="grid gap-3 border-l-2 border-[#eee] pl-4">
          {updates.map((u) => (
            <li key={u.id} className="relative">
              <span aria-hidden className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-[#3d81be] ring-4 ring-white" />
              <p className="font-semibold">{u.label}</p>
              <p className="text-[11px] text-[#999]">{when(u.at)}</p>
              {u.message && <p className="mt-1 whitespace-pre-wrap text-[#555]">{u.message}</p>}
            </li>
          ))}
        </ol>
      ) : <p className="text-[#999]">No updates yet. You&apos;ll see news here as your application moves forward.</p>}
    </GridPanel>
  );
}

// ---- Documents: summary, bulk drop zone, then each document with its status

const filters = [["all", "All"], ["todo", "To do"], ["review", "With your team"], ["ok", "Approved"]] as const;
const counts = [["todo", "To do"], ["review", "With your team"], ["ok", "Approved"]] as const;

function Documents({ id, requests }: { id: string; requests: Req[] }) {
  const [filter, setFilter] = useState<Group | "all">("all");
  const n = (g: Group) => requests.filter((r) => st(r.status).group === g).length;
  const open = requests.filter((r) => r.canUpload).sort((a, b) => Number(st(b.status).group === "todo") - Number(st(a.status).group === "todo"));
  const shown = requests.filter((r) => filter === "all" || st(r.status).group === filter);
  const groups = Object.groupBy(shown, (r) => r.category);
  const pct = requests.length ? Math.round((n("ok") / requests.length) * 100) : 0;
  return (
    <div id="documents" className="scroll-mt-[75px]">
      <GridPanel title="Your documents" tools={<span className="text-[12.6px] text-[#999]">{requests.length ? `${n("ok")} of ${requests.length} approved` : "Nothing requested yet."}</span>}>
        {requests.length > 0 && <>
          <div className="h-2 overflow-hidden rounded-[3px] bg-[#f5f5f5] shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]" role="progressbar" aria-label="Documents approved" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-[#5cb85c] transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {counts.map(([g, t]) => (
              <div key={g} className={cn("border-l-[3px] bg-[#f9f9f9] px-3 py-2", edge[g])}>
                <p className="text-2xl font-light text-[#444]">{n(g)}</p>
                <p className="text-[11px] text-[#999]">{t}</p>
              </div>
            ))}
          </div>
        </>}

        {open.length > 0 && <BulkUpload dealId={id} open={open} />}

        {requests.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1" role="group" aria-label="Show">
            {filters.map(([f, t]) => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn(filter === f ? blueBtn : greyBtn, btn, "h-[28px]")}>
                {t}{f !== "all" && <span className="opacity-70">{n(f)}</span>}
              </button>
            ))}
          </div>
        )}

        {shown.length === 0 && requests.length > 0 && <p className="mt-4 bg-[#f9f9f9] px-4 py-5 text-center text-[#999]">Nothing here right now.</p>}
        {Object.entries(groups).map(([cat, list]) => (
          <div key={cat} className="mt-5">
            <h4 className="border-b border-[#f4f4f4] pb-1 text-[14px] font-semibold text-[#666]">{cat}</h4>
            <ul className="mt-2 grid gap-2">{list!.map((r) => <DocCard key={r.id} dealId={id} r={r} />)}</ul>
          </div>
        ))}
      </GridPanel>
    </div>
  );
}

// Lets a drop zone accept files dragged from the desktop.
function useDrop(onFiles: (f: File[]) => void) {
  const [over, setOver] = useState(false);
  const stop = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  return {
    over,
    props: {
      onDragOver: (e: DragEvent) => { stop(e); setOver(true); },
      onDragLeave: (e: DragEvent) => { stop(e); if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); },
      onDrop: (e: DragEvent) => { stop(e); setOver(false); if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files)); },
    },
  };
}

// Best guess at which requested document a file is, from words its name shares with the request's name.
// ponytail: word overlap only; the client checks every guess before sending.
const words = (s: string) => new Set(s.toLowerCase().replace(/\.[a-z0-9]+$/, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2).map((w) => w.replace(/s$/, "")));
function guess(fileName: string, open: Req[]) {
  const f = words(fileName);
  let best = "", top = 0;
  for (const r of open) {
    const hits = [...words(r.name)].filter((w) => f.has(w)).length;
    if (hits > top) { best = r.id; top = hits; }
  }
  return best;
}

type Item = { key: number; name: string; state: "uploading" | "ready" | "sending" | "sent" | "error"; fileId?: string; requestId: string; error?: string };

// Drop many files at once: each uploads straight away, the client says which document each one is, then sends them together.
function BulkUpload({ dealId, open }: { dealId: string; open: Req[] }) {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);
  const picker = useRef<HTMLInputElement>(null);
  const up = clientUpload(dealId);
  const set = (key: number, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const add = async (files: File[]) => {
    const fresh = files.map((f) => ({ key: ++seq.current, name: f.name, state: "uploading" as const, requestId: guess(f.name, open) }));
    setItems((xs) => [...xs, ...fresh]);
    for (const [i, f] of files.entries()) {
      const r = await uploadFile(f, up.start, up.finish);
      set(fresh[i].key, r.data ? { state: "ready", fileId: r.data.id } : { state: "error", error: r.error ?? "Upload failed" });
    }
    if (picker.current) picker.current.value = "";
  };
  const drop = useDrop((f) => void add(f));
  const ready = items.filter((x) => x.state === "ready" && x.requestId);
  const busy = items.some((x) => x.state === "uploading" || x.state === "sending");
  const send = async () => {
    for (const x of ready) {
      set(x.key, { state: "sending" });
      const r = await clientAddVersionAction(x.requestId, x.fileId!);
      set(x.key, r.error ? { state: "error", error: r.error } : { state: "sent" });
    }
  };
  return (
    <div className="mt-5">
      <label {...drop.props}
        className={cn("flex cursor-pointer flex-col items-center rounded-[3px] border-2 border-dashed px-6 py-6 text-center transition",
          drop.over ? "border-[#3d81be] bg-[#eaf2fa]" : "border-[#ccc] bg-[#f9f9f9] hover:border-[#3d81be]")}>
        <CloudUpload className="size-9 text-[#3d81be]" aria-hidden />
        <span className="mt-2 text-lg font-light text-[#666]">Drop all your documents here</span>
        <span className="mt-1 text-[12.6px] text-[#555]">or <span className="text-[#428bca] underline">choose files</span>. You can add several at once.</span>
        <span className="mt-1 text-[11px] text-[#999]">PDF, JPG or PNG, up to 10 MB each. On a phone you can take a photo.</span>
        <input ref={picker} type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => e.target.files?.length && void add(Array.from(e.target.files))} />
      </label>

      {items.length > 0 && (
        <div className="mt-3 border border-[#ddd]">
          <p className="border-b border-[#ddd] bg-[#f9f9f9] px-3 py-2 text-[#555]">Tell us what each file is. We&apos;ve matched what we could from the file names.</p>
          <ul className="divide-y divide-[#eee]">
            {items.map((x) => (
              <li key={x.key} className="grid gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,240px)_auto] sm:items-center">
                <div className="flex min-w-0 items-center gap-2.5">
                  {x.state === "uploading" || x.state === "sending" ? <LoaderCircle className="size-5 shrink-0 animate-spin text-[#999]" aria-hidden />
                    : x.state === "sent" ? <CircleCheck className="size-5 shrink-0 text-[#5cb85c]" aria-hidden />
                    : x.state === "error" ? <CircleAlert className="size-5 shrink-0 text-[#d9534f]" aria-hidden />
                    : <FileText className="size-5 shrink-0 text-[#999]" aria-hidden />}
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{x.name}</p>
                    <p className={cn("text-[11px]", x.state === "error" ? "text-[#a94442]" : "text-[#999]")} role={x.state === "error" ? "alert" : undefined}>
                      {{ uploading: "Uploading...", ready: x.requestId ? "Ready to send" : "Choose which document this is", sending: "Sending...", sent: "Sent to your team", error: x.error }[x.state]}
                    </p>
                  </div>
                </div>
                {x.state === "ready" || x.state === "uploading" ? (
                  <label><span className="sr-only">Which document is {x.name}?</span>
                    <select value={x.requestId} onChange={(e) => set(x.key, { requestId: e.target.value })} className={input}>
                      <option value="">Which document is this?</option>
                      {open.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </label>
                ) : <span className="text-[#555] sm:truncate">{open.find((r) => r.id === x.requestId)?.name}</span>}
                {x.state !== "sending" && x.state !== "uploading" && (
                  <button onClick={() => setItems((xs) => xs.filter((y) => y.key !== x.key))} className="justify-self-end rounded-[3px] p-1.5 text-[#999] hover:bg-[#e6e6e6] hover:text-[#333]" aria-label={`Remove ${x.name} from this list`}><X className="size-4" /></button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 border-t border-[#ddd] bg-[#f9f9f9] px-3 py-2">
            <button onClick={() => void send()} disabled={busy || !ready.length} className={cn(greenBtn, btn)}>
              Send {ready.length || ""} to my team
            </button>
            {items.some((x) => x.state === "sent") && !busy && <button onClick={() => setItems((xs) => xs.filter((x) => x.state !== "sent"))} className="text-[#428bca] hover:underline">Clear sent files</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// One requested document. Open ones also take a file dropped straight onto them.
function DocCard({ dealId, r }: { dealId: string; r: Req }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const up = clientUpload(dealId);
  const add = async (files: File[]) => {
    setBusy(true);
    setError("");
    const errors: string[] = [];
    for (const f of files) {
      const u = await uploadFile(f, up.start, up.finish);
      const a = u.data ? await clientAddVersionAction(r.id, u.data.id) : u;
      if (a.error) errors.push(a.error);
    }
    setError(errors.join(" "));
    setBusy(false);
  };
  const drop = useDrop((f) => r.canUpload && void add(f));
  const s = st(r.status);
  return (
    <li {...(r.canUpload ? drop.props : {})}
      className={cn("border border-l-[3px] border-[#ddd] p-3 transition", drop.over ? "border-[#3d81be] bg-[#eaf2fa]" : cn(edge[s.group], s.group === "todo" ? "bg-[#fffdf7]" : "bg-white"))}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{r.name}</p>
          <p className="text-[11px] text-[#999]">{[r.dueDate && `Due ${r.dueDate}`, r.shared && "Shared with your co-applicant"].filter(Boolean).join(" · ")}</p>
        </div>
        <StatusChip s={r.status} />
      </div>
      {r.description && <p className="mt-1 text-[#555]">{r.description}</p>}
      {r.status === "replacement_required" && <p className="mt-2 rounded-[3px] border border-[#ebccd1] bg-[#f2dede] px-3 py-2 text-[#a94442]">Please upload a new file{r.replacementReason ? `: ${r.replacementReason}` : "."}</p>}
      {r.versions.length > 0 && (
        <ul className="mt-2 grid gap-1">
          {r.versions.map((v) => <li key={v.version} className="flex items-center gap-2"><FileText className="size-4 shrink-0 text-[#999]" aria-hidden /><FileLink f={v} /><span className="text-[11px] text-[#999]">· {when(v.at)}</span></li>)}
        </ul>
      )}
      {r.canUpload && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className={cn(blueBtn, btn, "cursor-pointer", busy && "pointer-events-none opacity-60")}>
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {busy ? "Uploading..." : r.versions.length ? "Add another file" : "Upload"}
            <input type="file" accept={ACCEPT} multiple className="sr-only" disabled={busy} onChange={(e) => { if (e.target.files?.length) void add(Array.from(e.target.files)); e.target.value = ""; }} />
          </label>
          <span className="hidden text-[11px] text-[#999] sm:inline">or drop a file on this card</span>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-[#a94442]">{error}</p>}
    </li>
  );
}

// ---- Messages

function Messages({ id, d }: { id: string; d: ClientDealView }) {
  const [convId, setConvId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const conv = d.conversations.find((c) => c.id === convId);
  const upload = clientUpload(id);
  return (
    <GridPanel title="Messages" tools={!conv && !composing && <button onClick={() => setComposing(true)} className={cn(greenBtn, btn)}>New message</button>}>
      {conv ? <Thread c={conv} back={() => setConvId(null)} reply={clientReplyAction} markRead={clientMarkReadAction} upload={upload} />
        : composing ? <Compose dealId={id} upload={upload} close={(newId) => { setComposing(false); if (newId) setConvId(newId); }} />
        : d.conversations.length ? <ConversationList list={d.conversations} open={setConvId} />
        : <p className="text-[#999]">Questions? Send your team a message and they&apos;ll reply here.</p>}
    </GridPanel>
  );
}

function Compose({ dealId, upload, close }: { dealId: string; upload: ReturnType<typeof clientUpload>; close: (id?: string) => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<{ id: string; fileName: string }[]>([]);
  const run = useRun();
  return (
    <div className="grid gap-3">
      <label><span className={label}>Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} className={input} /></label>
      <label><span className={label}>Message</span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={5000} className={cn(input, "h-auto py-1.5")} /></label>
      {files.length > 0 && <p className="text-[#555]">Attached: {files.map((f) => f.fileName).join(", ")}</p>}
      <Err text={run.error} />
      <div className="flex flex-wrap items-start gap-2">
        <button disabled={run.pending || !subject.trim() || (!body.trim() && !files.length)}
          onClick={() => run.go(async () => {
            const r = await clientStartConversationAction(dealId, { subject, body, fileIds: files.map((f) => f.id) });
            if (r.data) close(r.data);
            return r;
          })}
          className={cn(greenBtn, btn)}>Send</button>
        {files.length < 5 && <UploadButton {...upload} text="Attach file" multiple done={(f) => setFiles((x) => [...x, f])} />}
        <button onClick={() => close()} className={cn(greyBtn, btn)}>Cancel</button>
      </div>
    </div>
  );
}

// ---- Profile

type Profile = { clientId: string; firm: string; name: string; email: string; cellPhone: string; homePhone: string; workPhone: string; address: string; emailNotifications: boolean };

export function ClientProfile({ p }: { p: Profile }) {
  const run = useRun();
  const [saved, setSaved] = useState(false);
  const field = (name: keyof Profile, text: string, type = "tel") => (
    <label><span className={label}>{text}</span><input name={name} type={type} defaultValue={String(p[name])} maxLength={name === "address" ? 300 : 30} className={input} onChange={() => setSaved(false)} /></label>
  );
  return (
    <GridPanel title={p.firm}>
      <p className="text-[14px] font-semibold">{p.name}</p>
      <p className="text-[#555]">{p.email} <span className="text-[#999]">· to change your email, contact your team</span></p>
      <form className="mt-4 grid max-w-[560px] gap-3 sm:grid-cols-2" onSubmit={(e) => {
        e.preventDefault();
        const form = Object.fromEntries(new FormData(e.currentTarget));
        run.go(() => saveProfileAction(p.clientId, { ...form, emailNotifications: form.emailNotifications === "on" }), () => setSaved(true));
      }}>
        {field("cellPhone", "Cell phone")}
        {field("homePhone", "Home phone")}
        {field("workPhone", "Work phone")}
        <div className="sm:col-span-2">{field("address", "Mailing address", "text")}</div>
        <label className="flex items-start gap-2 sm:col-span-2">
          <input type="checkbox" name="emailNotifications" defaultChecked={p.emailNotifications} onChange={() => setSaved(false)} className="mt-0.5 size-4 accent-[#3d81be]" />
          <span className="font-semibold text-[#666]">Email me when there&apos;s something new<span className="block text-[11px] font-normal text-[#999]">Emails never include your documents or message text.</span></span>
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button disabled={run.pending} className={cn(greenBtn, btn)}>{run.pending ? "Saving..." : "Save changes"}</button>
          {saved && <p role="status" className="inline-flex items-center gap-1 text-[#3c763d]"><Check className="size-4" aria-hidden />Saved</p>}
        </div>
        <div className="sm:col-span-2"><Err text={run.error} /></div>
      </form>
    </GridPanel>
  );
}
