"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addNoteAction, assignAction, cancelRequestAction, inviteAction, markReadAction, portalAccessAction, purgeDealAction, releaseFileAction, remindAction, replyAction,
  requestDocumentsAction, resendInviteAction, reviewAction, revokeInviteAction, setStageAction, staffAddVersionAction, staffFinishUploadAction, staffStartUploadAction,
  startConversationAction,
} from "@/app/deal/portal-actions";
import type { PortalWorkspace } from "@/server/portal";
import { Confirm, Err, GridPanel, useRun } from "./admin";
import { AppShell } from "./shell";
import { blueBtn, greenBtn, greyBtn, Grid, input, label, Modal, redBtn } from "./ui";
import { ACCEPT, fileSize, scanText, statusText, statusTone, uploadFile, when, type Uploaded } from "./upload";

const small = "px-2 py-0.5 text-xs disabled:opacity-60";
const area = cn(input, "h-auto py-1");
type Run = ReturnType<typeof useRun>;

// Re-reads the page every 20 seconds while it's visible, so new uploads and messages show up without a reload.
// ponytail: polling, not Supabase realtime; switch if 20 seconds is too slow.
export function usePoll(ms = 20000) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), ms);
    return () => clearInterval(t);
  }, [router, ms]);
}

export const Badge = ({ status }: { status: string }) => (
  <span className={cn("inline-block rounded-[3px] px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white", statusTone[status] ?? "bg-[#777]")}>{statusText[status] ?? status}</span>
);

export function FileLink({ f }: { f: { fileId: string; fileName: string; size: number | null; scan: string; purged: boolean } }) {
  if (f.purged) return <span className="text-[#999]">{f.fileName} (deleted)</span>;
  const ok = f.scan === "clean" || f.scan === "released";
  return (
    <span>
      {ok ? <a href={`/api/files/${f.fileId}`} className="text-[#428bca] hover:underline">{f.fileName}</a> : <span>{f.fileName}</span>}
      <span className="text-[#999]"> {fileSize(f.size)}{f.scan !== "clean" && ` · ${scanText[f.scan] ?? f.scan}`}</span>
    </span>
  );
}

// Pick and upload files; reports each finished upload. Used by staff and by clients.
export function UploadButton({ text, multiple, start, finish, done }: {
  text: string; multiple?: boolean;
  start: Parameters<typeof uploadFile>[1]; finish: Parameters<typeof uploadFile>[2]; done: (f: Uploaded) => void | Promise<void>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    setError("");
    const errors: string[] = [];
    for (const file of Array.from(list)) {
      const r = await uploadFile(file, start, finish);
      if (r.error || !r.data) errors.push(r.error ?? "Upload failed");
      else await done(r.data);
    }
    setError(errors.join(" "));
    setBusy(false);
    if (ref.current) ref.current.value = "";
  };
  return (
    <span className="inline-flex flex-col items-start">
      <label className={cn(greyBtn, small, "cursor-pointer", busy && "pointer-events-none opacity-60")}>
        {busy ? "Uploading..." : text}
        <input ref={ref} type="file" accept={ACCEPT} multiple={multiple} className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files)} />
      </label>
      {error && <span role="alert" className="mt-1 text-[#a94442]">{error}</span>}
    </span>
  );
}

// ---- Messages (shared with the client portal)

export type Conversation = PortalWorkspace["conversations"][number];

export function Thread({ c, reply, markRead, upload, back }: {
  c: Conversation; back: () => void;
  reply: (conversationId: string, body: string, fileIds: string[]) => Promise<{ error?: string }>;
  markRead: (conversationId: string) => Promise<unknown>;
  upload: Omit<Parameters<typeof UploadButton>[0], "text" | "done" | "multiple">;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Uploaded[]>([]);
  const run = useRun();
  const end = useRef<HTMLDivElement>(null);
  const unread = c.unread;
  useEffect(() => {
    if (unread) void markRead(c.id);
  }, [unread, markRead, c.id]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [c.messages.length]);
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <button onClick={back} className={cn(greyBtn, small)}>Back</button>
        <h4 className="text-[14px] font-semibold text-[#444]">{c.subject}</h4>
      </div>
      <ol className="max-h-[420px] space-y-2 overflow-y-auto rounded-[3px] border border-[#eee] bg-[#fafafa] p-2" aria-label="Messages">
        {c.messages.map((m) => (
          <li key={m.id} className={cn("max-w-[85%] rounded-[4px] p-2", m.mine ? "ml-auto bg-[#dff0d8]" : "bg-white shadow-[0_0_2px_rgba(0,0,0,0.15)]")}>
            <p className="text-[11px] text-[#888]">{m.author} · {when(m.at)}{m.mine && m.seen && " · Read"}</p>
            {m.purged ? <p className="text-[#999] italic">Deleted under the retention policy</p> : m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
            {m.attachments.map((a) => <p key={a.fileId}><FileLink f={a} /></p>)}
          </li>
        ))}
        <div ref={end} />
      </ol>
      <div className="mt-2 grid gap-2">
        <label><span className="sr-only">Reply</span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={5000} placeholder="Write a reply" className={area} /></label>
        {files.length > 0 && <p className="text-[#666]">Attached: {files.map((f) => f.fileName).join(", ")} <button onClick={() => setFiles([])} className="text-[#428bca] hover:underline">Remove</button></p>}
        <Err text={run.error} />
        <div className="flex flex-wrap items-start gap-2">
          <button disabled={run.pending || (!body.trim() && !files.length)} onClick={() => run.go(() => reply(c.id, body, files.map((f) => f.id)), () => { setBody(""); setFiles([]); })} className={cn(greenBtn, "px-3 py-1 disabled:opacity-60")}>Send</button>
          {files.length < 5 && <UploadButton {...upload} text="Attach file" multiple done={(f) => setFiles((x) => [...x, f])} />}
        </div>
      </div>
    </div>
  );
}

export function ConversationList({ list, open }: { list: Conversation[]; open: (id: string) => void }) {
  if (!list.length) return <p className="text-[#999]">No messages yet.</p>;
  return (
    <ul className="divide-y divide-[#eee]">
      {list.map((c) => {
        const last = c.messages.at(-1);
        return (
          <li key={c.id}>
            <button onClick={() => open(c.id)} className="flex w-full items-center gap-2 py-2 text-left hover:bg-[#f9f9f9]">
              <span className={cn("flex-1", c.unread && "font-semibold")}>{c.subject}</span>
              <span className="text-[11px] text-[#999]">{last && when(last.at)}</span>
              {c.unread > 0 && <span className="rounded-full bg-[#d9534f] px-1.5 text-[11px] text-white" aria-label={`${c.unread} unread`}>{c.unread}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---- The deal's Client Portal tab

const staffUpload = (dealId: string) => ({ start: (i: { fileName: string; size: number; contentType: string }) => staffStartUploadAction(dealId, i), finish: staffFinishUploadAction });
const inviteText: Record<string, string> = { pending: "Invited", accepted: "Accepted", revoked: "Revoked", expired: "Expired" };

export function AppDealPortal({ w, orgAdmin }: { w: PortalWorkspace; orgAdmin: boolean }) {
  usePoll();
  const id = w.deal.id;
  const [modal, setModal] = useState<ReactNode>(null);
  const [link, setLink] = useState<{ name: string; url: string; why: string } | null>(null);
  const [convId, setConvId] = useState<string | null>(null);
  const run = useRun();
  const close = () => setModal(null);
  const name = (contactId: string | null) => (contactId ? w.applicants.find((a) => a.contactId === contactId)?.name ?? "Applicant" : "All applicants");
  const invite = (fn: () => Promise<{ error?: string; data?: { link: string | null; error: string | null } }>, who: string) => run.go(async () => {
    const r = await fn();
    if (r.data?.link) setLink({ name: who, url: r.data.link, why: r.data.error ?? (w.emailConfigured ? "The email couldn't be sent." : "Email sending isn't set up.") });
    return r;
  });
  const conv = w.conversations.find((c) => c.id === convId);
  const byCategory = Object.entries(Object.groupBy(w.requests, (r) => r.category));
  const unread = w.conversations.reduce((n, c) => n + c.unread, 0);

  return (
    <AppShell deal={{ id, number: w.deal.number }}>
      <section className="relative mx-[25px] mb-5 flex items-center gap-2.5 text-[#666]">
        <UsersRound className="size-7 stroke-[1.5]" />
        <h1 className="text-[28px] leading-[38px] font-light">Client Portal</h1>
        <ol className="ml-auto hidden items-center gap-1 text-xs sm:flex">
          <li><Link href="/" className="text-[#444] hover:underline">Home</Link></li>
          <li className="before:mr-1 before:text-[#ccc] before:content-['>']"><Link href={`/deal/${id}`} className="text-[#444] hover:underline">Deal</Link></li>
          <li className="before:mr-1 before:text-[#ccc] before:content-['>']">Client Portal</li>
        </ol>
      </section>
      {run.error && <div className="mx-[25px]"><Err text={run.error} /></div>}
      {link && (
        <div role="status" className="mx-[25px] mb-4 rounded-[3px] border border-[#faebcc] bg-[#fcf8e3] p-3 text-[12.6px] text-[#8a6d3b]">
          <p><strong>The invitation for {link.name} was not emailed.</strong> {link.why} Share this one-time link with them another way (it isn&apos;t shown again):</p>
          <input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label="Invitation link" className={cn(input, "mt-2")} />
          <div className="mt-2 flex gap-2">
            <button onClick={() => navigator.clipboard?.writeText(link.url)} className={cn(blueBtn, small)}>Copy</button>
            <button onClick={() => setLink(null)} className={cn(greyBtn, small)}>Done</button>
          </div>
        </div>
      )}

      <GridPanel title="Applicants" tools={!w.emailConfigured && <span className="text-[#8a6d3b]">Email not set up: invitation links are shown here instead</span>}>
        <Grid min={760} head={["Applicant", "Email", "Portal account", "Invitation", "Access", ""]} rows={w.applicants.map((a) => {
          const inv = a.invitations[0];
          return [
            <span key="n">{a.name}{a.primary && <span className="text-[#999]"> (primary)</span>}</span>,
            a.email || <span className="text-[#a94442]">No email on contact</span>,
            a.accountLinked ? <span key="a">Active{a.lastSignInAt && <span className="block text-[#999]">Last sign-in {when(a.lastSignInAt)}</span>}</span> : "Not yet",
            inv ? (
              <span key="i">
                {inviteText[inv.status] ?? inv.status}{inv.status === "pending" && ` · expires ${when(inv.expiresAt)}`}
                {inv.delivery && <span className={cn("block", ["failed", "bounced", "complained", "not_configured"].includes(inv.delivery.status) ? "text-[#a94442]" : "text-[#999]")}>
                  Email: {inv.delivery.status.replace("_", " ")}{inv.delivery.error && ` (${inv.delivery.error})`}
                </span>}
                {inv.sentCount > 1 && <span className="block text-[#999]">Sent {inv.sentCount} times</span>}
              </span>
            ) : "None",
            a.accountLinked ? (a.portalAccess ? "On" : "Off") : "",
            <span key="b" className="flex flex-wrap gap-1">
              {inv?.status === "pending" ? <>
                <button disabled={run.pending} onClick={() => invite(() => resendInviteAction(inv.id), a.name)} className={cn(blueBtn, small)}>Resend</button>
                <button disabled={run.pending} onClick={() => run.go(() => revokeInviteAction(inv.id))} className={cn(greyBtn, small)}>Revoke</button>
              </> : !a.accountLinked && <button disabled={run.pending || !a.email} onClick={() => invite(() => inviteAction(id, a.contactId), a.name)} className={cn(greenBtn, small)}>{inv ? "Invite again" : "Invite"}</button>}
              {a.accountLinked && <button disabled={run.pending} onClick={() => run.go(() => portalAccessAction(id, a.contactId, !a.portalAccess))} className={cn(greyBtn, small)}>{a.portalAccess ? "Turn off access" : "Turn on access"}</button>}
            </span>,
          ];
        })} />
        <p className="mt-2 text-[#999]">Each applicant only sees documents and messages addressed to them or to all applicants.</p>
      </GridPanel>

      <GridPanel title="Progress" tools={<button onClick={() => setModal(<StageModal w={w} close={close} />)} className={cn(greenBtn, "px-3 py-1")}>Update Stage</button>}>
        <ol className="mb-3 flex flex-wrap gap-1" aria-label="Client-facing stages">
          {w.stages.map((s, i) => {
            const at = w.stages.findIndex((x) => x.id === w.deal.clientStageId);
            return <li key={s.id} aria-current={i === at ? "step" : undefined} className={cn("rounded-[3px] px-2 py-1 text-[11px]", i < at ? "bg-[#dff0d8] text-[#3c763d]" : i === at ? "bg-[#428bca] text-white" : "bg-[#f5f5f5] text-[#999]")}>{s.label}</li>;
          })}
        </ol>
        <p className="mb-2 text-[#999]">This is what clients see. The internal deal status is separate and never shown to them.</p>
        <Grid min={500} head={["Date", "Stage", "Message to client", "By"]} empty="Not started" rows={w.updates.map((u) => [when(u.at), u.label, u.message, u.by])} />
      </GridPanel>

      <GridPanel title="Documents" tools={<button onClick={() => setModal(<RequestModal w={w} close={close} />)} className={cn(greenBtn, "px-3 py-1")}>Request Documents</button>}>
        {!byCategory.length && <p className="text-[#999]">No documents requested yet.</p>}
        {byCategory.map(([category, list]) => (
          <div key={category} className="mb-3">
            <h4 className="mb-1 font-semibold text-[#666]">{category}</h4>
            <Grid min={800} head={["Document", "For", "Status", "Versions", ""]} rows={list!.map((r) => [
              <span key="d">{r.name}{r.description && <span className="block text-[#999]">{r.description}</span>}{r.dueDate && <span className="block text-[#999]">Due {r.dueDate}</span>}</span>,
              r.applicant ?? "All applicants",
              <span key="s"><Badge status={r.status} />{r.replacementReason && <span className="mt-1 block text-[#a94442]">{r.replacementReason}</span>}{r.lastRemindedAt && <span className="block text-[#999]">Reminded {when(r.lastRemindedAt)}</span>}</span>,
              r.versions.length ? (
                <ul key="v" className="space-y-1">{r.versions.map((v) => (
                  <li key={v.id}>v{v.version} <FileLink f={v} /> <span className="block text-[#999]">{when(v.at)} · {v.by}</span>
                    {v.scan === "not_scanned" && w.canRelease && <button disabled={run.pending} onClick={() => run.go(() => releaseFileAction(v.fileId))} className={cn(blueBtn, small)}>Release</button>}
                  </li>
                ))}</ul>
              ) : "",
              <span key="a" className="flex flex-wrap gap-1">
                {r.status === "uploaded" && <button disabled={run.pending} onClick={() => run.go(() => reviewAction(r.id, "under_review"))} className={cn(blueBtn, small)}>Start review</button>}
                {(r.status === "uploaded" || r.status === "under_review") && <button disabled={run.pending} onClick={() => run.go(() => reviewAction(r.id, "accepted"))} className={cn(greenBtn, small)}>Accept</button>}
                {["uploaded", "under_review", "accepted"].includes(r.status) && <button onClick={() => setModal(<ReplaceModal requestId={r.id} name={r.name} close={close} />)} className={cn(redBtn, small)}>Request replacement</button>}
                {(r.status === "requested" || r.status === "replacement_required") && <button disabled={run.pending} onClick={() => run.go(() => remindAction(r.id))} className={cn(greyBtn, small)}>Remind</button>}
                <UploadButton text="Upload for client" {...staffUpload(id)} done={async (f) => run.go(() => staffAddVersionAction(r.id, f.id))} />
                <button onClick={() => setModal(<Confirm title="Cancel Request" text={`Cancel the request for "${r.name}"? Uploaded versions stay in the audit trail.`} close={close} ok={() => cancelRequestAction(r.id)} />)} className={cn(greyBtn, small)}>Cancel</button>
              </span>,
            ])} />
          </div>
        ))}
      </GridPanel>

      <GridPanel title={`Messages${unread ? ` (${unread} unread)` : ""}`} tools={<button onClick={() => setModal(<NewConversationModal w={w} close={close} open={setConvId} />)} className={cn(greenBtn, "px-3 py-1")}>New Message</button>}>
        {conv ? (
          <>
            <p className="mb-2 text-[#999]">With: {name(conv.applicantContactId)}</p>
            <Thread c={conv} back={() => setConvId(null)} reply={replyAction} markRead={markReadAction} upload={staffUpload(id)} />
          </>
        ) : <ConversationList list={w.conversations} open={setConvId} />}
      </GridPanel>

      <GridPanel title="Staff Notes" tools={<span className="font-semibold text-[#a94442]">Internal: clients never see these</span>}>
        <NoteForm dealId={id} />
        <ul className="mt-2 space-y-2">{w.notes.map((n) => <li key={n.id} className="rounded-[3px] bg-[#fcf8e3] p-2"><p className="text-[11px] text-[#888]">{n.by} · {when(n.at)}</p><p className="whitespace-pre-wrap">{n.body}</p></li>)}</ul>
      </GridPanel>

      {w.team && (
        <GridPanel title="Assignment">
          <label className="flex max-w-[400px] items-center gap-2">
            <span className="whitespace-nowrap">Assigned to</span>
            <select value={w.deal.assigneeId ?? ""} disabled={run.pending} onChange={(e) => run.go(() => assignAction(id, e.target.value))} className={input}>
              <option value="">The deal&apos;s agent</option>
              {w.team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
        </GridPanel>
      )}

      <GridPanel title="Portal Activity" tools={orgAdmin && <button onClick={() => setModal(<Confirm title="Delete Portal Data" text="Permanently delete this deal's portal files and message text, and turn off client access? Names, dates and the audit trail are kept. This can't be undone." close={close} ok={() => purgeDealAction(id)} />)} className={cn(redBtn, "px-3 py-1")}>Delete Portal Data</button>}>
        <Grid min={500} head={["Date", "Action", "By"]} rows={w.activity.map((a) => [when(a.at), a.action.replace("portal_", "").replaceAll("_", " "), a.staff ?? a.client ?? "System"])} />
      </GridPanel>
      {modal}
    </AppShell>
  );
}

function Footer({ run, ok, close, text = "Save" }: { run: Run; ok: () => void; close: () => void; text?: string }) {
  return <>
    <button disabled={run.pending} onClick={ok} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px] disabled:opacity-60")}>{text}</button>
    <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
  </>;
}

function ApplicantSelect({ w, value, set }: { w: PortalWorkspace; value: string; set: (v: string) => void }) {
  return (
    <label><span className={label}>Visible to</span>
      <select value={value} onChange={(e) => set(e.target.value)} className={input}>
        <option value="">All applicants on this deal</option>
        {w.applicants.map((a) => <option key={a.contactId} value={a.contactId}>{a.name} only</option>)}
      </select>
    </label>
  );
}

function StageModal({ w, close }: { w: PortalWorkspace; close: () => void }) {
  const [stageId, setStage] = useState(w.deal.clientStageId ?? w.stages[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const run = useRun();
  return (
    <Modal title="Update Client Progress" close={close} footer={<Footer run={run} text="Update" close={close} ok={() => run.go(() => setStageAction(w.deal.id, stageId, message), close)} />}>
      <div className="grid gap-3 text-[12.6px]">
        <label><span className={label}>Stage</span><select value={stageId} onChange={(e) => setStage(e.target.value)} className={input}>{w.stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label><span className={label}>Message to the client (optional)</span><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} className={area} /></label>
        <p className="text-[#999]">Clients are notified that their application moved forward. The email doesn&apos;t include this message; they read it after signing in.</p>
        <Err text={run.error} />
      </div>
    </Modal>
  );
}

function RequestModal({ w, close }: { w: PortalWorkspace; close: () => void }) {
  const [v, setV] = useState({ checklistId: "", name: "", category: "", description: "", dueDate: "", applicantContactId: "" });
  const run = useRun();
  const list = w.checklists.find((c) => c.id === v.checklistId);
  return (
    <Modal wide title="Request Documents" close={close} footer={<Footer run={run} text="Request" close={close} ok={() => run.go(() => requestDocumentsAction(w.deal.id, v), close)} />}>
      <div className="grid gap-3 text-[12.6px] sm:grid-cols-2">
        <label className="sm:col-span-2"><span className={label}>From a checklist</span>
          <select value={v.checklistId} onChange={(e) => setV({ ...v, checklistId: e.target.value })} className={input}>
            <option value="">No, one document</option>
            {w.checklists.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.items.length})</option>)}
          </select>
        </label>
        {list ? <ul className="list-disc pl-5 text-[#666] sm:col-span-2">{list.items.map((i) => <li key={i.name}>{i.name} <span className="text-[#999]">({i.category})</span></li>)}</ul> : <>
          <label><span className={label}>Document</span><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={120} className={input} /></label>
          <label><span className={label}>Category</span><input value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} maxLength={60} placeholder="General" className={input} /></label>
          <label className="sm:col-span-2"><span className={label}>Instructions for the client</span><textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={2} maxLength={1000} className={area} /></label>
        </>}
        <ApplicantSelect w={w} value={v.applicantContactId} set={(x) => setV({ ...v, applicantContactId: x })} />
        <label><span className={label}>Due date (optional)</span><input type="date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} className={input} /></label>
        <div className="sm:col-span-2"><Err text={run.error} /></div>
      </div>
    </Modal>
  );
}

function ReplaceModal({ requestId, name, close }: { requestId: string; name: string; close: () => void }) {
  const [reason, setReason] = useState("");
  const run = useRun();
  return (
    <Modal title={`Request Replacement: ${name}`} close={close} footer={<Footer run={run} text="Request replacement" close={close} ok={() => run.go(() => reviewAction(requestId, "replacement_required", reason), close)} />}>
      <label className="text-[12.6px]"><span className={label}>Reason (the client sees this)</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} required className={area} /></label>
      <Err text={run.error} />
    </Modal>
  );
}

function NewConversationModal({ w, close, open }: { w: PortalWorkspace; close: () => void; open: (id: string) => void }) {
  const [v, setV] = useState({ subject: "", body: "", applicantContactId: "" });
  const [files, setFiles] = useState<Uploaded[]>([]);
  const run = useRun();
  const send = () => run.go(async () => {
    const r = await startConversationAction(w.deal.id, { ...v, fileIds: files.map((f) => f.id) });
    if (r.data) open(r.data);
    return r;
  }, close);
  return (
    <Modal title="New Secure Message" close={close} footer={<Footer run={run} text="Send" close={close} ok={send} />}>
      <div className="grid gap-3 text-[12.6px]">
        <ApplicantSelect w={w} value={v.applicantContactId} set={(x) => setV({ ...v, applicantContactId: x })} />
        <label><span className={label}>Subject</span><input value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} maxLength={120} className={input} /></label>
        <label><span className={label}>Message</span><textarea value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} rows={5} maxLength={5000} className={area} /></label>
        {files.length > 0 && <p className="text-[#666]">Attached: {files.map((f) => f.fileName).join(", ")}</p>}
        {files.length < 5 && <UploadButton text="Attach file" multiple {...staffUpload(w.deal.id)} done={(f) => setFiles((x) => [...x, f])} />}
        <p className="text-[#999]">The client gets an email saying they have a new message. The email never includes the message itself.</p>
        <Err text={run.error} />
      </div>
    </Modal>
  );
}

function NoteForm({ dealId }: { dealId: string }) {
  const [body, setBody] = useState("");
  const run = useRun();
  return (
    <div className="grid gap-2">
      <label><span className="sr-only">New staff note</span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={5000} placeholder="Add an internal note" className={area} /></label>
      <Err text={run.error} />
      <div><button disabled={run.pending || !body.trim()} onClick={() => run.go(() => addNoteAction(dealId, body), () => setBody(""))} className={cn(blueBtn, "px-3 py-1 disabled:opacity-60")}>Add Note</button></div>
    </div>
  );
}
