"use client";

import { useActionState, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { BookCheck, Building2, FileText, Network, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  deactivateUserAction, deleteConsentAction, deleteOfficeAction, patchUserAction, restoreUserAction, saveConditionAction, saveConsentAction,
  saveOfficeAction, saveOrganizationAction, saveUserAction, type ConsentInput,
} from "@/app/admin/actions";
import type { AdminUserRow } from "@/server/admin";
import { dealCode, statusLabel, type DealStatus } from "@/server/deal-status";
import { restoreDealAction } from "@/app/deal/actions";
import {
  consentKey, consentLangs, documentConsents, incomeFields, licences, officeChecks, officeSelects, onlineConsents, orgFeatures, roleLabels, userChecks,
} from "./admin-fields";
import { fieldKeys } from "./deal-sections";
import { Box, Saved } from "./me";
import { AppShell } from "./shell";
import { blueBtn, greenBtn, greyBtn, Grid, input, label, Modal, PageHeader, Pager, panel, redBtn } from "./ui";

const small = "px-2 py-0.5 text-xs";
type Result = { error?: string; id?: string };
type Role = keyof typeof roleLabels;
export type OfficeRow = { id: string; name: string; details: Record<string, string> };

export function Confirm({ title = "Just Checking...", text, yes = "Yes, I'm sure", close, ok }: { title?: string; text: ReactNode; yes?: string; close: () => void; ok: () => void }) {
  return (
    <Modal title={title} close={close} footer={<>
      <button onClick={() => { ok(); close(); }} className={cn(redBtn, "px-3 py-1.5 text-[12.6px]")}>{yes}</button>
      <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
    </>}><p className="text-[12.6px]">{text}</p></Modal>
  );
}

export function Search({ value, set, text = "Search:" }: { value: string; set: (s: string) => void; text?: string }) {
  return <label className="flex items-center gap-2 text-[12.6px]">{text}<input value={value} onChange={(e) => setValue(e, set)} className={cn(input, "w-[220px]")} /></label>;
}
const setValue = (e: { target: { value: string } }, set: (s: string) => void) => set(e.target.value);

export function GridPanel({ title, tools, children }: { title: string; tools?: ReactNode; children: ReactNode }) {
  return (
    <section className={panel}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#f4f4f4] px-[15px] py-2.5"><h3 className="text-lg font-light text-[#666]">{title}</h3><div className="ml-auto flex flex-wrap items-center gap-2">{tools}</div></div>
      <div className="p-[15px] text-[12.6px]">{children}</div>
    </section>
  );
}

const match = (q: string, ...xs: string[]) => !q || xs.some((x) => x.toLowerCase().includes(q.toLowerCase()));

// Named form inputs: the form posts them as they are, and the server keeps only whitelisted keys.
function F({ name, text = name, value = "", type = "text", ...rest }: { name: string; text?: string; value?: string; type?: string; required?: boolean; placeholder?: string; autoComplete?: string }) {
  return <label><span className={label}>{text}</span><input name={name} type={type} defaultValue={value} className={input} {...rest} /></label>;
}
function P({ name, text = name, options, value }: { name: string; text?: string; options: (string | [string, string])[]; value?: string }) {
  return (
    <label><span className={label}>{text}</span>
      <select name={name} defaultValue={value} className={input}>{options.map((o) => { const [v, t] = typeof o === "string" ? [o, o] : o; return <option key={v} value={v}>{t}</option>; })}</select>
    </label>
  );
}
function C({ name, on, className }: { name: string; on?: boolean; className?: string }) {
  return <label className={cn("flex items-center gap-2 py-1", className)}><input type="checkbox" name={name} value="Yes" defaultChecked={on} /> {name}</label>;
}

// A form posting to a server action: shows the error, or "saved", or opens the new record once created.
function useSave(action: (prev: Result | null, form: FormData) => Promise<Result>, created?: (id: string) => string) {
  const router = useRouter();
  const [ack, setAck] = useState<Result | null>(null);
  const [state, save, saving] = useActionState(async (prev: Result | null, form: FormData) => {
    const r = await action(prev, form);
    if (r.id && created) router.push(created(r.id));
    return r;
  }, null);
  // Submitted by hand, not via <form action>: React resets an action form afterwards, which would wipe the inputs on an error.
  const [, start] = useTransition();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(() => save(form));
  };
  const footer = (cancel?: string) => (
    <>
      {state?.error && <p role="alert" className="mx-[25px] mb-2 text-right text-[12.6px] text-[#a94442]">{state.error}</p>}
      <div className="mx-[25px] mb-5 flex justify-end gap-2">
        {cancel && <Link href={cancel} className={cn(greyBtn, "px-4 py-1.5 text-[12.6px]")}>Cancel</Link>}
        <button disabled={saving} className={cn(greenBtn, "px-4 py-1.5 text-[12.6px] disabled:opacity-60")}>{saving ? "Saving..." : "Save"}</button>
      </div>
      <Saved show={!!state && !state.error && !created && ack !== state} close={() => setAck(state)} />
    </>
  );
  return { submit, footer };
}

// Runs a server action from a button and reports its error, if any.
export function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const go = (fn: () => Promise<Result>, then?: () => void) => start(async () => {
    const r = await fn();
    setError(r.error ?? "");
    if (!r.error) then?.();
  });
  return { pending, error, go };
}
export const Err = ({ text }: { text: string }) => (text ? <p role="alert" className="mb-2 text-[#a94442]">{text}</p> : null);
const address = (d: Record<string, string>) => [d["Unit Number"], d["Street Number"], d["Street Name"], d["Street Type"]].filter(Boolean).join(" ");

// ---- Offices

// Office list doubles as Organization > Offices (which adds Delete). Organization admins add and delete offices.
export function AppOfficeList({ org, offices, users, canManage }: { org?: boolean; offices: OfficeRow[]; users: AdminUserRow[]; canManage: boolean }) {
  const [q, setQ] = useState("");
  const [del, setDel] = useState<OfficeRow | null>(null);
  const run = useRun();
  return (
    <AppShell>
      <PageHeader icon={Building2} title={org ? "Offices" : "Office Administration"} crumbs={org ? [["Organization", "/admin/organization/edit"], ["Offices"]] : [["Office Admin"]]} />
      <GridPanel title={org ? "Offices" : "Office Editor"} tools={canManage && <Link href="/admin/office/edit/new" className={cn(greenBtn, "px-3 py-1")}>Add</Link>}>
        <Err text={run.error} />
        <Grid head={["Name", "Nickname", "Address", "City", "Province", ""]} rows={offices.map((o) => [
          o.name, o.details.Nickname ?? "", address(o.details), o.details.City ?? "", o.details.Province ?? "",
          <span key="a" className="flex gap-1">
            <Link href={`/admin/office/edit/${o.id}`} className={cn(blueBtn, small)}>Edit</Link>
            {org && canManage && <button onClick={() => setDel(o)} className={cn(redBtn, small)}>Delete</button>}
          </span>,
        ])} />
      </GridPanel>
      {!org && (
        <GridPanel title="Edit Users" tools={<Search value={q} set={setQ} />}>
          <Grid head={["Office", "User Name", "Email", "Role", "Status"]} rows={users.filter((u) => match(q, u.name, u.email, u.office)).map((u) => [
            <select key="o" defaultValue={u.officeId} disabled={run.pending || offices.length < 2} onChange={(e) => run.go(() => patchUserAction(u.id, { officeId: e.target.value }))} className={input} aria-label={`Office for ${u.name}`}>
              {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>,
            <Link key="u" href={`/admin/users/edit/${u.id}`} className="text-[#428bca] hover:underline">{u.name}</Link>,
            u.email, roleLabels[u.role], u.deactivatedAt ? "Deactivated" : "Active",
          ])} />
        </GridPanel>
      )}
      {del && <Confirm text={`You're about to delete ${del.name}, this action cannot be undone. Are you sure you want to delete it?`} close={() => setDel(null)} ok={() => run.go(() => deleteOfficeAction(del.id))} />}
    </AppShell>
  );
}

type Consent = ConsentInput & { id: string | null };

function ConsentLang({ name, values }: { name: string; values: Record<string, string> }) {
  const [lang, setLang] = useState(consentLangs[0]);
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center gap-3"><span className="font-semibold">{name}</span>{consentLangs.map((l) => <button type="button" key={l} onClick={() => setLang(l)} className={cn("text-xs", lang === l ? "font-semibold text-[#428bca]" : "text-[#999]")}>{l}</button>)}</div>
      {/* Both languages stay in the form so both are saved; only the chosen one shows. */}
      {consentLangs.map((l) => <textarea key={l} name={consentKey(name, l)} defaultValue={values[consentKey(name, l)]} rows={3} placeholder={`${name} (${l})`} aria-label={`${name} (${l})`} className={cn(input, "h-auto py-1", l !== lang && "hidden")} />)}
    </div>
  );
}

export function AppOfficeEdit({ office, consents }: { office: OfficeRow | null; consents: (Consent & { id: string })[] }) {
  const d = office?.details ?? {};
  const { submit, footer } = useSave(saveOfficeAction.bind(null, office?.id ?? null), office ? undefined : (id) => `/admin/office/edit/${id}`);
  const [aml, setAml] = useState(d["Enable Anti-Money Laundering"] === "Yes");
  const [edit, setEdit] = useState<Consent | null>(null);
  const [del, setDel] = useState<Consent | null>(null);
  const run = useRun();
  return (
    <AppShell>
      <PageHeader icon={Building2} title="Office Edit" crumbs={[["Office Admin", "/admin/office/list"], ["Office Edit"]]} />
      <form onSubmit={submit}>
        <Box title={office?.name ?? "New Office"}>
          <div className="grid gap-3 sm:grid-cols-3">
            <F name="name" text="Name" value={office?.name} required />
            {["Nickname", "Email", "Business Phone", "Fax Number", "License Number", "Street Number", "Unit Number", "Street Name"].map((k) => <F key={k} name={k} value={d[k]} type={k === "Email" ? "email" : "text"} />)}
            {["Street Type", "Street Direction"].map((k) => <P key={k} name={k} options={officeSelects[k]} value={d[k]} />)}
            <F name="City" value={d.City} />
            {["Province", "Country"].map((k) => <P key={k} name={k} options={officeSelects[k]} value={d[k] ?? (k === "Province" ? "ON" : undefined)} />)}
            <F name="Postal Code" value={d["Postal Code"]} />
          </div>
        </Box>
        <Box title="Application Settings">
          <div className="grid gap-3 sm:grid-cols-3"><P name="Default Condition On" options={officeSelects["Default Condition On"]} value={d["Default Condition On"]} /></div>
          <p className="mt-2 text-[#999]">SLA targets are set for the whole organization under Admin &gt; Organization.</p>
        </Box>
        <Box title="Online Consent/Disclosures" open={false}>
          {onlineConsents.slice(0, -1).map((c) => <ConsentLang key={c} name={c} values={d} />)}
          <C name="Track Third Party Disclosure" on={d["Track Third Party Disclosure"] === "Yes"} />
          <ConsentLang name={onlineConsents.at(-1)!} values={d} />
        </Box>
        <Box title="Document Consent/Disclosures" open={false}>{documentConsents.map((c) => <ConsentLang key={c} name={c} values={d} />)}</Box>
        <Box title="Client Experience Settings" open={false}>{officeChecks.slice(1, 3).map((k) => <C key={k} name={k} on={d[k] === "Yes"} />)}</Box>
        <Box title="Anti-Money Laundering Settings" open={false}>
          <label className="flex items-center gap-2 py-1"><input type="checkbox" name="Enable Anti-Money Laundering" value="Yes" checked={aml} onChange={(e) => setAml(e.target.checked)} /> Enable Anti-Money Laundering</label>
          {officeChecks.slice(4).map((k) => <C key={k} name={k} on={d[k] === "Yes"} className={cn(!aml && "hidden")} />)}
        </Box>
        {footer("/admin/office/list")}
      </form>
      {office ? (
        <GridPanel title="Consent Templates" tools={<button onClick={() => setEdit({ id: null, title: "", content: "", acceptance: false, acceptanceText: "", signature: false, pageBreak: false, active: true })} className={cn(greenBtn, "px-3 py-1")}>Add Consent Template</button>}>
          <Err text={run.error} />
          {consents.length ? (
            <Grid head={["Title", "Content", "Status", "Inc. Signature", "Inc. Page Break", ""]} rows={consents.map((c) => [
              c.title, <span key="c" className="line-clamp-1">{c.content}</span>, c.active ? "Active" : "Inactive", c.signature ? "Yes" : "No", c.pageBreak ? "Yes" : "No",
              <span key="a" className="flex gap-1"><button onClick={() => setEdit(c)} className={cn(blueBtn, small)}>Edit</button><button onClick={() => setDel(c)} className={cn(redBtn, small)}>Delete</button></span>,
            ])} />
          ) : <div className="text-center text-[#999]"><p className="font-semibold">You have not created any Consent Templates</p><p>Consent Templates allow you to require acknowledgements of terms, signatures and include page breaks after each consent.</p></div>}
        </GridPanel>
      ) : <p className="mx-[25px] mb-5 text-[12.6px] text-[#999]">Save the office to add consent templates.</p>}
      {edit && office && <ConsentModal consent={edit} close={() => setEdit(null)} save={(c) => saveConsentAction(office.id, c.id, c)} />}
      {del?.id && <Confirm text="You're about to delete this Consent, this action cannot be undone. Are you sure you want to delete it?" close={() => setDel(null)} ok={() => run.go(() => deleteConsentAction(del.id!))} />}
    </AppShell>
  );
}

function ConsentModal({ consent, close, save }: { consent: Consent; close: () => void; save: (c: Consent) => Promise<Result> }) {
  const [c, setC] = useState(consent);
  const [preview, setPreview] = useState(false);
  const [err, setErr] = useState("");
  const [saving, start] = useTransition();
  const submit = () => {
    if (!c.title.trim()) return setErr("Please add your Consent Title");
    if (!c.content.trim()) return setErr("Please add your Consent Content");
    start(async () => {
      const r = await save(c);
      if (r.error) setErr(r.error);
      else close();
    });
  };
  const tick = (k: "acceptance" | "signature" | "pageBreak", text: string, hint: string) => (
    <label className="flex items-start gap-2 py-1"><input type="checkbox" checked={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.checked })} className="mt-0.5" /><span><b>{text}</b><span className="block text-[#999]">{hint}</span></span></label>
  );
  return (
    <Modal wide title={consent.id ? "Edit Consent" : "Add Consent"} close={close} footer={<>
      <button onClick={() => setPreview(!preview)} className={cn(greyBtn, "mr-auto px-3 py-1.5 text-[12.6px]")}>{preview ? "Edit" : "PDF Preview"}</button>
      <button disabled={saving} onClick={submit} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px] disabled:opacity-60")}>Save</button>
      <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
    </>}>
      {preview ? (
        // A layout preview in the page, not a generated PDF.
        <div className="min-h-[300px] border border-[#ddd] p-6 font-serif text-sm"><h2 className="mb-3 text-lg font-bold">{c.title}</h2><p className="whitespace-pre-wrap">{c.content}</p>{c.acceptance && <p className="mt-4">☐ {c.acceptanceText || "I accept"}</p>}{c.signature && <p className="mt-8 border-t border-black pt-1 text-xs">Signature</p>}</div>
      ) : (
        <div className="grid gap-3 text-[12.6px]">
          <label><span className={label}>Title</span><input value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} placeholder="Please add your Consent Title" className={input} /></label>
          <label><span className={label}>Consent Text</span><textarea rows={6} value={c.content} onChange={(e) => setC({ ...c, content: e.target.value })} placeholder="Please add your Consent Content" className={cn(input, "h-auto py-1")} /></label>
          {tick("acceptance", "Require Acceptance", "Require acceptance of this Term")}
          {c.acceptance && <label><span className={label}>Require Acceptance Text</span><input value={c.acceptanceText} onChange={(e) => setC({ ...c, acceptanceText: e.target.value })} className={input} /></label>}
          {tick("signature", "Require a Signature for this Consent", "Include eSignature on this Consents PDF.")}
          {tick("pageBreak", "Page Break", "Include a page break after this Consent (The next Consent will start on a new page in the PDF).")}
          <div className="flex items-center gap-3">This Consent is currently:{[true, false].map((a) => <label key={String(a)} className="flex items-center gap-1"><input type="radio" checked={c.active === a} onChange={() => setC({ ...c, active: a })} /> {a ? "Active" : "Inactive"}</label>)}</div>
          {err && <p role="alert" className="text-[#a94442]">{err}</p>}
        </div>
      )}
    </Modal>
  );
}

// ---- Users

export function AppAdminUsers({ users, me }: { users: AdminUserRow[]; me: string }) {
  const [q, setQ] = useState("");
  const [per, setPer] = useState("25");
  const [off, setOff] = useState<AdminUserRow | null>(null);
  const [to, setTo] = useState("");
  const run = useRun();
  const shown = users.filter((u) => match(q, u.name, u.email, u.office, roleLabels[u.role]));
  const rows = shown.slice(0, Number(per));
  return (
    <AppShell>
      <PageHeader icon={Users} title="Users" crumbs={[["Admin"], ["Users"]]} />
      <GridPanel title="Users" tools={<Link href="/admin/users/edit/new" className={cn(greenBtn, "px-3 py-1")}>Add</Link>}>
        <Err text={run.error} />
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select value={per} onChange={(e) => setPer(e.target.value)} className={cn(input, "w-[70px]")} aria-label="Records per page">{["10", "25", "50", "100"].map((n) => <option key={n}>{n}</option>)}</select> records per page
          <div className="ml-auto"><Search value={q} set={setQ} text="" /></div>
        </div>
        <Grid head={["Role", "Name", "Email", "Office", "Status", "Actions"]} rows={rows.map((u) => [
          roleLabels[u.role], <span key="n" className={cn(u.deactivatedAt && "text-[#999] line-through")}>{u.name}</span>, u.email, u.office, u.deactivatedAt ? "Deactivated" : "Active",
          <span key="a" className="flex gap-1">
            <Link href={`/admin/users/edit/${u.id}`} className={cn(blueBtn, small)}>Edit</Link>
            {u.deactivatedAt
              ? <button disabled={run.pending} onClick={() => run.go(() => restoreUserAction(u.id))} className={cn(greyBtn, small)}>Restore</button>
              : u.id !== me && <button onClick={() => { setOff(u); setTo(""); }} className={cn(redBtn, small)}>Deactivate</button>}
          </span>,
        ])} />
        <div className="mt-2"><Pager from={1} to={rows.length} total={shown.length} /></div>
      </GridPanel>
      {off && (
        <Modal title={`Deactivate ${off.name}`} close={() => setOff(null)} footer={<>
          <button disabled={run.pending} onClick={() => run.go(() => deactivateUserAction(off.id, to), () => setOff(null))} className={cn(redBtn, "px-3 py-1.5 text-[12.6px]")}>Deactivate</button>
          <button onClick={() => setOff(null)} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
        </>}>
          <div className="grid gap-2 text-[12.6px]">
            <p>{off.name} won&apos;t be able to sign in. You can restore them later.</p>
            <label><span className={label}>Hand their deals, contacts and open deal tasks to</span>
              <select value={to} onChange={(e) => setTo(e.target.value)} className={input}>
                <option value="">Nobody: their deals show under No Agent</option>
                {users.filter((u) => !u.deactivatedAt && u.id !== off.id && u.officeId === off.officeId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <Err text={run.error} />
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

export function AppUserEdit({ user, offices, mentors, roles }: { user: AdminUserRow | null; offices: OfficeRow[]; mentors: AdminUserRow[]; roles: Role[] }) {
  const d = user?.details ?? {};
  const { submit, footer } = useSave(saveUserAction.bind(null, user?.id ?? null), user ? undefined : (id) => `/admin/users/edit/${id}`);
  return (
    <AppShell>
      <PageHeader icon={Users} title="Edit User" crumbs={[["Users", "/admin/users"], ["Edit User"]]} />
      <form onSubmit={submit}>
        <Box title={user ? `${user.name}${user.deactivatedAt ? " (deactivated)" : ""}` : "New User"}>
          <div className="grid gap-3 sm:grid-cols-3">
            <F name="name" text="Name" value={user?.name} required />
            <F name="email" text="Email" type="email" value={user?.email} required />
            <F name="password" text={user ? "New Password (leave blank to keep)" : "Password"} type="password" required={!user} autoComplete="new-password" />
            <P name="officeId" text="Office" options={offices.map((o) => [o.id, o.name])} value={user?.officeId} />
            <P name="role" text="Role Type" options={roles.map((r) => [r, roleLabels[r]])} value={user?.role ?? "agent"} />
          </div>
          <div className="mt-3 grid sm:grid-cols-2">{licences.map((l) => <label key={l} className="flex items-center gap-2 py-1"><input type="radio" name="Licence" value={l} defaultChecked={(d.Licence ?? licences[1]) === l} /> {l}</label>)}</div>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">{["Licensee Number", "Authorized Title"].map((k) => <F key={k} name={k} value={d[k]} />)}</div>
          {userChecks.map((k) => <C key={k} name={k} on={d[k] === "Yes"} />)}
        </Box>
        <Box title="Credit Bureau Settings"><div className="grid gap-3 sm:grid-cols-2">{["Equifax Member #", "TransUnion Member Code"].map((k) => <F key={k} name={k} value={d[k]} />)}</div></Box>
        <Box title="User Profile and CRM Settings" open={false}>
          <div className="grid gap-3 sm:grid-cols-3">{["Website", "Home Phone", "Cell Phone", "Business Phone", "Fax Number", "Company Name", "Job Title"].map((k) => <F key={k} name={k} value={d[k]} />)}</div>
        </Box>
        <Box title="Income Breakdown" open={false}>
          <div className="grid gap-3 sm:grid-cols-4">
            <P name="Mentor" options={[["", "- Select agent -"], ...mentors.filter((m) => m.id !== user?.id).map((m): [string, string] => [m.id, m.name])]} value={d.Mentor ?? ""} />
            {incomeFields.map((k) => <F key={k} name={k} text={k === "Mentor Percentage" ? k : `${k} (%)`} type="number" value={d[k] ?? "0"} />)}
          </div>
        </Box>
        {/* ponytail: working provinces and associates need their own tables; add them when licensing checks or co-assignment use them. */}
        <p className="mx-[25px] mb-3 text-[12.6px] text-[#999]">Working provinces and associates aren&apos;t stored yet.</p>
        {footer("/admin/users")}
      </form>
    </AppShell>
  );
}

// Role and office, inline. Each change saves on its own.
export function AppUserMatrix({ users, offices, roles }: { users: AdminUserRow[]; offices: OfficeRow[]; roles: Role[] }) {
  const [q, setQ] = useState("");
  const run = useRun();
  return (
    <AppShell>
      <PageHeader icon={Network} title="Edit Users" crumbs={[["Admin"], ["User Matrix"]]} />
      <GridPanel title="Edit Users" tools={<Search value={q} set={setQ} />}>
        <Err text={run.error} />
        <Grid head={["Name", "Email", "Role", "Office", ""]} rows={users.filter((u) => !u.deactivatedAt && match(q, u.name, u.email)).map((u) => [
          u.name, u.email,
          <select key={`r${u.role}`} defaultValue={u.role} disabled={run.pending} onChange={(e) => run.go(() => patchUserAction(u.id, { role: e.target.value }))} className={input} aria-label={`Role for ${u.name}`}>
            {(roles.includes(u.role) ? roles : [u.role, ...roles]).map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
          </select>,
          <select key={`o${u.officeId}`} defaultValue={u.officeId} disabled={run.pending} onChange={(e) => run.go(() => patchUserAction(u.id, { officeId: e.target.value }))} className={input} aria-label={`Office for ${u.name}`}>
            {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>,
          <Link key="l" href={`/admin/users/edit/${u.id}`} className={cn(blueBtn, small)}>Edit User</Link>,
        ])} />
      </GridPanel>
    </AppShell>
  );
}

// ---- Organization

export type OrgView = { name: string; settings: { sla: Record<string, number>; reminders: { urgent: number; warning: number; notice: number }; features: string[] } };

export function AppOrganizationEdit({ org, slaStatuses }: { org: OrgView; slaStatuses: DealStatus[] }) {
  const { submit, footer } = useSave(saveOrganizationAction);
  const [q, setQ] = useState("");
  const s = org.settings;
  return (
    <AppShell>
      <PageHeader icon={Building2} title="Organization Edit" crumbs={[["Organization"], ["Edit"]]}>
        <Link href="/admin/organization/offices" className={cn(greyBtn, "px-3 py-1 text-[12.6px]")}>Offices</Link>
      </PageHeader>
      <form onSubmit={submit}>
        <Box title="Organization">
          <div className="grid gap-3 sm:grid-cols-3"><F name="name" text="Name" value={org.name} required /></div>
        </Box>
        <Box title="SLA Targets (days in stage)">
          <div className="grid gap-3 sm:grid-cols-3">{slaStatuses.map((st) => <F key={st} name={`sla.${st}`} text={`${statusLabel[st]} SLA days`} type="number" value={String(s.sla[st])} />)}</div>
        </Box>
        <Box title="Deal Reminders (days before closing or conditions)">
          <div className="grid gap-3 sm:grid-cols-3">{(["urgent", "warning", "notice"] as const).map((k) => <F key={k} name={`reminders.${k}`} text={`${k[0].toUpperCase()}${k.slice(1)} within`} type="number" value={String(s.reminders[k])} />)}</div>
        </Box>
        <Box title="Features">
          <div className="mb-2"><Search value={q} set={setQ} text="Filter:" /></div>
          {/* Filtered-out flags stay in the form (hidden) so saving keeps them. */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3">{orgFeatures.map((f) => (
            <label key={f} className={cn("flex items-center gap-2 py-1", !match(q, f) && "hidden")}><input type="checkbox" name="features" value={f} defaultChecked={s.features.includes(f)} /> {f}</label>
          ))}</div>
          <p className="mt-2 text-[#999]">Flags are saved; features don&apos;t check them yet.</p>
        </Box>
        {footer()}
      </form>
    </AppShell>
  );
}

// ---- Condition library: the conditions smart rules add to deals when every field in the rule matches.

type Template = { id: string; name: string; rule: Record<string, string[]>; active: boolean };
const allFields = [...fieldKeys].sort();

export function AppConditionLibrary({ templates }: { templates: Template[] }) {
  const [edit, setEdit] = useState<Template | null>(null);
  return (
    <AppShell>
      <PageHeader icon={BookCheck} title="Condition Library" crumbs={[["Admin"], ["Condition Library"]]} />
      <GridPanel title="Conditions" tools={<button onClick={() => setEdit({ id: "", name: "", rule: {}, active: true })} className={cn(greenBtn, "px-3 py-1")}>Add</button>}>
        <p className="mb-2 text-[#999]">Saving a deal adds each active condition whose rule matches. An empty rule matches every deal.</p>
        <Grid head={["Condition", "Rule", "Status", ""]} rows={templates.map((t) => [
          t.name,
          Object.keys(t.rule).length ? Object.entries(t.rule).map(([k, v]) => `${k.split("/").at(-1)} is ${v.join(" or ")}`).join("; ") : "Every deal",
          t.active ? "Active" : "Inactive",
          <button key="e" onClick={() => setEdit(t)} className={cn(blueBtn, small)}>Edit</button>,
        ])} />
      </GridPanel>
      {edit && <ConditionModal template={edit} close={() => setEdit(null)} />}
    </AppShell>
  );
}

function ConditionModal({ template, close }: { template: Template; close: () => void }) {
  const [name, setName] = useState(template.name);
  const [active, setActive] = useState(template.active);
  const [rows, setRows] = useState(Object.entries(template.rule).map(([k, v]) => ({ k, v: v.join(", ") })));
  const run = useRun();
  const set = (i: number, patch: Partial<{ k: string; v: string }>) => setRows(rows.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  const submit = () => run.go(() => saveConditionAction(template.id || null, {
    name, active, rule: Object.fromEntries(rows.filter((r) => r.k).map((r) => [r.k, r.v.split(",").map((x) => x.trim())])),
  }), close);
  return (
    <Modal wide title={template.id ? "Edit Condition" : "Add Condition"} close={close} footer={<>
      <button disabled={run.pending} onClick={submit} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px] disabled:opacity-60")}>Save</button>
      <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
    </>}>
      <div className="grid gap-3 text-[12.6px]">
        <label><span className={label}>Condition</span><input value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label>
        <div>
          <span className={label}>Rule: add the condition when every field has one of its values</span>
          <datalist id="condition-fields">{allFields.map((f) => <option key={f} value={f} />)}</datalist>
          {rows.map((r, i) => (
            <div key={i} className="mb-1 grid gap-1 sm:grid-cols-[1fr_1fr_auto]">
              <input list="condition-fields" value={r.k} onChange={(e) => set(i, { k: e.target.value })} placeholder="Workspace field" aria-label="Field" className={input} />
              <input value={r.v} onChange={(e) => set(i, { v: e.target.value })} placeholder="Values, comma separated" aria-label="Values" className={input} />
              <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className={cn(redBtn, small)}>Remove</button>
            </div>
          ))}
          <button onClick={() => setRows([...rows, { k: "", v: "" }])} className={cn(greyBtn, small)}>Add Field</button>
        </div>
        <Err text={run.error} />
      </div>
    </Modal>
  );
}

// ---- Logs: the audit table. Tabs and paging are links, so the server does the filtering.

type LogRow = { id: string; at: Date; entity: string; entityId: string; action: string; actor: string; before: unknown; after: unknown };

export function AppLogs({ rows, total, page, entities, entity, per }: { rows: LogRow[]; total: number; page: number; entities: string[]; entity: string; per: number }) {
  const [view, setView] = useState<LogRow | null>(null);
  const href = (e: string, p = 1) => `/admin/logs?${new URLSearchParams({ ...(e && { entity: e }), ...(p > 1 && { page: String(p) }) })}`;
  const from = (page - 1) * per;
  return (
    <AppShell>
      <PageHeader icon={FileText} title="View Logs" crumbs={[["Admin"], ["Logs"]]} />
      <GridPanel title="View Logs">
        <div className="mb-3 flex flex-wrap border-b border-[#ddd]">{["", ...entities].map((e) => (
          <Link key={e} href={href(e)} className={cn("-mb-px border px-3 py-1.5", entity === e ? "border-[#ddd] border-b-white bg-white text-[#555]" : "border-transparent text-[#428bca]")}>{e ? e.replace(/_/g, " ") : "All Logs"}</Link>
        ))}</div>
        <Grid head={["Date", "User", "Record", "Action", ""]} rows={rows.map((l) => [
          l.at.toLocaleString("en-CA"), l.actor, `${l.entity.replace(/_/g, " ")} ${l.entityId.slice(0, 8)}`, l.action,
          <button key="v" onClick={() => setView(l)} className={cn(blueBtn, small)}>View</button>,
        ])} />
        <div className="mt-2 flex items-center gap-3">
          <Pager from={from + 1} to={from + rows.length} total={total} />
          {page > 1 && <Link href={href(entity, page - 1)} className="text-[#428bca] hover:underline">Previous</Link>}
          {from + rows.length < total && <Link href={href(entity, page + 1)} className="text-[#428bca] hover:underline">Next</Link>}
        </div>
      </GridPanel>
      {view && (
        <Modal wide title={`${view.entity.replace(/_/g, " ")} ${view.action}`} close={() => setView(null)} footer={<button onClick={() => setView(null)} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Close</button>}>
          <p className="mb-2 text-[12.6px]">{view.actor}, {view.at.toLocaleString("en-CA")}. Record {view.entityId}</p>
          <div className="grid gap-2 sm:grid-cols-2">{(["before", "after"] as const).map((k) => (
            <div key={k}><span className={label}>{k === "before" ? "Before" : "After"}</span><pre className="max-h-[400px] overflow-auto bg-[#f5f5f5] p-3 text-xs">{view[k] == null ? "—" : JSON.stringify(view[k], null, 2)}</pre></div>
          ))}</div>
        </Modal>
      )}
    </AppShell>
  );
}

type DeletedDeal = { id: string; number: number; status: DealStatus; amount: number | null; deletedAt: Date | null; agent: string; firstName: string | null; lastName: string | null };

export function AppDeletedDeals({ rows }: { rows: DeletedDeal[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const restore = (d: DeletedDeal) => {
    if (!confirm(`Restore deal ${dealCode(d.number)}? It goes back to every list it was in.`)) return;
    start(async () => setError((await restoreDealAction(d.id)).error ?? ""));
  };
  return (
    <AppShell>
      <PageHeader icon={Trash2} title="Recently Deleted" crumbs={[["Admin"], ["Recently Deleted"]]} />
      <GridPanel title="Deleted Deals">
        <p className="mb-3 text-[12.6px] text-[#666]">Deleted deals are kept here and hidden everywhere else. Only admins can see this page.</p>
        {error && <p className="mb-3 text-[12.6px] text-[#a94442]">{error}</p>}
        <Grid head={["Deal #", "Client", "Status", "Amount", "Agent", "Deleted", ""]} rows={rows.map((d) => [
          dealCode(d.number), [d.firstName, d.lastName].filter(Boolean).join(" "), statusLabel[d.status], d.amount == null ? "" : `$${d.amount.toLocaleString("en-CA")}`, d.agent,
          d.deletedAt?.toLocaleString("en-CA") ?? "",
          <button key="r" disabled={pending} onClick={() => restore(d)} className={cn(blueBtn, small)}>Restore</button>,
        ])} empty="No deleted deals" />
      </GridPanel>
    </AppShell>
  );
}
