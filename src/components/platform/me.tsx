"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, CircleUserRound, GitBranch, Settings, ShieldCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { placeholderWorkflows, type Workflow } from "./placeholder-data";

const useMe = () => useSession().data?.user ?? {};
import { AppShell } from "./shell";
import { blueBtn, greenBtn, greyBtn, Grid, input, label, Modal, PageHeader, panel, redBtn } from "./ui";

export function Box({ title, children, open: start = true }: { title: string; children: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(start);
  return (
    <section className={panel}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center border-b border-[#f4f4f4] px-[15px] py-2.5 text-left text-lg font-light text-[#666]">
        {title}<ChevronDown className={cn("ml-auto size-4 transition-transform", !open && "-rotate-90")} />
      </button>
      {/* Hidden, not unmounted: a collapsed box inside a form still posts its fields. */}
      <div className={cn("p-[15px] text-[12.6px]", !open && "hidden")}>{children}</div>
    </section>
  );
}

export function Check({ children, on = false }: { children: ReactNode; on?: boolean }) {
  const [v, setV] = useState(on);
  return <label className="flex items-center gap-2 py-1"><input type="checkbox" checked={v} onChange={(e) => setV(e.target.checked)} /> {children}</label>;
}

export function Field({ name, value = "", type = "text", wide }: { name: string; value?: string; type?: string; wide?: boolean }) {
  const [v, setV] = useState(value);
  return <label className={cn(wide && "sm:col-span-2")}><span className={label}>{name}</span><input type={type} value={v} onChange={(e) => setV(e.target.value)} className={input} /></label>;
}

export function Pick({ name, options, value }: { name: string; options: string[]; value?: string }) {
  const [v, setV] = useState(value ?? options[0]);
  return <label><span className={label}>{name}</span><select value={v} onChange={(e) => setV(e.target.value)} className={input}>{options.map((o) => <option key={o}>{o}</option>)}</select></label>;
}

export function People({ placeholderText, initial = [] }: { placeholderText: string; initial?: string[] }) {
  const [people, setPeople] = useState(initial);
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-[3px] border border-[#ccc] p-1">
      {people.map((p) => <span key={p} className="flex items-center gap-1 rounded bg-[#428bca] px-2 py-0.5 text-white">{p}<button onClick={() => setPeople(people.filter((x) => x !== p))} aria-label={`Remove ${p}`}>×</button></span>)}
      <select value="" onChange={(e) => e.target.value && setPeople([...people, e.target.value])} className="h-[24px] flex-1 text-[12.6px] text-[#999] outline-none" aria-label={placeholderText}>
        <option value="">{placeholderText}</option>
      </select>
    </div>
  );
}

export function SaveBar({ onSave }: { onSave: () => void }) {
  return <div className="mx-[25px] mb-5 flex justify-end"><button onClick={onSave} className={cn(greenBtn, "px-4 py-1.5 text-[12.6px]")}>Save</button></div>;
}

export function Saved({ show, close }: { show: boolean; close: () => void }) {
  return show ? <Modal title="Keyway" close={close} footer={<button onClick={close} className={cn(blueBtn, "px-4 py-1.5 text-[12.6px]")}>OK</button>}><p className="text-[12.6px]">Your changes have been saved.</p></Modal> : null;
}

const apps = [
  { name: "Google", desc: "Sync your Google calendar and contacts to Keyway." },
  { name: "Microsoft 365", desc: "Sync your Outlook calendar and email to Keyway." },
  { name: "OpenAI", desc: "Use OpenAI to draft notes and emails inside Keyway." },
  { name: "Gemini", desc: "Use Gemini to draft notes and emails inside Keyway." },
  { name: "Claude", desc: "Use Claude to draft notes and emails inside Keyway." },
  { name: "DocuSign", desc: "Connect your DocuSign account to send documents for eSignature." },
  { name: "Twilio", desc: "Automates your SMS. Add a phone number to start texting clients." },
];

export function AppUserSettings() {
  const me = useMe().name ?? "";
  const [connected, setConnected] = useState<string[]>(["Google"]);
  const [saved, setSaved] = useState(false);
  const [mail, setMail] = useState("Gmail");
  return (
    <AppShell>
      <PageHeader icon={Settings} title="User Settings" crumbs={[["User"], ["User Settings"]]} />
      <Box title="Connect Your Apps">
        <p className="mb-3 text-[#999]">Making life easier. Connect with our partnered apps below.</p>
        <div className="mb-4 rounded-[3px] border border-[#ddd] p-3">
          <p className="mb-2 font-semibold">Connect Your Email <span className="rounded bg-[#f0ad4e] px-1 text-[10px] text-white">Beta</span></p>
          <div className="flex flex-wrap gap-3">{["Gmail", "Outlook", "Custom"].map((m) => <label key={m} className="flex items-center gap-1"><input type="radio" checked={mail === m} onChange={() => setMail(m)} /> {m}</label>)}</div>
          {mail === "Custom" && <div className="mt-2 grid gap-2 sm:grid-cols-3"><Field name="IMAP Server" /><Field name="Port" value="993" /><Field name="Username" /></div>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((a) => {
            const on = connected.includes(a.name);
            return (
              <div key={a.name} className="rounded-[3px] border border-[#ddd] p-3">
                <p className="flex items-center font-semibold">{a.name}<span className={cn("ml-auto text-[11px]", on ? "text-[#3c763d]" : "text-[#999]")}>{on ? "Connected" : "Not Connected"}</span></p>
                <p className="my-2 text-[#777]">{a.desc}</p>
                <button onClick={() => setConnected(on ? connected.filter((c) => c !== a.name) : [...connected, a.name])} className={cn(on ? redBtn : blueBtn, "px-3 py-1")}>{on ? "Disconnect" : "Connect"}</button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[3px] border border-[#ddd] p-3"><p className="font-semibold">Keyway API</p><p className="my-2 text-[#777]">Connect your online application to Keyway. No active keys.</p><button className={cn(greyBtn, "px-3 py-1")}>Request API Key</button></div>
          <div className="rounded-[3px] border border-[#ddd] p-3"><p className="font-semibold">Webhooks</p><p className="my-2 text-[#777]">Real-time notifications for third-party connectors. No active webhooks.</p><button className={cn(greyBtn, "px-3 py-1")}>Request Webhook</button></div>
          <div className="rounded-[3px] border border-[#ddd] p-3"><p className="font-semibold">Gravity Forms</p><p className="my-2 text-[#777]">Add Gravity Forms submissions to Keyway with our add-on.</p><button className={cn(greyBtn, "px-3 py-1")}>Download</button></div>
        </div>
      </Box>
      <Box title="Purchased Products">
        <Grid head={["Category", "Total", "Used", "Left"]} rows={[["eSign Credits", "50", "12", "38"], ["Property Validation", "20", "4", "16"], ["NOA Credits", "10", "1", "9"]]} />
      </Box>
      <Box title="eSign Options">
        <div className="grid gap-3 sm:grid-cols-2"><Pick name="Provider" options={["DocuSign", "Keyway eSign"]} /><div><span className={label}>Authorized users to use my credits</span><People placeholderText="Click to add users" /></div></div>
      </Box>
      <Box title="General Options">
        <div className="grid gap-3 sm:grid-cols-2">
          <Pick name="Days before parked deals are moved to historical" options={["30", "60", "90", "Never"]} value="90" />
          <Pick name="Default search" options={["All", "Deals", "Contacts", "Leads"]} />
        </div>
        <p className="mt-3 font-semibold">Notifications</p>
        <Check on>Notify me by email when a client replies by SMS</Check>
        <Check on>Post SMS replies to the Message Centre</Check>
      </Box>
      <Box title="Calendar Options">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><span className={label}>These people can view my calendar</span><People placeholderText="Click to add people" /></div>
          <div><span className={label}>These people can add/edit my calendar</span><People placeholderText="Click to add people" /></div>
        </div>
        <p className="mt-3 font-semibold">Add to your calendar</p>
        <div className="grid sm:grid-cols-3">{["Pre-Approvals", "Birthdays", "Anniversaries", "Maturities", "Closing Dates", "Subject Removal Dates", "Pre-Approval Rate Expiries"].map((c) => <Check key={c} on>{c}</Check>)}</div>
      </Box>
      <Box title="Email Options">
        <Field name="Tag address (BCC to file emails to deals)" />
        <label className="mt-3 block"><span className={label}>Signature</span><textarea rows={4} defaultValue={`${me}\nMortgage Agent`} className={cn(input, "h-auto py-1")} /></label>
        <p className="mt-1 text-[#999]">Please use PNG images for signatures.</p>
      </Box>
      <Box title="Conditions" open={false}>
        <Check on>Smart Conditions: automatically add conditions using Smart Filters</Check>
        <Check>Default conditions as required</Check>
        <Check on>Default Customer/External notes</Check>
        <p className="mt-3 font-semibold">Notifications</p>
        <Check on>Post to Message Centre when a document is uploaded</Check>
        <Check>Send an email when a document is uploaded</Check>
        <Check on>Post to Message Centre when a condition is assigned to you</Check>
        <Check>Send an email when a condition is assigned to you</Check>
      </Box>
      <Box title="Deals Dashboard" open={false}>
        <Pick name="Default dashboard view" options={["Card View", "List View"]} />
        <p className="mt-3 font-semibold">Show these statuses</p>
        <div className="grid sm:grid-cols-3">{["Leads", "New Deals", "Submitted", "Approved", "Accepted", "Waiting To Close", "Funded / Awaiting Payment", "Declined", "Cancelled"].map((s) => <Check key={s} on={!["Declined", "Cancelled"].includes(s)}>{s}</Check>)}</div>
      </Box>
      <Box title="Deals" open={false}>
        <Check on>Post to Message Centre when a deal status changes</Check>
        <Check>Send an email when a deal is complete</Check>
        <Check>Send an email when a deal status changes</Check>
        <Check>Allow submitting to External CRM</Check>
        <div className="mt-3 grid gap-3 sm:grid-cols-3"><Pick name="Deal style" options={["Classic View", "Modern View"]} /><Pick name="Deal order" options={["Closing Date", "Entry Date", "Last Name"]} /><Pick name="New application order" options={["Newest First", "Oldest First"]} /></div>
        <Check on>Auto-expand deal sections</Check>
      </Box>
      <SaveBar onSave={() => setSaved(true)} />
      <Saved show={saved} close={() => setSaved(false)} />
    </AppShell>
  );
}

export function AppUserProfile() {
  const { name = "", email = "" } = useMe();
  const [first, ...rest] = (name ?? "").split(" ");
  const [saved, setSaved] = useState(false);
  const [theme, setTheme] = useState("Default");
  const [templates, setTemplates] = useState(["Purchase - Standard"]);
  const [newTpl, setNewTpl] = useState("");
  const [lang, setLang] = useState<"English" | "Français">("English");
  const [copied, setCopied] = useState(false);
  const url = ""; // ponytail: no public profile page yet
  return (
    <AppShell>
      <PageHeader icon={CircleUserRound} title="User Profile" crumbs={[["User"], ["User Profile"]]} />
      <Box title="Details">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field name="First Name" value={first} /><Field name="Last Name" value={rest.join(" ")} /><Field name="Email" type="email" value={email ?? ""} />
          <Field name="Website" /><Field name="Home Phone" /><Field name="Cell Phone" />
          <Field name="Business Phone" /><Field name="Fax Number" /><Field name="Company Name" />
          <Field name="Job Title" value="Mortgage Agent" /><Field name="License Number" /><Pick name="Language" options={["English", "Français"]} />
        </div>
      </Box>
      <Box title="Address">
        <div className="grid gap-3 sm:grid-cols-2"><Field name="Address Line 1" /><Field name="Address Line 2" /><Field name="City" /><Pick name="Province" options={["ON", "BC", "AB", "QC", "MB", "SK", "NS", "NB", "NL", "PE"]} /><Field name="Postal Code" /></div>
      </Box>
      <Box title="Keyway CRM Profile">
        <div className="mb-3 flex items-center gap-3"><CircleUserRound className="size-14 text-[#ccc]" /><button className={cn(blueBtn, "px-3 py-1")}>Upload</button><button className={cn(greyBtn, "px-3 py-1")}>Remove</button><span className="text-[#999]">For best results use a square image at least 200×200px.</span></div>
        <div className="grid gap-3 sm:grid-cols-3">{["Facebook", "LinkedIn", "Twitter", "Instagram", "YouTube", "Mobile App URL"].map((s) => <Field key={s} name={s} />)}</div>
      </Box>
      <Box title="Client Experience Settings">
        <p className="mb-3 text-[#999]">Set up some defaults for your Client Experience.</p>
        <span className={label}>Theme</span>
        <div className="mb-3 flex flex-wrap gap-2">{["Default", "DLC", "MCC", "MA", "Brokerage"].map((t) => <button key={t} onClick={() => setTheme(t)} className={cn("h-16 w-24 rounded-[3px] border-2 text-xs", theme === t ? "border-[#428bca]" : "border-[#ddd]")}>{t}</button>)}</div>
        <div className="mb-3 flex items-center gap-2"><span className={label}>Logo</span><button className={cn(blueBtn, "px-3 py-1")}>Upload</button><button className={cn(greyBtn, "px-3 py-1")}>Remove</button></div>
        <Check on>Smart Rules: auto-request documents</Check>
        <Check on>EZ Account Access: clients sign in with a one-time code</Check>
        <Check>Referral section</Check>
        <Check>Life insurance section</Check>
        <div className="mt-3 flex flex-wrap items-center gap-2"><span className="font-semibold">Your URL:</span><code className="rounded bg-[#f5f5f5] px-2 py-1">{url || "Not set up yet"}</code><button disabled={!url} onClick={() => { void navigator.clipboard?.writeText(url); setCopied(true); }} className={cn(greyBtn, "px-2 py-1")}>{copied ? "Copied!" : "Copy"}</button></div>
      </Box>
      <Box title="Client Experience Templates">
        {templates.length ? <ul className="mb-3 list-disc pl-5">{templates.map((t) => <li key={t}>{t} <button onClick={() => setTemplates(templates.filter((x) => x !== t))} className="ml-2 text-[#d9534f]">Remove</button></li>)}</ul> : <p className="mb-3 text-[#999]">No templates. Not to worry, add a template below.</p>}
        <div className="flex gap-2"><input value={newTpl} onChange={(e) => setNewTpl(e.target.value)} placeholder="Enter template name" className={input} /><button onClick={() => { if (newTpl.trim()) { setTemplates([...templates, newTpl.trim()]); setNewTpl(""); } }} className={cn(greenBtn, "shrink-0 px-3")}>Add a Template</button></div>
        <div className="mt-3 flex gap-3">{(["English", "Français"] as const).map((l) => <label key={l} className="flex items-center gap-1"><input type="radio" checked={lang === l} onChange={() => setLang(l)} /> {l}</label>)}</div>
        <div className="mt-2 grid gap-3"><Field name="Email Subject Line" /><label><span className={label}>Email Body Content</span><textarea rows={4} className={cn(input, "h-auto py-1")} /></label></div>
      </Box>
      <Box title="Conditions & Documents" open={false}>
        <Check on>Smart Rules: automatically add conditions based on deal details</Check>
        <p className="mt-2 text-[#999]">Create groups of conditions together, then add them to deals in one click.</p>
        <div className="mt-2 flex gap-2"><input placeholder="Enter the name of the condition group" className={input} /><button className={cn(blueBtn, "shrink-0 px-3")}>Add Group</button></div>
        <div className="mt-2 flex gap-2"><input placeholder="Enter the name of the condition" className={input} /><button className={cn(blueBtn, "shrink-0 px-3")}>Add Custom Condition</button></div>
      </Box>
      <Box title="MPP Defaults" open={false}><label><span className={label}>Client/External Notes</span><textarea rows={3} className={cn(input, "h-auto py-1")} /></label></Box>
      <SaveBar onSave={() => setSaved(true)} />
      <Saved show={saved} close={() => setSaved(false)} />
    </AppShell>
  );
}

const termTypes = ["General Conditions", "Transferability", "Special Conditions", "Additional Comments", "Prepayment Privileges", "Method of Payment", "Particulars of Penalties", "Optional Services"];
type Term = { id: number; type: string; name: string; content: string; active: boolean; isDefault: boolean };

export function AppComplianceSettings() {
  const [terms, setTerms] = useState<Term[]>([
    { id: 1, type: "Prepayment Privileges", name: "Standard 20/20", content: "Prepay up to 20% of the original principal each year…", active: true, isDefault: true },
    { id: 2, type: "Method of Payment", name: "Pre-authorized debit", content: "Payments are withdrawn from the borrower's account…", active: true, isDefault: false },
  ]);
  const [filter, setFilter] = useState("All Template Types");
  const [edit, setEdit] = useState<Term | null>(null);
  const [saved, setSaved] = useState(false);
  const rows = terms.filter((t) => filter === "All Template Types" || t.type === filter);
  const upsert = (t: Term) => { setTerms(terms.some((x) => x.id === t.id) ? terms.map((x) => (x.id === t.id ? t : x)) : [...terms, t]); setEdit(null); };
  return (
    <AppShell>
      <PageHeader icon={ShieldCheck} title="Compliance" crumbs={[["Compliance Settings"]]} />
      <Box title="Compliance Settings">
        <div className="grid gap-3 sm:grid-cols-2">
          <Pick name="The agent represents" options={["-- Select --", "The borrower, not the lender", "The lender, not the borrower", "The lender and the borrower"]} />
          <Pick name="Number of lenders the brokerage dealt with last year" options={["-- Select --", "1", "2-5", "6-10", "More than 10"]} />
        </div>
        <Check>The agent acted as a lender</Check>
        <Check>The agent was a lender in the last fiscal year</Check>
        <Check>The brokerage has a favoured lender</Check>
      </Box>
      <Box title="Terms and Conditions">
        <div className="mb-2 flex flex-wrap gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={cn(input, "w-[220px]")}>{["All Template Types", ...termTypes].map((o) => <option key={o}>{o}</option>)}</select>
          <button onClick={() => setEdit({ id: Date.now(), type: termTypes[0], name: "", content: "", active: true, isDefault: false })} className={cn(greenBtn, "ml-auto px-3 py-1")}>Create Template</button>
        </div>
        <Grid empty="No templates" head={["Default", "Active", "Type", "Name", "Content", "Status", "Actions"]} rows={rows.map((t) => [
          <input key="d" type="radio" checked={t.isDefault} aria-label="Default" onChange={() => setTerms(terms.map((x) => (x.type === t.type ? { ...x, isDefault: x.id === t.id } : x)))} />,
          t.active ? "Yes" : "No", t.type, t.name, <span key="c" className="line-clamp-1">{t.content}</span>, t.active ? "Active" : "Inactive",
          <span key="a" className="flex flex-wrap gap-1">
            <button onClick={() => setEdit(t)} className={cn(blueBtn, "px-2 py-0.5 text-xs")}>Edit/View</button>
            <button onClick={() => setTerms([...terms, { ...t, id: Date.now(), name: t.name + " (copy)", isDefault: false }])} className={cn(greyBtn, "px-2 py-0.5 text-xs")}>Duplicate</button>
            <button onClick={() => setTerms(terms.map((x) => (x.id === t.id ? { ...x, active: !x.active } : x)))} className={cn(greyBtn, "px-2 py-0.5 text-xs")}>{t.active ? "Deactivate" : "Activate"}</button>
            <button onClick={() => setTerms(terms.filter((x) => x.id !== t.id))} className={cn(redBtn, "px-2 py-0.5 text-xs")}>Delete</button>
          </span>,
        ])} />
      </Box>
      <Box title="Fees">
        <div className="grid gap-3 sm:grid-cols-2"><Field name="Recipient Name" /><Field name="Email" type="email" /><Field name="Work Phone" /><Field name="Fax" /></div>
      </Box>
      <SaveBar onSave={() => setSaved(true)} />
      <Saved show={saved} close={() => setSaved(false)} />
      {edit && <TermModal term={edit} close={() => setEdit(null)} save={upsert} />}
    </AppShell>
  );
}

function TermModal({ term, close, save }: { term: Term; close: () => void; save: (t: Term) => void }) {
  const [t, setT] = useState(term);
  const [err, setErr] = useState(false);
  return (
    <Modal title="Create a Template" close={close} footer={<>
      <button onClick={() => (t.name.trim() ? save(t) : setErr(true))} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px]")}>Save</button>
      <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
    </>}>
      <div className="grid gap-3 text-[12.6px]">
        <label><span className={label}>Type</span><select value={t.type} onChange={(e) => setT({ ...t, type: e.target.value })} className={input}>{termTypes.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label><span className={label}>Name</span><input value={t.name} onChange={(e) => { setT({ ...t, name: e.target.value }); setErr(false); }} className={cn(input, err && "border-[#d9534f]")} /></label>
        <label><span className={label}>Content</span><textarea rows={6} value={t.content} onChange={(e) => setT({ ...t, content: e.target.value })} className={cn(input, "h-auto py-1")} /></label>
        <div className="flex gap-3">{[true, false].map((a) => <label key={String(a)} className="flex items-center gap-1"><input type="radio" checked={t.active === a} onChange={() => setT({ ...t, active: a })} /> {a ? "Active" : "Inactive"}</label>)}</div>
        {err && <p className="text-[#a94442]">Name is required.</p>}
      </div>
    </Modal>
  );
}

export function AppWorkflows() {
  const me = useMe().name ?? "";
  const [flows, setFlows] = useState(placeholderWorkflows);
  const [stages, setStages] = useState(["New Deal", "Approved", "Funded"]);
  const [show, setShow] = useState<"Active" | "Inactive" | "All">("Active");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"stage" | Workflow | null>(null);
  const q = search.toLowerCase();
  const visible = flows.filter((f) => (show === "All" || f.active === (show === "Active")) && (!q || f.title.toLowerCase().includes(q)));
  const groups = [...stages, ""].map((s) => ({ stage: s, rows: visible.filter((f) => f.stage === s) }));
  return (
    <AppShell>
      <PageHeader icon={GitBranch} title="Workflows" crumbs={[["Workflows"]]} />
      <div className={panel}>
        <div className="flex flex-wrap items-center gap-2 px-[15px] py-2.5 text-[12.6px]">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workflows..." className={cn(input, "h-[34px] w-[220px]")} />
          <label className="flex items-center gap-1">Show:
            <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} className={cn(input, "w-[100px]")}>{["Active", "Inactive", "All"].map((o) => <option key={o}>{o}</option>)}</select>
          </label>
          <button onClick={() => setModal("stage")} className={cn(greyBtn, "ml-auto px-3 py-1")}>Add Stage</button>
          <button onClick={() => setModal({ id: Date.now(), stage: "", title: "", assignee: me, time: "Immediately", trigger: "Deal Status: New", action: "Send Email", active: true, createdBy: me, for: "User" })} className={cn(greenBtn, "px-3 py-1")}>Add Workflow</button>
        </div>
        <div className="space-y-4 p-[15px] pt-0">
          {groups.map((g) => (
            <div key={g.stage || "none"}>
              <h3 className="mb-1 font-semibold text-[#666]">{g.stage || "Not Staged"}</h3>
              {!g.stage && <p className="mb-1 text-xs text-[#999]">These workflows have not been assigned to a stage.</p>}
              <Grid min={900} head={["Title", "Assignee", "Time From Trigger", "Trigger", "Action", "Status", "Created By", "For"]} rows={g.rows.map((f) => [
                <button key="t" onClick={() => setModal(f)} className="text-left text-[#428bca] hover:underline">{f.title}</button>,
                f.assignee, f.time, f.trigger, f.action,
                <button key="s" onClick={() => setFlows(flows.map((x) => (x.id === f.id ? { ...x, active: !x.active } : x)))} className={cn("rounded px-1.5 py-0.5 text-[11px] text-white", f.active ? "bg-[#5cb85c]" : "bg-[#999]")}>{f.active ? "Active" : "Inactive"}</button>,
                f.createdBy, f.for,
              ])} />
            </div>
          ))}
        </div>
      </div>
      {modal === "stage" && <StageModal close={() => setModal(null)} add={(s) => { setStages([...stages, s]); setModal(null); }} />}
      {modal && modal !== "stage" && <WorkflowModal flow={modal} stages={stages} close={() => setModal(null)} save={(f) => { setFlows(flows.some((x) => x.id === f.id) ? flows.map((x) => (x.id === f.id ? f : x)) : [...flows, f]); setModal(null); }} />}
    </AppShell>
  );
}

function StageModal({ close, add }: { close: () => void; add: (s: string) => void }) {
  const [name, setName] = useState("");
  return (
    <Modal title="Add Stage" close={close} footer={<>
      <button onClick={() => name.trim() && add(name.trim())} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px]")}>Add</button>
      <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
    </>}>
      <label><span className={label}>Stage Name</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
    </Modal>
  );
}

function WorkflowModal({ flow, stages, close, save }: { flow: Workflow; stages: string[]; close: () => void; save: (f: Workflow) => void }) {
  const [f, setF] = useState(flow);
  const [err, setErr] = useState(false);
  const sel = (k: keyof Workflow, name: string, options: string[]) => (
    <label><span className={label}>{name}</span><select value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={input}>{options.map((o) => <option key={o} value={o}>{o || "Not Staged"}</option>)}</select></label>
  );
  return (
    <Modal title={flow.title ? "Edit Workflow" : "Add Workflow"} close={close} footer={<>
      <button onClick={() => (f.title.trim() ? save(f) : setErr(true))} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px]")}>Save</button>
      <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
    </>}>
      <div className="grid gap-3 text-[12.6px] sm:grid-cols-2">
        <label className="sm:col-span-2"><span className={label}>Title</span><input value={f.title} onChange={(e) => { setF({ ...f, title: e.target.value }); setErr(false); }} className={cn(input, err && "border-[#d9534f]")} /></label>
        {sel("stage", "Stage", ["", ...stages])}
        {sel("assignee", "Assignee", [flow.assignee])}
        {sel("trigger", "Trigger", ["Deal Status: New", "Deal Status: Submitted", "Deal Status: Approved", "Deal Status: Funded", "Contact Birthday", "Mortgage Maturity", "Condition Uploaded"])}
        {sel("time", "Time From Trigger", ["Immediately", "1 day after", "3 days after", "7 days after", "30 days before", "On date"])}
        {sel("action", "Action", ["Send Email", "Send SMS", "Create Task", "Create Reminder", "Post to Message Centre"])}
        {sel("for", "For", ["User", "Team", "Office", "Organization"])}
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active</label>
      </div>
      {err && <p className="mt-2 text-[12.6px] text-[#a94442]">Title is required.</p>}
    </Modal>
  );
}
