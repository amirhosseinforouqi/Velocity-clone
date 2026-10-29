"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import {
  ArrowDownAZ, BookUser, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, GitMerge, Search, Undo2, User, UserPlus, Wand2, Wrench, X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { archiveContactAction, saveContactAction, setCaslAction } from "@/app/contacts/actions";
import { quickApplicationAction } from "@/app/deal/actions";
import { placeholder, placeholderDuplicates, type Contact } from "./placeholder-data";
import { AppShell } from "./shell";
import { SectionBox } from "./deal";
import { blueBtn, greenBtn, input, PageHeader, td, th, ToggleColumns } from "./ui";

// First and last name are always shown, as in Velocity.
const columns = [
  ["homePhone", "Home Phone"], ["cellPhone", "Cell Phone"], ["workPhone", "Work Phone"], ["email", "Email"],
  ["address", "Current Address"], ["previousOne", "Previous Address 1"], ["previousTwo", "Previous Address 2"],
] as const;
type Col = (typeof columns)[number][0];

function NoResults({ clear }: { clear: () => void }) {
  return (
    <div className="py-10 text-center text-[#666]">
      <Search className="mx-auto mb-2 size-10 text-[#ccc]" />
      <h2 className="text-2xl font-light">No contacts found</h2>
      <p>Sorry, your search returned no contacts.</p>
      <p>Please <button onClick={clear} className="text-[#428bca] hover:underline">clear your search</button> and try again.</p>
    </div>
  );
}

export function AppContacts({ contacts }: { contacts: Contact[] }) {
  const [pending, startTransition] = useTransition();
  // Server actions revalidate /contacts, so the new rows arrive as fresh props.
  const [error, setError] = useState("");
  const saveCasl = (ids: Contact["id"][], v: boolean) => startTransition(async () => setError((await setCaslAction(ids.map(String), v)).error ?? ""));
  const [casl, setCasl] = useState("Any");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState<string[]>(columns.map((c) => c[0]));
  const [sort, setSort] = useState<{ key: "firstName" | "lastName"; desc: boolean }>({ key: "lastName", desc: false });
  const [open, setOpen] = useState<Contact["id"][]>([]);
  const [confirm, setConfirm] = useState<boolean | null>(null);

  const q = search.toLowerCase();
  const rows = contacts
    .filter((c) => casl === "Any" || c.casl === (casl === "OptIn"))
    .filter((c) => !q || Object.values(c).some((v) => typeof v === "string" && v.toLowerCase().includes(q)))
    .toSorted((a, b) => a[sort.key].localeCompare(b[sort.key]) * (sort.desc ? -1 : 1));
  const cols = columns.filter(([k]) => shown.includes(k));
  const sorter = (key: "firstName" | "lastName", label: string) => (
    <th className={th}>
      <button onClick={() => setSort({ key, desc: sort.key === key && !sort.desc })} className="flex items-center gap-1">
        <ArrowDownAZ className={cn("size-3.5", sort.key === key && sort.desc && "rotate-180")} /> {label}
      </button>
    </th>
  );
  const cells = (c: Contact) =>
    cols.map(([k]) => <td key={k} className={td}>{c[k as Col] ?? "-"}</td>);

  return (
    <AppShell>
      <PageHeader icon={BookUser} title="Contacts" crumbs={[["Contacts"]]} />
      <div className="mx-[25px] mb-5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.1)]">
        <div className="flex flex-wrap items-center gap-3 px-[15px] py-2.5 text-[12.6px]">
          <label className="flex items-center gap-2 font-semibold text-[#666]">
            CASL Status:
            <select value={casl} onChange={(e) => setCasl(e.target.value)} className="h-[30px] rounded-[3px] border border-[#ccc] px-2 font-normal">
              <option value="Any">Any</option>
              <option value="OptIn">Opted In</option>
              <option value="OptOut">Opted Out</option>
            </select>
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            <div className="relative">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your Contacts..." className={cn(input, "h-[34px] w-[240px] pr-7")} />
              {search && <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 text-[#999]"><X className="size-3.5" /></button>}
            </div>
            <ToggleColumns shown={shown} setShown={setShown} fixed={["First Name", "Last Name"]} options={columns} />
          </div>
        </div>
        {confirm !== null && (
          <div className="flex flex-wrap items-center gap-3 border-y border-[#ddd] bg-[#f9f9f9] px-[15px] py-2.5 text-[12.6px]">
            <p><strong className="text-[#428bca]">Are you sure?</strong> You are about to {confirm ? "OptIn" : "OptOut"} ALL Contacts</p>
            <button disabled={pending} onClick={() => { saveCasl(contacts.map((c) => c.id), confirm); setConfirm(null); }} className={cn(blueBtn, "flex items-center gap-1 px-3 py-1.5")}>
              <CheckCircle className="size-3.5" /> Confirm
            </button>
            <button onClick={() => setConfirm(null)} className="flex items-center gap-1 rounded-[3px] border border-[#cf4f4c] bg-gradient-to-b from-[#d9534f] to-[#cf4f4c] px-3 py-1.5 text-white">
              <Undo2 className="size-3.5" /> Cancel
            </button>
          </div>
        )}
        {error && <p role="alert" className="mx-[15px] mb-2.5 rounded-[3px] bg-[#f2dede] px-3 py-2 text-[12.6px] text-[#a94442]">{error}</p>}
        <div className="overflow-x-auto p-[15px] pt-0">
          {rows.length ? (
            <table className="w-full min-w-[900px] text-[12.6px]">
              <thead className="bg-black/60 text-white">
                <tr>
                  <th className={cn(th, "w-8")} />
                  <th className={cn(th, "w-24")}>
                    <details className="relative">
                      <summary className="flex cursor-pointer list-none items-center gap-1 font-bold [&::-webkit-details-marker]:hidden">CASL Opt In <ChevronDown className="size-3" /></summary>
                      <ul className="absolute z-20 mt-1 w-48 rounded-[3px] border border-[#ddd] bg-white py-1 font-normal text-[#333] shadow-lg">
                        <li><button onClick={() => setConfirm(true)} className="w-full px-3 py-1 text-left hover:bg-[#f5f5f5]"><strong>Opt in</strong> all contacts</button></li>
                        <li><button onClick={() => setConfirm(false)} className="w-full px-3 py-1 text-left hover:bg-[#f5f5f5]"><strong>Opt out</strong> all contacts</button></li>
                      </ul>
                    </details>
                  </th>
                  {sorter("firstName", "First Name")}
                  {sorter("lastName", "Last Name")}
                  {cols.map(([k, l]) => <th key={k} className={th}>{l}</th>)}
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <ContactRows key={c.id} c={c} open={open.includes(c.id)} toggle={() => setOpen(open.includes(c.id) ? open.filter((o) => o !== c.id) : [...open, c.id])}
                    setCasl={(v) => saveCasl([c.id], v)} disabled={pending} cells={cells} />
                ))}
              </tbody>
            </table>
          ) : (
            <NoResults clear={() => { setSearch(""); setCasl("Any"); }} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ContactRows({ c, open, toggle, setCasl, disabled, cells }: { c: Contact; open: boolean; toggle: () => void; setCasl: (v: boolean) => void; disabled: boolean; cells: (c: Contact) => ReactNode }) {
  return (
    <>
      <tr className="odd:bg-white even:bg-[#fafafa] hover:bg-[#f5f5f5]">
        <td className={td}>
          {c.merged && (
            <button onClick={toggle} aria-label="Show merged contacts" className="text-[#428bca]">
              <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
            </button>
          )}
        </td>
        <td className={td}><input type="checkbox" checked={c.casl} disabled={disabled} onChange={(e) => setCasl(e.target.checked)} aria-label={`CASL opt in for ${c.firstName} ${c.lastName}`} /></td>
        <td className={td}>{c.firstName}</td>
        <td className={td}>{c.lastName}</td>
        {cells(c)}
        <td className={td}>
          <Link href={`/contacts/${c.id}`} aria-label={`Open ${c.firstName} ${c.lastName}`} className={cn(blueBtn, "inline-flex px-2 py-1")}><ExternalLink className="size-3.5" /></Link>
        </td>
      </tr>
      {open && c.merged?.map((m) => (
        <tr key={m.id} className="bg-[#eef5fb] text-[#666]">
          <td className={td} /><td className={td} />
          <td className={td}>{m.firstName}</td>
          <td className={td}>{m.lastName}</td>
          {cells(m)}
          <td className={td} />
        </tr>
      ))}
    </>
  );
}

const activities = [
  { key: "Email", add: "Add Email Notes:", prev: "Notes from Previous Email" },
  { key: "SMS", add: "", prev: "SMS Message History" },
  { key: "Phone Call", add: "Add Phone Call Notes:", prev: "Notes from Previous Phone Calls:" },
  { key: "Appointment", add: "Add Appointment Notes:", prev: "Notes from Previous Appointments:" },
  { key: "Other", add: "Add Other Notes:", prev: "Other Previous Notes:" },
];

function Activity({ name }: { name: string }) {
  const [tab, setTab] = useState(activities[0].key);
  const [notes, setNotes] = useState<Record<string, string[]>>({ Email: [`Sent rate summary to ${name}.`], "Phone Call": ["Discussed renewal options."] });
  const [draft, setDraft] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState(false);
  const a = activities.find((x) => x.key === tab)!;
  const add = () => {
    if (!due) return setError(true);
    setNotes({ ...notes, [tab]: [`${draft || "(no notes)"} — follow up ${due}`, ...(notes[tab] ?? [])] });
    setDraft("");
    setDue("");
    setError(false);
  };
  return (
    <div className="text-[12.6px]">
      <h4 className="mb-2 text-[15px] font-semibold text-[#444]">Activity</h4>
      <div className="mb-3 flex flex-wrap border-b border-[#ddd]">
        {activities.map((x) => (
          <button key={x.key} onClick={() => setTab(x.key)} className={cn("-mb-px border px-3 py-1.5", tab === x.key ? "border-[#ddd] border-b-white bg-white text-[#555]" : "border-transparent text-[#428bca]")}>
            {x.key}
          </button>
        ))}
      </div>
      {a.add ? (
        <>
          <label className="mb-1 block font-semibold text-[#666]">{a.add}</label>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className={cn(input, "h-auto py-1")} />
          <div className="mt-2 flex items-end gap-2">
            <label className="flex-1">
              <span className="mb-1 block font-semibold text-[#666]">Follow Up Reminder:</span>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} />
            </label>
            <button onClick={add} className={cn(blueBtn, "h-[30px] px-4")}>Add</button>
          </div>
          {error && <p className="mt-1 text-[#a94442]">Follow Up Reminder date is required.</p>}
        </>
      ) : (
        <div className="rounded-[3px] border border-[#faebcc] bg-[#fcf8e3] p-2.5 text-[#8a6d3b]">
          To send SMS messages please <strong>configure an app</strong> in your settings.
        </div>
      )}
      <h5 className="mt-4 mb-1 font-semibold text-[#666]">{a.prev}</h5>
      <ul className="space-y-1">
        {(notes[tab] ?? []).map((n, i) => <li key={i} className="rounded-[3px] bg-[#f5f5f5] px-2 py-1.5">{n}</li>)}
        {!notes[tab]?.length && <li className="text-[#999]">-</li>}
      </ul>
    </div>
  );
}

function Campaigns() {
  const groups = ["Contact Campaigns", "Property Campaigns", "Deal Campaigns", "Stay in Touch Campaigns"];
  const [on, setOn] = useState<string[]>(["Contact Campaigns", "Stay in Touch Campaigns"]);
  return (
    <div className="grid gap-4 text-[12.6px] sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g}>
          <label className="mb-2 flex items-center gap-2">
            <button role="switch" aria-checked={on.includes(g)} onClick={() => setOn(on.includes(g) ? on.filter((x) => x !== g) : [...on, g])}
              className={cn("relative h-5 w-9 rounded-full transition-colors", on.includes(g) ? "bg-[#5cb85c]" : "bg-[#ccc]")}>
              <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform", on.includes(g) && "translate-x-4")} />
            </button>
            <h6 className="font-semibold text-[#444]">{g}</h6>
          </label>
          <table className="w-full">
            <thead><tr>{["", "Campaign Name", "Date Created"].map((c) => <th key={c} className="border-b-2 border-[#ddd] p-2 text-left">{c}</th>)}</tr></thead>
            <tbody>
              {(g === "Property Campaigns" || g === "Deal Campaigns" ? [] : [g.replace(" Campaigns", "") + " Nurture"]).map((n) => (
                <tr key={n} className="odd:bg-[#f9f9f9]">
                  <td className="border-t border-[#ddd] p-2"><input type="checkbox" checked={on.includes(g)} readOnly /></td>
                  <td className="border-t border-[#ddd] p-2">{n}</td>
                  <td className="border-t border-[#ddd] p-2">Jan 15, 2026</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function AppContact({ contact: c }: { contact: Contact }) {
  const name = `${c.firstName} ${c.lastName}`;
  const dup = placeholderDuplicates.find((d) => d.name === name);
  const [state, save, saving] = useActionState(saveContactAction.bind(null, String(c.id)), null);
  const [archiveError, setArchiveError] = useState("");
  const router = useRouter();
  const quickApplication = async () => {
    const r = await quickApplicationAction(String(c.id));
    if (r.error) setArchiveError(r.error);
    else router.push(`/deal/${r.id}`);
  };
  const label = "mb-1 block text-[12.6px] font-semibold text-[#666]";
  // Fields with a `name` are saved to the database; the rest are layout only until their tables exist.
  const field = (l: string, v = "", type = "text", fieldName?: string) => (
    <label key={l}><span className={label}>{l}</span><input type={type} name={fieldName} defaultValue={v} className={input} /></label>
  );
  const select = (l: string, opts: string[], v = "") => (
    <label key={l}>
      <span className={label}>{l}</span>
      <select defaultValue={v} className={input}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
    </label>
  );
  const box = (title: string, cols: string[], rows: string[][], button?: string) => (
    <SectionBox key={title} title={title} open={false} groups={[{ cols, rows, buttons: button ? [button] : undefined }]} />
  );
  return (
    <AppShell>
      <PageHeader icon={User} title={name} crumbs={[["Contacts", "/contacts"], ["Contact Profile"]]}>
        <details className="relative">
          <summary className={cn(blueBtn, "flex cursor-pointer list-none items-center gap-1 px-[13px] py-1.5 text-[12.6px] [&::-webkit-details-marker]:hidden")}>
            Actions <ChevronDown className="size-3.5" />
          </summary>
          <ul className="absolute right-0 z-20 mt-1 w-44 rounded-[3px] border border-[#ddd] bg-white py-1 text-[12.6px] text-[#333] shadow-lg">
            <li><button onClick={quickApplication} className="block w-full px-4 py-1.5 text-left hover:bg-[#f5f5f5]">Quick Application</button></li>
            <li>
              <button
                onClick={async () => {
                  if (confirm(`Archive ${name}? The contact is hidden from lists but kept for the audit trail.`)) setArchiveError((await archiveContactAction(String(c.id)))?.error ?? "");
                }}
                className="block w-full px-4 py-1.5 text-left text-[#a94442] hover:bg-[#f5f5f5]"
              >
                Archive Contact
              </button>
            </li>
          </ul>
        </details>
      </PageHeader>
      {archiveError && <p role="alert" className="mx-[25px] mb-3 rounded-[3px] bg-[#f2dede] px-3 py-2 text-[12.6px] text-[#a94442]">{archiveError}</p>}
      <div className="mx-[25px]">
        <details open className="group mb-5 rounded-[2px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
          <summary className="flex cursor-pointer list-none items-center px-5 py-3 text-lg font-light text-[#444] [&::-webkit-details-marker]:hidden">
            Contact Details <ChevronDown className="ml-auto size-4 text-[#999] transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-[#f4f4f4] px-5 py-[15px]">
            {dup && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[3px] border border-[#faebcc] bg-[#fcf8e3] px-[15px] py-2.5 text-[12.6px] text-[#8a6d3b]">
                <span><strong>Duplicates found!</strong> Merge the duplicate contacts found by clicking here:</span>
                <Link href="/contacts/merge" className={cn(blueBtn, "px-3 py-1")}>Merge</Link>
              </div>
            )}
            <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
              <form action={save} className="grid content-start gap-3 sm:grid-cols-2">
                {select("Status:", ["Contact", "Lead"])}
                {select("Contact Preference:", ["-- Select --", "Home Phone", "Cell Phone", "Email", "Work Phone"], c.cellPhone ? "Cell Phone" : "Email")}
                {field("First Name:", c.firstName, "text", "firstName")}
                {field("Last Name:", c.lastName, "text", "lastName")}
                {field("Preferred Name:")}
                {field("Email:", c.email, "email", "email")}
                <label className="flex items-center gap-2 text-[12.6px] font-semibold text-[#666]"><input type="checkbox" name="casl" defaultChecked={c.casl} /> CASL Opt In:</label>
                <label className="flex items-center gap-2 text-[12.6px] font-semibold text-[#666]"><input type="checkbox" /> Opt out of ALL email notifications:</label>
                {field("Home Phone:", c.homePhone, "tel", "homePhone")}
                {field("Cell Phone:", c.cellPhone, "tel", "cellPhone")}
                {field("Work Phone:", c.workPhone, "tel", "workPhone")}
                {field("DOB:", "", "date")}
                {/* ponytail: SIN is not stored; it needs field-level encryption and a retention rule before it can be. */}
                {field("SIN:")}
                {select("Marital Status:", ["", "Common Law", "Divorced", "Married", "Separated", "Single", "Widowed"])}
                {select("Language:", ["English", "Français"])}
                {select("Agents:", [placeholder.userName])}
                <div className="sm:col-span-2">
                  <span className={label}>Social Media</span>
                  <div className="flex gap-2">{["Facebook", "LinkedIn", "X"].map((s) => <input key={s} placeholder={s} className={input} />)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <button disabled={saving} className={cn(greenBtn, "px-4 py-1.5 text-[12.6px] disabled:opacity-60")}>{saving ? "Saving…" : "Save Contact"}</button>
                  {state?.error && <span role="alert" className="text-[12.6px] text-[#a94442]">{state.error}</span>}
                  {state && !state.error && !saving && <span role="status" className="text-[12.6px] text-[#3c763d]">Saved.</span>}
                  <span className="text-[11px] text-[#999]">Saves name, email, phones and CASL. Other fields are not stored yet.</span>
                </div>
              </form>
              <Activity name={c.firstName} />
            </div>
          </div>
        </details>
        {/* Deals, properties, assets and employment come from their own tables in later build steps; empty until then. */}
        {box("Deals", ["Deal Status", "Loan Code", "Subject Property", "Application Purpose", "Mortgage Amount", "Term", "Rate", "Closing Date", "Maturity Date"],
          [])}
        {box("Properties", ["Occupancy", "Property Address", "Property Value", "Original Price", "Property Equity", "Original Date"],
          [], "Add Property")}
        {box("Assets", ["Type", "Asset Value", "Description"], [], "Add Asset")}
        {box("Addresses", ["Status", "Address", "Dwelling Status", "Time At"],
          c.address ? [["Current", c.address, "-", "-"]] : [], "Add Address")}
        {box("Employment", ["Status", "Company Name", "Job Title", "Annual Income", "Income Period"], [], "Add Employment")}
        {box("Referral Partners", ["First Name", "Last Name", "Referral Type", "Company Name", "Referred Deal(s)"], [], "Add Referral Partner")}
        {box("Related Contacts", ["First Name", "Last Name", "Email", "Relationship", "Shared Deal(s)"], [])}
        {box("Merge Sources", ["First Name", "Last Name", "Email", "Home Phone", "Cell Phone", "Work Phone"],
          (c.merged ?? []).map((m) => [m.firstName, m.lastName, m.email ?? "-", m.homePhone ?? "-", m.cellPhone ?? "-", m.workPhone ?? "-"]))}
        <details className="group mb-5 rounded-[2px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
          <summary className="flex cursor-pointer list-none items-center px-5 py-3 text-lg font-light text-[#444] [&::-webkit-details-marker]:hidden">
            Manage CRM Campaigns <ChevronDown className="ml-auto size-4 text-[#999] transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-[#f4f4f4] px-5 py-[15px]"><Campaigns /></div>
        </details>
      </div>
    </AppShell>
  );
}

const mergeCols = [["firstName", "First Name"], ["lastName", "Last Name"], ["cellPhone", "Cell Phone"], ["email", "Email"]] as const;

export function AppContactsMerge() {
  const [groups, setGroups] = useState(placeholderDuplicates);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<Contact["id"][]>([]);
  const [shown, setShown] = useState<string[]>(mergeCols.map((c) => c[0]));
  const [done, setDone] = useState("");
  const g = groups[Math.min(i, groups.length - 1)];
  const go = (n: number) => { setI(n); setPicked([]); };
  const merge = (auto: boolean) => {
    if (!auto && picked.length < 2) return setDone("Select at least two contacts to merge.");
    setDone(`${g.name}: ${auto ? g.rows.length : picked.length} contacts merged.`);
    setGroups(groups.filter((x) => x !== g));
    go(0);
  };
  const cols = mergeCols.filter(([k]) => shown.includes(k));
  const buttons = (
    <div className="flex flex-wrap gap-2 text-[12.6px]">
      <button onClick={() => merge(true)} className={cn(greenBtn, "flex items-center gap-1 px-3 py-1.5")}><Wand2 className="size-3.5" /> Auto Merge</button>
      <button onClick={() => merge(false)} className={cn(blueBtn, "flex items-center gap-1 px-3 py-1.5")}><Wrench className="size-3.5" /> Custom Merge</button>
      <Link href="/contacts" className={cn(blueBtn, "flex items-center gap-1 px-3 py-1.5")}><UserPlus className="size-3.5" /> Add</Link>
    </div>
  );
  const pager = (
    <ul className="flex gap-1">
      <li><button onClick={() => go(Math.max(0, i - 1))} disabled={i === 0} aria-label="Previous suggestion" className="rounded-[3px] border border-[#ccc] bg-white p-1.5 disabled:opacity-40"><ChevronLeft className="size-4" /></button></li>
      <li><button onClick={() => go(Math.min(groups.length - 1, i + 1))} disabled={i >= groups.length - 1} aria-label="Next suggestion" className="rounded-[3px] border border-[#ccc] bg-white p-1.5 disabled:opacity-40"><ChevronRight className="size-4" /></button></li>
    </ul>
  );
  return (
    <AppShell>
      <PageHeader icon={GitMerge} title="Merge Contacts" crumbs={[["Contacts", "/contacts"], ["Merge Duplicate Contacts"]]} />
      <div className="mx-[25px] mb-5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.1)]">
        {done && <div className="m-[15px] mb-0 rounded-[3px] border border-[#d6e9c6] bg-[#dff0d8] px-[15px] py-2.5 text-[12.6px] text-[#3c763d]">{done}</div>}
        {g ? (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-[#eee] px-[15px] py-2.5 text-[12.6px]">
              <p className="text-[#666]">Merge Suggestions <strong>{Math.min(i, groups.length - 1) + 1}</strong> of <strong>{groups.length}</strong></p>
              <div className="ml-auto flex items-center gap-2">
                <select value={g.name} onChange={(e) => go(groups.findIndex((x) => x.name === e.target.value))} className="h-[30px] rounded-[3px] border border-[#ccc] px-2">
                  {groups.map((x) => <option key={x.name}>{x.name}</option>)}
                </select>
                {pager}
              </div>
            </div>
            <div className="p-[15px]">
              <h2 className="mb-3 flex items-center gap-2 text-xl font-light text-[#444]"><User className="size-5" /> {g.name}</h2>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                {buttons}
                <ToggleColumns shown={shown} setShown={setShown} fixed={[]} options={mergeCols} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-[12.6px]">
                  <thead className="bg-black/60 text-white">
                    <tr>
                      <th className={cn(th, "w-10")}>
                        <input type="checkbox" aria-label="Select all" checked={picked.length === g.rows.length} onChange={(e) => setPicked(e.target.checked ? g.rows.map((r) => r.id) : [])} />
                      </th>
                      {cols.map(([k, l]) => <th key={k} className={th}>{l}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.id} className="odd:bg-white even:bg-[#fafafa]">
                        <td className={td}><input type="checkbox" checked={picked.includes(r.id)} onChange={() => setPicked(picked.includes(r.id) ? picked.filter((p) => p !== r.id) : [...picked, r.id])} /></td>
                        {cols.map(([k]) => <td key={k} className={td}>{r[k] ?? "-"}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">{buttons}{pager}</div>
            </div>
          </>
        ) : (
          <p className="p-10 text-center text-[#666]">No duplicate contacts found.</p>
        )}
      </div>
    </AppShell>
  );
}
