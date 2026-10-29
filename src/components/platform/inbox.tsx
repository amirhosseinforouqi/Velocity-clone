"use client";

import { useState, type ReactNode } from "react";
import { Bell, Bookmark, Copy, Mail, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { placeholder, placeholderAgents, placeholderContacts, placeholderMessages, placeholderNewApps, placeholderReportDeals, type Message } from "./placeholder-data";
import { money, AppShell } from "./shell";
import { blueBtn, greenBtn, greyBtn, Grid, input, label, Modal, PageHeader, Pager, panel, redBtn } from "./ui";

const fmt = (d: string) => new Date(d.length > 10 ? d : d + "T00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
const fmtTime = (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });
const importanceColor: Record<Message["importance"], string> = { Important: "bg-[#d9534f]", Warning: "bg-[#f0ad4e]", System: "bg-[#777]", Share: "bg-[#5bc0de]" };

export function AppMessages() {
  const [msgs, setMsgs] = useState(placeholderMessages);
  const [unread, setUnread] = useState(false);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Partial<Message> | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const q = search.toLowerCase();
  const rows = msgs.filter((m) => (!unread || !m.read) && (!q || [m.title, m.to, m.body].some((v) => v.toLowerCase().includes(q))));
  const markRead = (id: number) => setMsgs(msgs.map((m) => (m.id === id ? { ...m, read: true } : m)));

  return (
    <AppShell>
      <PageHeader icon={Mail} title="Message Centre" crumbs={[["Message Centre"]]} />
      <div className={panel}>
        <div className="flex flex-wrap items-center gap-3 px-[15px] py-2.5 text-[12.6px]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} /> Unread only</label>
          <button onClick={() => setEditing({ importance: "Share", to: placeholder.userName })} className={cn(greenBtn, "px-3 py-1")}>+ New Message</button>
          <button onClick={() => setConfirmAll(true)} className={cn(greyBtn, "px-3 py-1")}>Mark All as Read</button>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className={cn(input, "ml-auto h-[34px] w-[240px]")} />
        </div>
        <div className="p-[15px] pt-0">
          <Grid head={["Title", "To", "Importance", "Read", "Sent", "Edit"]} rows={rows.map((m) => [
            <button key="t" onClick={() => setViewing(m)} className={cn("text-left text-[#428bca] hover:underline", !m.read && "font-bold")}>{m.title}</button>,
            m.to,
            <span key="i" className={cn("rounded px-1.5 py-0.5 text-[11px] text-white", importanceColor[m.importance])}>{m.importance}</span>,
            m.read ? "Yes" : "No",
            fmtTime(m.sent),
            <button key="e" onClick={() => setEditing(m)} className={cn(blueBtn, "px-2 py-0.5 text-xs")}>Edit</button>,
          ])} />
          <div className="mt-2"><Pager from={1} to={rows.length} total={rows.length} /></div>
        </div>
      </div>

      {viewing && (
        <Modal title={viewing.title} close={() => setViewing(null)} footer={<>
          {viewing.loanCode && <Link href={`/deal?loanCode=${viewing.loanCode}`} className={cn(blueBtn, "px-3 py-1.5 text-[12.6px]")}>Go to Deal</Link>}
          {!viewing.read && <button onClick={() => { markRead(viewing.id); setViewing(null); }} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px]")}>Mark as Read</button>}
          <button onClick={() => setViewing(null)} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Close</button>
        </>}>
          <p className="mb-3 text-xs text-[#999]">Sent by {viewing.from} on {fmtTime(viewing.sent)}</p>
          <p className="text-[12.6px]">{viewing.body}</p>
        </Modal>
      )}
      {editing && <EditMessage msg={editing} close={() => setEditing(null)} save={(m) => {
        setMsgs(m.id ? msgs.map((x) => (x.id === m.id ? m : x)) : [m, ...msgs]);
        setEditing(null);
      }} remove={(id) => { setMsgs(msgs.filter((m) => m.id !== id)); setEditing(null); }} />}
      {confirmAll && (
        <Modal title="Please confirm" close={() => setConfirmAll(false)} footer={<>
          <button onClick={() => { setMsgs(msgs.map((m) => ({ ...m, read: true }))); setConfirmAll(false); }} className={cn(blueBtn, "px-4 py-1.5 text-[12.6px]")}>Yes</button>
          <button onClick={() => setConfirmAll(false)} className={cn(greyBtn, "px-4 py-1.5 text-[12.6px]")}>No</button>
        </>}><p className="text-[12.6px]">Are you sure you want to mark all messages as read?</p></Modal>
      )}
    </AppShell>
  );
}

function EditMessage({ msg, close, save, remove }: { msg: Partial<Message>; close: () => void; save: (m: Message) => void; remove: (id: number) => void }) {
  const [m, setM] = useState(msg);
  const [toType, setToType] = useState("User");
  const [err, setErr] = useState(false);
  const send = (draft: boolean) => {
    if (!m.title?.trim()) return setErr(true);
    save({ id: m.id ?? Date.now(), title: m.title, to: m.to ?? placeholder.userName, importance: m.importance ?? "Share", read: m.read ?? false, sent: new Date().toISOString().slice(0, 16), from: placeholder.userName, body: m.body ?? "", loanCode: m.loanCode, draft });
  };
  return (
    <Modal title="Send to Message Centre" close={close} footer={<>
      <button onClick={() => send(false)} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px]")}>Send</button>
      <button onClick={() => send(true)} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Save as Draft</button>
      {m.id && <button onClick={() => remove(m.id!)} className={cn(redBtn, "px-3 py-1.5 text-[12.6px]")}>Delete</button>}
    </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className={label}>To</span>
          <select value={toType} onChange={(e) => setToType(e.target.value)} className={input}>{["Organization", "Office", "Suboffice", "Team", "User"].map((o) => <option key={o}>{o}</option>)}</select>
        </label>
        <label><span className={label}>{toType}</span>
          <select value={m.to} onChange={(e) => setM({ ...m, to: e.target.value })} className={input}>
            {(toType === "User" ? placeholderAgents : toType === "Office" ? ["Toronto Office", "Ottawa Office"] : [`All ${toType}`]).map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label><span className={label}>Item</span><input value={m.loanCode ?? ""} onChange={(e) => setM({ ...m, loanCode: e.target.value })} placeholder="Loan code (optional)" className={input} /></label>
        <label><span className={label}>Importance</span>
          <select value={m.importance} onChange={(e) => setM({ ...m, importance: e.target.value as Message["importance"] })} className={input}>{Object.keys(importanceColor).map((o) => <option key={o}>{o}</option>)}</select>
        </label>
        <label className="sm:col-span-2"><span className={label}>Subject</span><input value={m.title ?? ""} onChange={(e) => { setM({ ...m, title: e.target.value }); setErr(false); }} className={cn(input, err && "border-[#d9534f]")} /></label>
        <label className="sm:col-span-2"><span className={label}>Message</span><textarea value={m.body ?? ""} onChange={(e) => setM({ ...m, body: e.target.value })} rows={5} className={cn(input, "h-auto py-1")} /></label>
      </div>
      {err && <p className="mt-1 text-xs text-[#a94442]">Subject is required.</p>}
    </Modal>
  );
}

export function AppNewApplications() {
  const [apps, setApps] = useState(placeholderNewApps);
  const [search, setSearch] = useState("");
  const [per, setPer] = useState(25);
  const [copied, setCopied] = useState(false);
  const link = "https://apply.example.com/sample-agent";
  const q = search.toLowerCase();
  const rows = apps.filter((a) => !q || Object.values(a).some((v) => String(v).toLowerCase().includes(q))).slice(0, per);
  return (
    <AppShell>
      <PageHeader icon={Bookmark} title="New Applications" crumbs={[["New Applications"]]} />
      <div className={panel}>
        <div className="flex flex-wrap items-center gap-3 px-[15px] py-2.5 text-[12.6px]">
          <span className="font-semibold">Your Customer Application Form link:</span>
          <code className="rounded bg-[#f5f5f5] px-2 py-1">{link}</code>
          <button onClick={() => { void navigator.clipboard?.writeText(link); setCopied(true); }} className={cn(greyBtn, "flex items-center gap-1 px-2 py-1")}><Copy className="size-3.5" /> {copied ? "Copied!" : "Copy"}</button>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-[15px] pb-2.5 text-[12.6px]">
          <label className="flex items-center gap-2">Records per page
            <select value={per} onChange={(e) => setPer(Number(e.target.value))} className={cn(input, "w-[70px]")}>{[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}</select>
          </label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className={cn(input, "ml-auto h-[34px] w-[240px]")} />
        </div>
        <div className="p-[15px] pt-0">
          <Grid min={900} head={["Office", "First Name", "Last Name", "Mortgage Amount", "Closing Date", "Conditions Date", "Entry Date", "Source", "Actions"]} rows={rows.map((a) => [
            a.office, a.firstName, a.lastName, money(a.amount), fmt(a.closingDate), fmt(a.conditionsDate), fmt(a.entryDate), a.source,
            <span key="a" className="flex gap-1">
              <Link href="/deal" className={cn(blueBtn, "px-2 py-0.5 text-xs")}>View</Link>
              <button onClick={() => setApps([...apps, { ...a, id: Date.now(), entryDate: new Date().toISOString().slice(0, 10), source: "Keyway" }])} className={cn(greyBtn, "px-2 py-0.5 text-xs")}>Duplicate</button>
            </span>,
          ])} />
          <div className="mt-2"><Pager from={1} to={rows.length} total={apps.length} /></div>
        </div>
      </div>
    </AppShell>
  );
}

const reminderColor: Record<string, string> = { Urgent: "bg-[#d9534f]", Warning: "bg-[#f0ad4e]", Notice: "bg-[#5bc0de]" };

export function AppReminders({ reminders }: { reminders: { id: string; level: string; firstName: string | null; lastName: string | null; amount: number | null; closingDate: string | null; conditionsDate: string | null }[] }) {
  const [type, setType] = useState("All");
  const rows = reminders.filter((r) => type === "All" || r.level === type);
  return (
    <AppShell>
      <PageHeader icon={Bell} title="Deal Reminders" crumbs={[["Deal Reminders"]]} />
      <div className={panel}>
        <div className="flex px-[15px] py-2.5 text-[12.6px]">
          <label className="flex items-center gap-2">Type
            <select value={type} onChange={(e) => setType(e.target.value)} className={cn(input, "w-[120px]")}>{["All", "Urgent", "Warning", "Notice"].map((o) => <option key={o}>{o}</option>)}</select>
          </label>
        </div>
        <div className="p-[15px] pt-0">
          <Grid head={["Type", "First Name", "Last Name", "Mortgage Amount", "Closing Date", "Conditions Date", ""]} rows={rows.map((r) => [
            <span key="t" className={cn("rounded px-1.5 py-0.5 text-[11px] text-white", reminderColor[r.level])}>{r.level}</span>,
            r.firstName ?? "", r.lastName ?? "", r.amount == null ? "" : money(r.amount), r.closingDate ? fmt(r.closingDate) : "", r.conditionsDate ? fmt(r.conditionsDate) : "",
            <Link key="v" href={`/deal/${r.id}`} className={cn(blueBtn, "px-2 py-0.5 text-xs")}>View</Link>,
          ])} />
        </div>
      </div>
    </AppShell>
  );
}

export function AppSearch() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [scope, setScope] = useState(params.get("scope") ?? "All");
  const [adv, setAdv] = useState({ first: "", last: "", email: "", phone: "", loanCode: "" });
  const [advanced, setAdvanced] = useState(params.has("advanced"));
  const has = (v: string | undefined, s: string) => !s || (v ?? "").toLowerCase().includes(s.toLowerCase());
  const deals = placeholderReportDeals.filter((d) => has(`${d.loanCode} ${d.client} ${d.lender}`, q) && has(d.client.split(" ")[0], adv.first) && has(d.client.split(" ")[1], adv.last) && has(d.loanCode, adv.loanCode));
  const contacts = placeholderContacts.filter((c) => has(`${c.firstName} ${c.lastName} ${c.email} ${c.cellPhone} ${c.homePhone}`, q) && has(c.firstName, adv.first) && has(c.lastName, adv.last) && has(c.email, adv.email) && has(`${c.cellPhone} ${c.homePhone} ${c.workPhone}`, adv.phone));
  const leads = contacts.filter((c) => !c.casl);
  const show = (s: string) => scope === "All" || scope === s;
  return (
    <AppShell>
      <PageHeader icon={Search} title="Search Results" crumbs={[["Search"]]} />
      <div className={cn(panel, "p-[15px]")}>
        <div className="flex flex-wrap gap-2">
          <select value={scope} onChange={(e) => setScope(e.target.value)} className={cn(input, "w-[110px]")}>{["All", "Deals", "Contacts", "Leads"].map((o) => <option key={o}>{o}</option>)}</select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Keyway..." className={cn(input, "flex-1 min-w-[180px]")} />
          <button onClick={() => setAdvanced(!advanced)} className={cn(greyBtn, "px-3 text-[12.6px]")}>Advanced Search</button>
        </div>
        {advanced && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(Object.keys(adv) as (keyof typeof adv)[]).map((k) => (
              <label key={k}><span className={label}>{{ first: "First Name", last: "Last Name", email: "Email", phone: "Phone", loanCode: "Loan Code" }[k]}</span>
                <input value={adv[k]} onChange={(e) => setAdv({ ...adv, [k]: e.target.value })} className={input} />
              </label>
            ))}
          </div>
        )}
      </div>
      {show("Deals") && <Section title={`Deals (${deals.length})`}>
        <Grid head={["Loan Code", "Client", "Status", "Mortgage Amount", "Lender", "Closing Date", "Agent"]} rows={deals.map((d) => [
          <Link key="l" href={`/deal?loanCode=${d.loanCode}`} className="text-[#428bca] hover:underline">{d.loanCode}</Link>, d.client, d.status, money(d.amount), d.lender, fmt(d.closingDate), d.agent,
        ])} />
      </Section>}
      {show("Contacts") && <Section title={`Contacts (${contacts.length})`}>
        <Grid head={["First Name", "Last Name", "Email", "Cell Phone", "Address"]} rows={contacts.map((c) => [
          <Link key="f" href="/contacts" className="text-[#428bca] hover:underline">{c.firstName}</Link>, c.lastName, c.email ?? "", c.cellPhone ?? c.homePhone ?? "", c.address ?? "",
        ])} />
      </Section>}
      {show("Leads") && <Section title={`Leads (${leads.length})`}>
        <Grid head={["First Name", "Last Name", "Email", "Cell Phone"]} rows={leads.map((c) => [c.firstName, c.lastName, c.email ?? "", c.cellPhone ?? ""])} />
      </Section>}
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div className={cn(panel, "p-[15px]")}><h3 className="mb-2 text-lg font-light text-[#666]">{title}</h3>{children}</div>;
}
