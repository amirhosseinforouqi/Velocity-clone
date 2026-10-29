"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Check, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clientAddVersionAction, clientFinishUploadAction, clientLogout, clientMarkReadAction, clientReplyAction, clientStartConversationAction, clientStartUploadAction,
  readClientNotificationsAction, saveProfileAction,
} from "@/app/portal/actions";
import type { ClientDealView } from "@/server/portal-client";
import { Err, GridPanel, useRun } from "./admin";
import { Badge, ConversationList, FileLink, Thread, UploadButton, usePoll } from "./deal-portal";
import { greenBtn, input, label } from "./ui";
import { when } from "./upload";

type Note = { id: string; title: string; href: string | null; at: Date; read: boolean };

// ---- Shell: same top bar look as the staff app, without the staff sidebar.

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
      <header className="fixed inset-x-0 top-0 z-30 flex h-[60px] items-center gap-3 border-b border-[#eee] bg-white px-4">
        <Link href="/portal" className="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-[#2c3e50]"><KeyRound className="size-6 text-[#3d81be]" />Keyway</Link>
        <span className="hidden text-xs font-semibold tracking-wide text-[#3d81be] uppercase sm:inline">Client Portal</span>
        <nav className="ml-auto flex items-center gap-1" aria-label="Portal">
          {nav.map(([t, h]) => (
            <Link key={h} href={h} aria-current={path === h ? "page" : undefined} className={cn("rounded-[3px] px-2 py-1.5 hover:bg-[#f5f5f5]", path === h && "font-semibold text-[#3d81be]")}>
              {t}{h === "/portal" && unread.messages > 0 && <span className="ml-1 rounded-full bg-[#d9534f] px-1.5 text-[11px] text-white" aria-label={`${unread.messages} unread messages`}>{unread.messages}</span>}
            </Link>
          ))}
          <div className="relative">
            <button onClick={toggle} aria-expanded={open} aria-label={`Notifications${count ? `, ${count} unread` : ""}`} className="relative grid size-9 place-items-center rounded-[3px] hover:bg-[#f5f5f5]">
              <Bell className="size-5 text-[#555]" />
              {count > 0 && <span className="absolute top-0 right-0 grid size-[18px] place-items-center rounded-full bg-[#d9534f] text-[10px] text-white">{count}</span>}
            </button>
            {open && (
              <div className="absolute right-0 z-40 mt-1 w-[300px] rounded-[3px] border border-[#ddd] bg-white shadow-lg">
                <p className="border-b border-[#eee] px-3 py-2 font-semibold">Notifications</p>
                <ul className="max-h-[320px] overflow-y-auto">
                  {notes.length ? notes.map((n) => (
                    <li key={n.id} className="border-b border-[#f4f4f4]">
                      {n.href ? <Link href={n.href} onClick={() => setOpen(false)} className="block px-3 py-2 hover:bg-[#f5f5f5]">{n.title}<span className="block text-[11px] text-[#999]">{when(n.at)}</span></Link>
                        : <p className="px-3 py-2">{n.title}<span className="block text-[11px] text-[#999]">{when(n.at)}</span></p>}
                    </li>
                  )) : <li className="px-3 py-3 text-[#999]">No notifications.</li>}
                </ul>
              </div>
            )}
          </div>
          <form action={clientLogout}><button className="rounded-[3px] px-2 py-1.5 hover:bg-[#f5f5f5]" title={name}>Sign out</button></form>
        </nav>
      </header>
      <main className="mx-auto max-w-[1100px] px-4 pt-[75px] pb-6">{children}</main>
    </div>
  );
}

// ---- One application

const clientUpload = (dealId: string) => ({ start: (i: { fileName: string; size: number; contentType: string }) => clientStartUploadAction(dealId, i), finish: clientFinishUploadAction });

export function ClientApplication({ id, d }: { id: string; d: ClientDealView }) {
  usePoll();
  const [convId, setConvId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const run = useRun();
  const conv = d.conversations.find((c) => c.id === convId);
  const groups = Object.groupBy(d.requests, (r) => r.category);
  const upload = clientUpload(id);
  return (
    <div className="grid gap-4">
      <div>
        <Link href="/portal" className="text-[#428bca] hover:underline">My applications</Link>
        <h1 className="mt-1 text-2xl font-light text-[#444]">Application {d.code}</h1>
        <p className="text-[#777]">{d.firm}{d.purpose && ` · ${d.purpose}`}</p>
      </div>

      <section className="rounded-[3px] border-l-4 border-[#3d81be] bg-white p-4 shadow-[0_1px_1px_rgba(0,0,0,0.1)]" aria-label="Next step">
        <p className="text-xs font-semibold tracking-wide text-[#3d81be] uppercase">Your next step</p>
        <p className="mt-1 text-[15px]">{d.nextAction}</p>
      </section>

      <GridPanel title="Progress">
        <ol className="flex flex-wrap gap-2" aria-label="Stages">
          {d.stages.map((s) => (
            <li key={s.id} aria-current={s.state === "current" ? "step" : undefined}
              className={cn("flex items-center gap-1 rounded-full border px-3 py-1", s.state === "done" && "border-[#5cb85c] bg-[#dff0d8] text-[#3c763d]", s.state === "current" && "border-[#3d81be] bg-[#3d81be] font-semibold text-white", s.state === "upcoming" && "border-[#ddd] text-[#999]")}>
              {s.state === "done" && <Check className="size-3.5" aria-hidden />}{s.label}<span className="sr-only"> ({s.state === "done" ? "completed" : s.state === "current" ? "current stage" : "upcoming"})</span>
            </li>
          ))}
        </ol>
        {d.stage ? <div className="mt-3"><p className="font-semibold">{d.stage.label}</p>{d.stage.description && <p className="text-[#666]">{d.stage.description}</p>}</div>
          : <p className="mt-3 text-[#999]">Your team hasn&apos;t started tracking progress yet.</p>}
        {d.updates.length > 0 && (
          <ul className="mt-3 divide-y divide-[#eee] border-t border-[#eee]">
            {d.updates.map((u) => <li key={u.id} className="py-2"><span className="text-[11px] text-[#999]">{when(u.at)} · {u.label}</span>{u.message && <p className="whitespace-pre-wrap">{u.message}</p>}</li>)}
          </ul>
        )}
      </GridPanel>

      <GridPanel title="Documents">
        {!d.requests.length && <p className="text-[#999]">No documents have been requested.</p>}
        <Err text={run.error} />
        {Object.entries(groups).map(([cat, list]) => (
          <div key={cat} className="mb-4 last:mb-0">
            <h4 className="mb-1 border-b border-[#eee] pb-1 font-semibold text-[#555]">{cat}</h4>
            <ul className="divide-y divide-[#f4f4f4]">
              {list!.map((r) => (
                <li key={r.id} className="grid gap-1 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.name}</span><Badge status={r.status} />
                    {r.shared && <span className="text-[11px] text-[#999]">Shared with co-applicants</span>}
                    {r.dueDate && <span className="text-[11px] text-[#999]">Due {r.dueDate}</span>}
                  </div>
                  {r.description && <p className="text-[#666]">{r.description}</p>}
                  {r.status === "replacement_required" && r.replacementReason && <p className="rounded-[3px] bg-[#f2dede] px-2 py-1 text-[#a94442]">Please upload a new file: {r.replacementReason}</p>}
                  {r.versions.map((v) => <p key={v.version} className="text-[12px]">Version {v.version} · {when(v.at)} · <FileLink f={v} /></p>)}
                  {r.canUpload && (
                    <div>
                      <UploadButton {...upload} text={r.versions.length ? "Upload a new version" : "Upload"} done={(f) => run.go(() => clientAddVersionAction(r.id, f.id))} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="mt-3 text-[11px] text-[#999]">PDF, JPEG or PNG, up to 10 MB. On a phone you can take a photo of the document.</p>
      </GridPanel>

      <GridPanel title="Messages" tools={!conv && !composing && <button onClick={() => setComposing(true)} className={cn(greenBtn, "px-3 py-1")}>New message</button>}>
        {conv ? <Thread c={conv} back={() => setConvId(null)} reply={clientReplyAction} markRead={clientMarkReadAction} upload={upload} />
          : composing ? <Compose dealId={id} upload={upload} close={(newId) => { setComposing(false); if (newId) setConvId(newId); }} />
          : <ConversationList list={d.conversations} open={setConvId} />}
      </GridPanel>
    </div>
  );
}

function Compose({ dealId, upload, close }: { dealId: string; upload: ReturnType<typeof clientUpload>; close: (id?: string) => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<{ id: string; fileName: string }[]>([]);
  const run = useRun();
  return (
    <div className="grid gap-2">
      <label><span className={label}>Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} className={input} /></label>
      <label><span className={label}>Message</span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={5000} className={cn(input, "h-auto py-1")} /></label>
      {files.length > 0 && <p className="text-[#666]">Attached: {files.map((f) => f.fileName).join(", ")}</p>}
      <Err text={run.error} />
      <div className="flex flex-wrap items-start gap-2">
        <button disabled={run.pending || !subject.trim() || (!body.trim() && !files.length)}
          onClick={() => run.go(async () => {
            const r = await clientStartConversationAction(dealId, { subject, body, fileIds: files.map((f) => f.id) });
            if (r.data) close(r.data);
            return r;
          })}
          className={cn(greenBtn, "px-3 py-1 disabled:opacity-60")}>Send</button>
        {files.length < 5 && <UploadButton {...upload} text="Attach file" multiple done={(f) => setFiles((x) => [...x, f])} />}
        <button onClick={() => close()} className="px-2 py-1 text-[#428bca] hover:underline">Cancel</button>
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
      <form className="grid max-w-[480px] gap-2" onSubmit={(e) => {
        e.preventDefault();
        const form = Object.fromEntries(new FormData(e.currentTarget));
        run.go(() => saveProfileAction(p.clientId, { ...form, emailNotifications: form.emailNotifications === "on" }), () => setSaved(true));
      }}>
        <p><span className="font-semibold">{p.name}</span><br /><span className="text-[#666]">{p.email}</span> <span className="text-[11px] text-[#999]">(to change your email, contact your team)</span></p>
        {field("cellPhone", "Cell phone")}
        {field("homePhone", "Home phone")}
        {field("workPhone", "Work phone")}
        {field("address", "Mailing address", "text")}
        <label className="flex items-center gap-2"><input type="checkbox" name="emailNotifications" defaultChecked={p.emailNotifications} onChange={() => setSaved(false)} />Email me when there&apos;s something new (emails never include document or message content)</label>
        <Err text={run.error} />
        {saved && <p role="status" className="text-[#3c763d]">Saved.</p>}
        <div><button disabled={run.pending} className={cn(greenBtn, "px-3 py-1 disabled:opacity-60")}>{run.pending ? "Saving..." : "Save"}</button></div>
      </form>
    </GridPanel>
  );
}
