"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft, Bell, Check, CircleAlert, CircleCheck, Clock, CloudUpload, FileText, House, Inbox, KeyRound, LoaderCircle, LogOut, Upload, X, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clientAddVersionAction, clientFinishUploadAction, clientLogout, clientMarkReadAction, clientReplyAction, clientStartConversationAction, clientStartUploadAction,
  readClientNotificationsAction, saveProfileAction,
} from "@/app/portal/actions";
import type { ClientDealView } from "@/server/portal-client";
import { Err, useRun } from "./admin";
import { ConversationList, FileLink, Thread, UploadButton, usePoll } from "./deal-portal";
import { btn, card, serif } from "./portal-style";
import { ACCEPT, uploadFile, when } from "./upload";

// ---- Look (see portal-style.ts)

const ghost = "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-[#d8d2c4] bg-white px-4 text-sm font-medium text-[#1c2a27] transition hover:bg-[#f6f3ec]";
const field = "mt-1 h-11 w-full rounded-xl border border-[#d8d2c4] bg-white px-3 text-[15px] text-[#1c2a27] outline-none focus:border-[#1f5c4a] focus:ring-4 focus:ring-[#1f5c4a]/10";
const eyebrow = "text-[11px] font-semibold tracking-[0.14em] text-[#5d6b66] uppercase";

type Note = { id: string; title: string; href: string | null; at: Date; read: boolean };

// ---- Shell

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
    <div className="min-h-screen bg-[#f6f3ec] text-[15px] text-[#1c2a27]">
      <header className="sticky top-0 z-30 border-b border-[#e4dfd3] bg-[#f6f3ec]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-2 px-4">
          <Link href="/portal" className="flex items-center gap-2" aria-label="Keyway home">
            <span className="grid size-9 place-items-center rounded-full bg-[#1f5c4a] text-white"><KeyRound className="size-[18px]" aria-hidden /></span>
            <span className={cn(serif, "hidden text-xl font-semibold sm:inline")}>Keyway</span>
          </Link>
          <nav className="ml-auto flex items-center gap-0.5 sm:gap-1" aria-label="Portal">
            {nav.map(([t, h]) => (
              <Link key={h} href={h} aria-current={path === h ? "page" : undefined}
                className={cn("rounded-full px-2.5 py-2 text-sm font-medium whitespace-nowrap text-[#5d6b66] hover:bg-white hover:text-[#1c2a27] sm:px-3", path === h && "bg-white text-[#1c2a27] shadow-[0_0_0_1px_#e4dfd3]")}>
                {t === "My applications" ? <><span className="sm:hidden">Home</span><span className="hidden sm:inline">{t}</span></> : t}
                {h === "/portal" && unread.messages > 0 && <span className="ml-1.5 rounded-full bg-[#b4443a] px-1.5 text-[11px] text-white" aria-label={`${unread.messages} unread messages`}>{unread.messages}</span>}
              </Link>
            ))}
            <div className="relative">
              <button onClick={toggle} aria-expanded={open} aria-label={`Notifications${count ? `, ${count} unread` : ""}`} className="relative grid size-10 place-items-center rounded-full hover:bg-white">
                <Bell className="size-5 text-[#5d6b66]" />
                {count > 0 && <span className="absolute top-1 right-1 grid size-[18px] place-items-center rounded-full bg-[#b4443a] text-[10px] font-semibold text-white">{count}</span>}
              </button>
              {open && (
                <div className={cn(card, "absolute right-0 z-40 mt-2 w-[min(320px,calc(100vw-2rem))] overflow-hidden shadow-xl")}>
                  <p className="border-b border-[#efebe2] px-4 py-3 text-sm font-semibold">Notifications</p>
                  <ul className="max-h-[340px] overflow-y-auto text-sm">
                    {notes.length ? notes.map((n) => {
                      const inner = <>{n.title}<span className="mt-0.5 block text-xs text-[#8a948f]">{when(n.at)}</span></>;
                      return (
                        <li key={n.id} className="border-b border-[#f3f0e9] last:border-0">
                          {n.href ? <Link href={n.href} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-[#f6f3ec]">{inner}</Link> : <p className="px-4 py-3">{inner}</p>}
                        </li>
                      );
                    }) : <li className="px-4 py-6 text-center text-[#8a948f]">You&apos;re all caught up.</li>}
                  </ul>
                </div>
              )}
            </div>
            <form action={clientLogout}><button className="grid h-10 place-items-center rounded-full px-2.5 text-sm font-medium whitespace-nowrap text-[#5d6b66] hover:bg-white hover:text-[#1c2a27] sm:px-3" title={name} aria-label={`Sign out ${name}`}><LogOut className="size-5 sm:hidden" aria-hidden /><span className="hidden sm:inline">Sign out</span></button></form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-4 pt-8 pb-16">{children}</main>
    </div>
  );
}

// ---- Document status, in the client's words

type Req = ClientDealView["requests"][number];
type Group = "todo" | "review" | "ok";
const status: Record<string, { text: string; tone: string; icon: LucideIcon; group: Group }> = {
  requested: { text: "To upload", tone: "bg-[#fbf0dc] text-[#87570f]", icon: Upload, group: "todo" },
  replacement_required: { text: "Needs a new file", tone: "bg-[#f8e4e1] text-[#9b3329]", icon: CircleAlert, group: "todo" },
  uploaded: { text: "Received", tone: "bg-[#e3edf5] text-[#2b5c82]", icon: Inbox, group: "review" },
  under_review: { text: "Being reviewed", tone: "bg-[#e3edf5] text-[#2b5c82]", icon: Clock, group: "review" },
  accepted: { text: "Approved", tone: "bg-[#e1f0e6] text-[#24653f]", icon: CircleCheck, group: "ok" },
};
const fallback = { text: "In progress", tone: "bg-[#efebe2] text-[#5d6b66]", icon: Clock, group: "review" as Group };
const st = (s: string) => status[s] ?? fallback;

export function StatusChip({ s }: { s: string }) {
  const { text, tone, icon: Icon } = st(s);
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", tone)}><Icon className="size-3.5" aria-hidden />{text}</span>;
}

// ---- One application

const clientUpload = (dealId: string) => ({ start: (i: { fileName: string; size: number; contentType: string }) => clientStartUploadAction(dealId, i), finish: clientFinishUploadAction });

export function ClientApplication({ id, d }: { id: string; d: ClientDealView }) {
  usePoll();
  const todo = d.requests.filter((r) => st(r.status).group === "todo").length;
  return (
    // A file dropped outside a drop zone would otherwise open in the browser and leave the page.
    <div className="grid gap-6" onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}>
      <div>
        <Link href="/portal" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5d6b66] hover:text-[#1c2a27]"><ArrowLeft className="size-4" aria-hidden />My applications</Link>
        <h1 className={cn(serif, "mt-3 text-3xl font-medium sm:text-4xl")}>{d.purpose ? `Your ${d.purpose.toLowerCase()} mortgage` : "Your mortgage"}</h1>
        <p className="mt-1 text-[#5d6b66]">Application {d.code} · with {d.firm}</p>
      </div>
      <Journey d={d} todo={todo} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Documents id={id} requests={d.requests} />
        <div className="grid gap-6">
          <Updates updates={d.updates} />
          <Messages id={id} d={d} />
        </div>
      </div>
    </div>
  );
}

// The stages as a path: done ones ticked, the current one holds the key, the last one is home.
function Journey({ d, todo }: { d: ClientDealView; todo: number }) {
  const at = d.stages.findIndex((s) => s.state === "current");
  return (
    <section className={cn(card, "overflow-hidden")} aria-labelledby="journey">
      <div className="grid gap-5 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] md:p-8">
        <div>
          <p className={eyebrow} id="journey">Where things stand</p>
          {d.stage ? <>
            <h2 className={cn(serif, "mt-2 text-2xl font-medium")}>{d.stage.label}</h2>
            <p className="mt-1 text-sm text-[#5d6b66]">Step {at + 1} of {d.stages.length}</p>
            {d.stage.description && <p className="mt-3 max-w-prose text-[#3d4a46]">{d.stage.description}</p>}
          </> : <>
            <h2 className={cn(serif, "mt-2 text-2xl font-medium")}>Getting started</h2>
            <p className="mt-2 max-w-prose text-[#3d4a46]">Your team will mark each step here as your application moves along.</p>
          </>}
        </div>
        <div className={cn("rounded-xl p-5", todo ? "bg-[#fbf0dc]" : "bg-[#e6eee8]")}>
          <p className={cn(eyebrow, todo ? "text-[#87570f]" : "text-[#24653f]")}>Your next step</p>
          <p className="mt-2 font-medium">{d.nextAction}</p>
          {todo > 0 && <a href="#documents" className={cn(btn, "mt-4 h-9 px-4")}><Upload className="size-4" aria-hidden />Upload documents</a>}
        </div>
      </div>
      {d.stages.length > 0 && (
        <ol className="flex flex-col border-t border-[#efebe2] bg-[#fbfaf6] px-6 py-6 md:flex-row md:px-8" aria-label="Stages">
          {d.stages.map((s, i) => {
            const last = i === d.stages.length - 1;
            const Icon = s.state === "done" ? Check : s.state === "current" ? KeyRound : last ? House : null;
            return (
              <li key={s.id} aria-current={s.state === "current" ? "step" : undefined} className="relative flex items-center gap-3 pb-5 last:pb-0 md:flex-1 md:flex-col md:pb-0 md:text-center">
                {!last && <span aria-hidden className={cn("absolute top-9 bottom-0 left-[15px] w-0.5 md:top-[15px] md:right-[calc(-50%+18px)] md:bottom-auto md:left-[calc(50%+18px)] md:h-0.5 md:w-auto", s.state === "done" ? "bg-[#1f5c4a]" : "bg-[#e4dfd3]")} />}
                <span className={cn("relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  s.state === "done" && "bg-[#1f5c4a] text-white",
                  s.state === "current" && "bg-[#e0a43a] text-[#1c2a27] ring-4 ring-[#e0a43a]/25",
                  s.state === "upcoming" && "border-2 border-[#d8d2c4] bg-white text-[#8a948f]")}>
                  {Icon ? <Icon className="size-4" aria-hidden /> : i + 1}
                </span>
                <span className={cn("text-sm md:mt-2 md:px-1 md:text-xs", s.state === "current" ? "font-semibold" : s.state === "done" ? "text-[#3d4a46]" : "text-[#8a948f]")}>
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
    <section className={cn(card, "p-6")} aria-labelledby="updates">
      <h2 id="updates" className={cn(serif, "text-xl font-medium")}>Updates from your team</h2>
      {updates.length ? (
        <ol className="mt-4 grid gap-4 border-l-2 border-[#e4dfd3] pl-4">
          {updates.map((u) => (
            <li key={u.id} className="relative">
              <span aria-hidden className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-[#1f5c4a] ring-4 ring-white" />
              <p className="text-sm font-semibold">{u.label}</p>
              <p className="text-xs text-[#8a948f]">{when(u.at)}</p>
              {u.message && <p className="mt-1 text-sm whitespace-pre-wrap text-[#3d4a46]">{u.message}</p>}
            </li>
          ))}
        </ol>
      ) : <p className="mt-2 text-sm text-[#8a948f]">No updates yet. You&apos;ll see news here as your application moves forward.</p>}
    </section>
  );
}

// ---- Documents: summary, bulk drop zone, then each document with its status

const filters = [["all", "All"], ["todo", "To do"], ["review", "With your team"], ["ok", "Approved"]] as const;

function Documents({ id, requests }: { id: string; requests: Req[] }) {
  const [filter, setFilter] = useState<Group | "all">("all");
  const n = (g: Group) => requests.filter((r) => st(r.status).group === g).length;
  const open = requests.filter((r) => r.canUpload).sort((a, b) => Number(st(b.status).group === "todo") - Number(st(a.status).group === "todo"));
  const shown = requests.filter((r) => filter === "all" || st(r.status).group === filter);
  const groups = Object.groupBy(shown, (r) => r.category);
  const pct = requests.length ? Math.round((n("ok") / requests.length) * 100) : 0;
  return (
    <section id="documents" className={cn(card, "scroll-mt-24 p-6")} aria-labelledby="docs">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 id="docs" className={cn(serif, "text-2xl font-medium")}>Your documents</h2>
          <p className="mt-1 text-sm text-[#5d6b66]">{requests.length ? `${n("ok")} of ${requests.length} approved` : "Nothing requested yet."}</p>
        </div>
        {requests.length > 0 && <div className="ml-auto h-2 w-full overflow-hidden rounded-full bg-[#efebe2] sm:w-48" role="progressbar" aria-label="Documents approved" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-[#1f5c4a] transition-[width]" style={{ width: `${pct}%` }} /></div>}
      </div>

      {requests.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-2">
          {([["todo", "To do", "text-[#87570f]"], ["review", "With your team", "text-[#2b5c82]"], ["ok", "Approved", "text-[#24653f]"]] as const).map(([g, t, c]) => (
            <div key={g} className="rounded-xl bg-[#f6f3ec] px-3 py-3">
              <p className={cn(serif, "text-2xl font-medium", c)}>{n(g)}</p>
              <p className="text-xs text-[#5d6b66]">{t}</p>
            </div>
          ))}
        </div>
      )}

      {open.length > 0 && <BulkUpload dealId={id} open={open} />}

      {requests.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {filters.map(([f, t]) => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={cn("rounded-full px-3 py-1.5 text-sm font-medium", filter === f ? "bg-[#1c2a27] text-white" : "bg-[#f6f3ec] text-[#5d6b66] hover:text-[#1c2a27]")}>
              {t}{f !== "all" && <span className="ml-1 opacity-70">{n(f)}</span>}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 && requests.length > 0 && <p className="mt-6 rounded-xl bg-[#f6f3ec] px-4 py-6 text-center text-sm text-[#5d6b66]">Nothing here right now.</p>}
      {Object.entries(groups).map(([cat, list]) => (
        <div key={cat} className="mt-6">
          <h3 className={eyebrow}>{cat}</h3>
          <ul className="mt-2 grid gap-2">{list!.map((r) => <DocCard key={r.id} dealId={id} r={r} />)}</ul>
        </div>
      ))}
    </section>
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
  const input = useRef<HTMLInputElement>(null);
  const up = clientUpload(dealId);
  const set = (key: number, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const add = async (files: File[]) => {
    const fresh = files.map((f) => ({ key: ++seq.current, name: f.name, state: "uploading" as const, requestId: guess(f.name, open) }));
    setItems((xs) => [...xs, ...fresh]);
    for (const [i, f] of files.entries()) {
      const r = await uploadFile(f, up.start, up.finish);
      set(fresh[i].key, r.data ? { state: "ready", fileId: r.data.id } : { state: "error", error: r.error ?? "Upload failed" });
    }
    if (input.current) input.current.value = "";
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
    <div className="mt-6">
      <label {...drop.props}
        className={cn("flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
          drop.over ? "border-[#1f5c4a] bg-[#e6eee8]" : "border-[#d8d2c4] bg-[#fbfaf6] hover:border-[#1f5c4a]/60")}>
        <span className="grid size-12 place-items-center rounded-full bg-white text-[#1f5c4a] shadow-[0_0_0_1px_#e4dfd3]"><CloudUpload className="size-6" aria-hidden /></span>
        <span className={cn(serif, "mt-3 text-lg font-medium")}>Drop all your documents here</span>
        <span className="mt-1 text-sm text-[#5d6b66]">or <span className="font-semibold text-[#1f5c4a] underline underline-offset-2">choose files</span>. You can add several at once.</span>
        <span className="mt-2 text-xs text-[#8a948f]">PDF, JPG or PNG, up to 10 MB each. On a phone you can take a photo.</span>
        <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => e.target.files?.length && void add(Array.from(e.target.files))} />
      </label>

      {items.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-[#e4dfd3]">
          <p className="border-b border-[#efebe2] bg-[#fbfaf6] px-4 py-2.5 text-sm text-[#5d6b66]">Tell us what each file is. We&apos;ve matched what we could from the file names.</p>
          <ul className="divide-y divide-[#efebe2]">
            {items.map((x) => (
              <li key={x.key} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,240px)_auto] sm:items-center">
                <div className="flex min-w-0 items-center gap-2.5">
                  {x.state === "uploading" || x.state === "sending" ? <LoaderCircle className="size-5 shrink-0 animate-spin text-[#5d6b66]" aria-hidden />
                    : x.state === "sent" ? <CircleCheck className="size-5 shrink-0 text-[#24653f]" aria-hidden />
                    : x.state === "error" ? <CircleAlert className="size-5 shrink-0 text-[#9b3329]" aria-hidden />
                    : <FileText className="size-5 shrink-0 text-[#5d6b66]" aria-hidden />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{x.name}</p>
                    <p className={cn("text-xs", x.state === "error" ? "text-[#9b3329]" : "text-[#8a948f]")} role={x.state === "error" ? "alert" : undefined}>
                      {{ uploading: "Uploading...", ready: x.requestId ? "Ready to send" : "Choose which document this is", sending: "Sending...", sent: "Sent to your team", error: x.error }[x.state]}
                    </p>
                  </div>
                </div>
                {x.state === "ready" || x.state === "uploading" ? (
                  <label><span className="sr-only">Which document is {x.name}?</span>
                    <select value={x.requestId} onChange={(e) => set(x.key, { requestId: e.target.value })} className="h-10 w-full rounded-xl border border-[#d8d2c4] bg-white px-2 text-sm">
                      <option value="">Which document is this?</option>
                      {open.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </label>
                ) : <span className="text-sm text-[#5d6b66] sm:truncate">{open.find((r) => r.id === x.requestId)?.name}</span>}
                {x.state !== "sending" && x.state !== "uploading" && (
                  <button onClick={() => setItems((xs) => xs.filter((y) => y.key !== x.key))} className="justify-self-end rounded-full p-1.5 text-[#8a948f] hover:bg-[#f6f3ec] hover:text-[#1c2a27]" aria-label={`Remove ${x.name} from this list`}><X className="size-4" /></button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 border-t border-[#efebe2] bg-[#fbfaf6] px-4 py-3">
            <button onClick={() => void send()} disabled={busy || !ready.length} className={btn}>
              Send {ready.length || ""} to my team
            </button>
            {items.some((x) => x.state === "sent") && !busy && <button onClick={() => setItems((xs) => xs.filter((x) => x.state !== "sent"))} className="text-sm font-medium text-[#5d6b66] hover:text-[#1c2a27]">Clear sent files</button>}
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
      className={cn("rounded-xl border p-4 transition", drop.over ? "border-[#1f5c4a] bg-[#e6eee8]" : s.group === "todo" ? "border-[#ecdcbc] bg-[#fffcf5]" : "border-[#efebe2] bg-white")}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{r.name}</p>
          <p className="mt-0.5 text-xs text-[#8a948f]">{[r.dueDate && `Due ${r.dueDate}`, r.shared && "Shared with your co-applicant"].filter(Boolean).join(" · ")}</p>
        </div>
        <StatusChip s={r.status} />
      </div>
      {r.description && <p className="mt-2 text-sm text-[#3d4a46]">{r.description}</p>}
      {r.status === "replacement_required" && <p className="mt-2 rounded-lg bg-[#f8e4e1] px-3 py-2 text-sm text-[#9b3329]">Please upload a new file{r.replacementReason ? `: ${r.replacementReason}` : "."}</p>}
      {r.versions.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm">
          {r.versions.map((v) => <li key={v.version} className="flex items-center gap-2"><FileText className="size-4 shrink-0 text-[#8a948f]" aria-hidden /><FileLink f={v} /><span className="text-xs text-[#8a948f]">· {when(v.at)}</span></li>)}
        </ul>
      )}
      {r.canUpload && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className={cn(ghost, "cursor-pointer", busy && "pointer-events-none opacity-60")}>
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {busy ? "Uploading..." : r.versions.length ? "Add another file" : "Upload"}
            <input type="file" accept={ACCEPT} multiple className="sr-only" disabled={busy} onChange={(e) => { if (e.target.files?.length) void add(Array.from(e.target.files)); e.target.value = ""; }} />
          </label>
          <span className="hidden text-xs text-[#8a948f] sm:inline">or drop a file on this card</span>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-[#9b3329]">{error}</p>}
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
    <section className={cn(card, "p-6 text-sm")} aria-labelledby="messages">
      <div className="mb-3 flex items-center gap-2">
        <h2 id="messages" className={cn(serif, "text-xl font-medium")}>Messages</h2>
        {!conv && !composing && <button onClick={() => setComposing(true)} className={cn(ghost, "ml-auto h-8 px-3")}>New message</button>}
      </div>
      {conv ? <Thread c={conv} back={() => setConvId(null)} reply={clientReplyAction} markRead={clientMarkReadAction} upload={upload} />
        : composing ? <Compose dealId={id} upload={upload} close={(newId) => { setComposing(false); if (newId) setConvId(newId); }} />
        : d.conversations.length ? <ConversationList list={d.conversations} open={setConvId} />
        : <p className="text-[#8a948f]">Questions? Send your team a message and they&apos;ll reply here.</p>}
    </section>
  );
}

function Compose({ dealId, upload, close }: { dealId: string; upload: ReturnType<typeof clientUpload>; close: (id?: string) => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<{ id: string; fileName: string }[]>([]);
  const run = useRun();
  return (
    <div className="grid gap-3">
      <label className="text-sm font-medium">Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} className={field} /></label>
      <label className="text-sm font-medium">Message<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={5000} className={cn(field, "h-auto py-2")} /></label>
      {files.length > 0 && <p className="text-[#5d6b66]">Attached: {files.map((f) => f.fileName).join(", ")}</p>}
      <Err text={run.error} />
      <div className="flex flex-wrap items-start gap-2">
        <button disabled={run.pending || !subject.trim() || (!body.trim() && !files.length)}
          onClick={() => run.go(async () => {
            const r = await clientStartConversationAction(dealId, { subject, body, fileIds: files.map((f) => f.id) });
            if (r.data) close(r.data);
            return r;
          })}
          className={cn(btn, "h-9 px-4")}>Send</button>
        {files.length < 5 && <UploadButton {...upload} text="Attach file" multiple done={(f) => setFiles((x) => [...x, f])} />}
        <button onClick={() => close()} className="px-2 py-2 font-medium text-[#5d6b66] hover:text-[#1c2a27]">Cancel</button>
      </div>
    </div>
  );
}

// ---- Profile

type Profile = { clientId: string; firm: string; name: string; email: string; cellPhone: string; homePhone: string; workPhone: string; address: string; emailNotifications: boolean };

export function ClientProfile({ p }: { p: Profile }) {
  const run = useRun();
  const [saved, setSaved] = useState(false);
  const input = (name: keyof Profile, text: string, type = "tel") => (
    <label className="text-sm font-medium">{text}<input name={name} type={type} defaultValue={String(p[name])} maxLength={name === "address" ? 300 : 30} className={field} onChange={() => setSaved(false)} /></label>
  );
  return (
    <section className={cn(card, "p-6 md:p-8")} aria-label={p.firm}>
      <p className={eyebrow}>{p.firm}</p>
      <h2 className={cn(serif, "mt-1 text-2xl font-medium")}>{p.name}</h2>
      <p className="mt-1 text-sm text-[#5d6b66]">{p.email} <span className="text-[#8a948f]">· to change your email, contact your team</span></p>
      <form className="mt-6 grid max-w-[560px] gap-4 sm:grid-cols-2" onSubmit={(e) => {
        e.preventDefault();
        const form = Object.fromEntries(new FormData(e.currentTarget));
        run.go(() => saveProfileAction(p.clientId, { ...form, emailNotifications: form.emailNotifications === "on" }), () => setSaved(true));
      }}>
        {input("cellPhone", "Cell phone")}
        {input("homePhone", "Home phone")}
        {input("workPhone", "Work phone")}
        <div className="sm:col-span-2">{input("address", "Mailing address", "text")}</div>
        <label className="flex items-start gap-3 rounded-xl bg-[#f6f3ec] p-4 text-sm sm:col-span-2">
          <input type="checkbox" name="emailNotifications" defaultChecked={p.emailNotifications} onChange={() => setSaved(false)} className="mt-0.5 size-4 accent-[#1f5c4a]" />
          <span>Email me when there&apos;s something new<span className="block text-xs text-[#8a948f]">Emails never include your documents or message text.</span></span>
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button disabled={run.pending} className={btn}>{run.pending ? "Saving..." : "Save changes"}</button>
          {saved && <p role="status" className="inline-flex items-center gap-1 text-sm text-[#24653f]"><Check className="size-4" aria-hidden />Saved</p>}
        </div>
        <div className="sm:col-span-2"><Err text={run.error} /></div>
      </form>
    </section>
  );
}
