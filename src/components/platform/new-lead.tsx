"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { findDuplicatesAction } from "@/app/contacts/actions";
import { createLeadAction, invitationPreviewAction, inviteAction, leadFormAction } from "@/app/deal/portal-actions";
import { employmentLabels, employments, formatPhone, services, validPhone, type Employment, type Service } from "@/server/doc-rules";
import type { Contact } from "./placeholder-data";
import { blueBtn, greenBtn, greyBtn, input, label, Modal } from "./ui";

export type Login = { link: string; username: string; expires: string | null; existing: boolean };

// What staff pass on themselves when the welcome email could not be sent. No password is ever part of it.
export const loginText = (l: Login) =>
  l.existing
    ? `Sign in: ${l.link}\nUsername: ${l.username}\nPassword: the one you already use for this portal`
    : `Set up your client portal account: ${l.link}\nUsername: ${l.username}\nThe link works once and expires on ${l.expires}. You'll choose your own password.`;

export function NotSent({ who, why, login, onDone }: { who: string; why: string; login: Login; onDone?: () => void }) {
  const text = loginText(login);
  return (
    <div role="status" className="rounded-[3px] border border-[#faebcc] bg-[#fcf8e3] p-3 text-[12.6px] text-[#8a6d3b]">
      <p><strong>The welcome email for {who} was not sent.</strong> {why} The invitation is prepared: give them this setup link another way (it isn&apos;t shown again).</p>
      <textarea readOnly rows={4} value={text} onFocus={(e) => e.target.select()} aria-label="Portal setup details" className={cn(input, "mt-2 h-auto font-mono")} />
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => navigator.clipboard?.writeText(text)} className={cn(blueBtn, "px-3 py-1")}>Copy</button>
        {onDone && <button type="button" onClick={onDone} className={cn(greyBtn, "px-3 py-1")}>Done</button>}
      </div>
    </div>
  );
}

// The welcome email as it will be sent, for staff to read before confirming.
function PreviewBody({ to, preview }: { to: string; preview: Preview }) {
  return <>
    {!preview.configured && (
      <p role="status" className="mb-3 rounded-[3px] border border-[#faebcc] bg-[#fcf8e3] p-2.5 text-[12.6px] text-[#8a6d3b]">
        <strong>Email sending isn&apos;t set up, so nothing will be emailed.</strong> Confirming creates the client&apos;s portal invitation and shows you the secure setup link to pass on yourself.
      </p>
    )}
    <dl className="grid grid-cols-[70px_1fr] gap-y-1 text-[12.6px]">
      <dt className="font-semibold text-[#666]">To</dt><dd>{to}</dd>
      <dt className="font-semibold text-[#666]">Subject</dt><dd>{preview.subject}</dd>
    </dl>
    <pre className="mt-2 max-h-[260px] overflow-y-auto rounded-[3px] border border-[#ddd] bg-[#fafafa] p-3 font-sans text-[12.6px] whitespace-pre-wrap text-[#333]">{preview.body}</pre>
    <p className="mt-2 text-[11.5px] text-[#999]">The client chooses their own password on a secure page; no password is ever emailed. The wording is set in Admin → Email Templates.</p>
  </>;
}

// Invite Client from an open lead: nothing is created or sent until staff have read the email and confirmed.
export function InviteModal({ dealId, contactId, name, email, close }: { dealId: string; contactId: string; name: string; email: string; close: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState("");
  const [notSent, setNotSent] = useState<{ login: Login; why: string } | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    invitationPreviewAction(name.split(" ")[0]).then((r) => (r.data ? setPreview(r.data) : setFailed(r.error ?? "Something went wrong")));
  }, [name]);
  const done = () => { close(); router.refresh(); };
  const send = () => start(async () => {
    const r = await inviteAction(dealId, contactId);
    if (r.error || !r.data) return setFailed(r.error ?? "Something went wrong");
    if (r.data.status !== "sent" && r.data.login)
      return setNotSent({ login: r.data.login, why: r.data.status === "not_configured" ? "Email sending isn't set up." : r.data.error ?? "The email couldn't be sent." });
    done();
  });
  const btn = "px-3 py-1.5 text-[12.6px] disabled:opacity-60";
  return (
    <Modal title={`Invite ${name} to the client portal`} close={notSent ? done : close} footer={notSent ? <button onClick={done} className={cn(blueBtn, btn)}>Done</button> : <>
      <button onClick={close} className={cn(greyBtn, btn)}>Cancel</button>
      <button onClick={send} disabled={busy || !preview} className={cn(greenBtn, btn)}>{busy ? "Working…" : preview?.configured ? "Confirm & send invitation" : "Confirm & prepare invitation"}</button>
    </>}>
      {failed && <p role="alert" className="mb-3 rounded-[3px] border border-[#ebccd1] bg-[#f2dede] p-2 text-[12.6px] text-[#a94442]">{failed}</p>}
      {notSent ? <NotSent who={name} why={notSent.why} login={notSent.login} /> : preview ? <PreviewBody to={`${name} <${email}>`} preview={preview} /> : !failed && <p className="text-[12.6px] text-[#999]">Loading the invitation…</p>}
    </Modal>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const choice = (on: boolean) => cn("rounded-[3px] border px-3 py-1.5 text-[12.6px]", on ? "border-[#3d81be] bg-[#428bca] font-semibold text-white" : "border-[#ccc] bg-white text-[#333] hover:bg-[#f1f1f1]");

type Options = { me: string; admin: boolean; emailConfigured: boolean; staff: { id: string; name: string }[]; sources: string[] };
type Preview = { subject: string; body: string; configured: boolean };

// The quick New Lead form: who the client is, what they need and how they earn. Everything else is entered in the workspace it opens.
export function NewLeadModal({ close }: { close: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", source: "", note: "", agentId: "", assistantId: "" });
  const [service, setService] = useState<Service | null>(null);
  const [employment, setEmployment] = useState<Employment | null>(null);
  const [existing, setExisting] = useState<Contact | null>(null);
  const [dupes, setDupes] = useState<Contact[]>([]);
  const [opts, setOpts] = useState<Options | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [notSent, setNotSent] = useState<{ dealId: string; why: string; login: Login } | null>(null);
  const [busy, start] = useTransition();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    leadFormAction().then((r) => r.data && setOpts(r.data));
  }, []);
  // Looks for the same person while typing (full name, same email, or same phone number), a moment after the last keystroke.
  useEffect(() => {
    const t = setTimeout(() => findDuplicatesAction(f.firstName, f.lastName, EMAIL.test(f.email.trim()) ? f.email : "", validPhone(f.phone) ? f.phone : "").then(setDupes), 300);
    return () => clearTimeout(t);
  }, [f.firstName, f.lastName, f.email, f.phone]);

  const check = () => {
    const e: Record<string, string> = {};
    if (!f.firstName.trim()) e.firstName = "Enter the first name.";
    if (!f.lastName.trim()) e.lastName = "Enter the last name.";
    if (!EMAIL.test(f.email.trim())) e.email = "Enter a valid email address.";
    if (!validPhone(f.phone)) e.phone = "Enter a 10-digit phone number.";
    if (!service) e.service = "Choose what the application is for.";
    if (!employment) e.employment = "Choose the employment situation.";
    setErrors(e);
    setFailed("");
    return !Object.keys(e).length;
  };
  const create = (invite: boolean) => start(async () => {
    const r = await createLeadAction({ ...f, service, employment, contactId: existing?.id, invite });
    if (r.error || !r.data) return setFailed(r.error ?? "Something went wrong");
    const { dealId, invite: inv } = r.data;
    if (inv && inv.status !== "sent" && inv.login)
      return setNotSent({ dealId, login: inv.login, why: inv.status === "not_configured" ? "Email sending isn't set up." : inv.error ?? "The email couldn't be sent." });
    close();
    router.push(`/deal/${dealId}`);
  });
  const review = () => check() && start(async () => {
    const r = await invitationPreviewAction(f.firstName);
    if (r.error || !r.data) return setFailed(r.error ?? "Something went wrong");
    setPreview(r.data);
  });
  const btn = "px-3 py-1.5 text-[12.6px] disabled:opacity-60";
  const err = (k: string) => errors[k] && <span role="alert" className="mt-0.5 block text-[11.5px] text-[#a94442]">{errors[k]}</span>;
  const others = dupes.filter((d) => d.id !== existing?.id);

  if (notSent) return (
    <Modal title="New Lead" close={() => { close(); router.push(`/deal/${notSent.dealId}`); }} footer={
      <button onClick={() => { close(); router.push(`/deal/${notSent.dealId}`); }} className={cn(blueBtn, btn)}>Open the lead</button>
    }>
      <p className="mb-3 text-[12.6px] text-[#3c763d]">The lead for {f.firstName} {f.lastName} was created.</p>
      <NotSent who={`${f.firstName} ${f.lastName}`} why={notSent.why} login={notSent.login} />
    </Modal>
  );

  if (preview) return (
    <Modal title="Review the invitation" close={close} footer={<>
      <button onClick={() => setPreview(null)} disabled={busy} className={cn(greyBtn, btn, "mr-auto")}>Back</button>
      <button onClick={() => create(false)} disabled={busy} className={cn(greyBtn, btn)}>Create lead without inviting</button>
      <button onClick={() => create(true)} disabled={busy} className={cn(greenBtn, btn)}>{busy ? "Working…" : preview.configured ? "Confirm & send invitation" : "Confirm & prepare invitation"}</button>
    </>}>
      {failed && <p role="alert" className="mb-3 rounded-[3px] border border-[#ebccd1] bg-[#f2dede] p-2 text-[12.6px] text-[#a94442]">{failed}</p>}
      <PreviewBody to={`${f.firstName} ${f.lastName} <${existing?.email ?? f.email.trim()}>`} preview={preview} />
    </Modal>
  );

  return (
    <Modal title="New Lead" close={close} footer={<>
      <button onClick={close} className={cn(greyBtn, btn, "mr-auto")}>Cancel</button>
      <button onClick={() => check() && create(false)} disabled={busy} className={cn(blueBtn, btn)}>{busy ? "Working…" : "Create Lead Only"}</button>
      <button onClick={review} disabled={busy} className={cn(greenBtn, btn)}>Create Lead &amp; Invite Client</button>
    </>}>
      {failed && <p role="alert" className="mb-3 rounded-[3px] border border-[#ebccd1] bg-[#f2dede] p-2 text-[12.6px] text-[#a94442]">{failed}</p>}
      <form onSubmit={(e) => { e.preventDefault(); if (check()) create(false); }} className="grid gap-3 sm:grid-cols-2">
        <label><span className={label}>First name</span><input autoFocus value={f.firstName} onChange={set("firstName")} maxLength={100} autoComplete="off" className={input} />{err("firstName")}</label>
        <label><span className={label}>Last name</span><input value={f.lastName} onChange={set("lastName")} maxLength={100} autoComplete="off" className={input} />{err("lastName")}</label>
        <label><span className={label}>Email</span><input type="email" value={f.email} onChange={set("email")} maxLength={200} autoComplete="off" className={input} />{err("email")}</label>
        <label><span className={label}>Phone</span><input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: formatPhone(e.target.value) })} placeholder="416-555-0100" autoComplete="off" className={input} />{err("phone")}</label>

        {existing ? (
          <p role="status" className="rounded-[3px] border border-[#bce8f1] bg-[#d9edf7] p-2.5 text-[12.6px] text-[#31708f] sm:col-span-2">
            This lead will be added to the existing client <strong>{existing.firstName} {existing.lastName}</strong>{existing.email && ` (${existing.email})`}. Their saved details aren&apos;t changed.{" "}
            <button type="button" onClick={() => setExisting(null)} className="underline">Create a new client instead</button>
          </p>
        ) : others.length > 0 && (
          <div role="status" className="rounded-[3px] border border-[#faebcc] bg-[#fcf8e3] p-2.5 text-[12.6px] text-[#8a6d3b] sm:col-span-2">
            <strong>Possible existing client.</strong> Use their record instead of creating a duplicate:
            <ul className="mt-1">
              {others.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 py-0.5">
                  {c.firstName} {c.lastName} <span className="text-[#999]">{[c.email, c.cellPhone].filter(Boolean).join(" · ")}</span>
                  <button type="button" onClick={() => { setExisting(c); setF({ ...f, firstName: c.firstName, lastName: c.lastName, email: c.email ?? f.email, phone: c.cellPhone ? formatPhone(c.cellPhone) : f.phone }); }} className="ml-auto text-[#428bca] underline">Use this client</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <fieldset className="sm:col-span-2">
          <legend className={label}>What is this application for?</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What is this application for?">
            {services.map((s) => <button type="button" key={s} role="radio" aria-checked={service === s} onClick={() => setService(s)} className={choice(service === s)}>{s}</button>)}
          </div>
          {err("service")}
        </fieldset>
        <fieldset className="sm:col-span-2">
          <legend className={label}>Employment situation</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Employment situation">
            {employments.map((e) => <button type="button" key={e} role="radio" aria-checked={employment === e} onClick={() => setEmployment(e)} className={choice(employment === e)}>{employmentLabels[e]}</button>)}
          </div>
          {err("employment")}
          <span className="mt-1 block text-[11.5px] text-[#999]">Sets the starting document checklist. You can change it, or add more income types, in the workspace.</span>
        </fieldset>

        <label>
          <span className={label}>Assigned agent</span>
          <select value={f.agentId || opts?.me || ""} onChange={set("agentId")} disabled={!opts?.admin} className={input}>
            {(opts?.staff ?? []).filter((u) => opts?.admin || u.id === opts?.me).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label>
          <span className={label}>Assistant (optional)</span>
          <select value={f.assistantId} onChange={set("assistantId")} className={input}>
            <option value="">None</option>
            {(opts?.staff ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label>
          <span className={label}>Lead source</span>
          <select value={f.source} onChange={set("source")} className={input}>
            <option value="">Not set</option>
            {(opts?.sources ?? []).map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="sm:col-span-2"><span className={label}>Note (optional)</span><textarea value={f.note} onChange={set("note")} rows={2} maxLength={2000} className={cn(input, "h-auto py-1")} /></label>
        <button type="submit" hidden />
      </form>
      <p className="mt-3 text-[11.5px] text-[#999]">Create Lead Only sends nothing to the client; you can invite them later from the lead. Create Lead &amp; Invite Client shows the welcome email for you to confirm first.</p>
    </Modal>
  );
}
