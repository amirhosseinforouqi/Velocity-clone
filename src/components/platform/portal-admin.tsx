"use client";

import { useActionState, useState } from "react";
import { ListChecks, Mail, Route, ShieldCheck, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { mfaAction } from "@/app/user/mfa/actions";
import { resetTemplateAction, saveChecklistAction, savePortalSettingsAction, saveStageAction, saveTemplateAction } from "@/app/admin/portal-actions";
import { Err, GridPanel, useRun } from "./admin";
import { AppShell } from "./shell";
import { blueBtn, greenBtn, greyBtn, Grid, input, label, Modal, PageHeader, panel } from "./ui";

const small = "px-2 py-0.5 text-xs";
const area = cn(input, "h-auto py-1");
const Ok = ({ show, text = "Saved." }: { show: boolean; text?: string }) => (show ? <p role="status" className="mb-2 text-[#3c763d]">{text}</p> : null);

// ---- Staff two-step verification (Me > Two-Step Verification)

export function AppMfa({ enabled, required, setup }: { enabled: boolean; required: boolean; setup: { secret: string; uri: string; sealed: string } | null }) {
  const [state, act, pending] = useActionState(mfaAction, null);
  return (
    <AppShell>
      <PageHeader icon={ShieldCheck} title="Two-Step Verification" crumbs={[["User"], ["Two-Step Verification"]]} />
      <section className={cn(panel, "max-w-[640px] p-[15px] text-[12.6px]")}>
        {required && !enabled && <p role="alert" className="mb-3 rounded-[3px] bg-[#fcf8e3] p-2 text-[#8a6d3b]">Your organization requires two-step verification. Set it up to continue.</p>}
        {enabled ? (
          <>
            <p className="mb-3"><span className="font-semibold text-[#3c763d]">On.</span> You enter a code from your authenticator app each time you sign in.</p>
            {!required && (
              <form action={act} className="flex flex-wrap items-end gap-2">
                <label><span className={label}>Current code, to turn it off</span><input name="code" inputMode="numeric" autoComplete="one-time-code" required className={cn(input, "w-[160px]")} /></label>
                <button disabled={pending} className={cn(greyBtn, "h-[30px] px-3")}>Turn off</button>
              </form>
            )}
          </>
        ) : setup && (
          <form action={act}>
            <ol className="mb-3 list-decimal space-y-2 pl-5">
              <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, ...) and add an account.</li>
              <li>Enter this key manually, or open the setup link on your phone:
                <code className="mt-1 block rounded-[3px] bg-[#f5f5f5] p-2 font-mono tracking-wider break-all select-all">{setup.secret.match(/.{1,4}/g)!.join(" ")}</code>
                <a href={setup.uri} className="text-[#428bca] hover:underline">Open in authenticator app</a>
              </li>
              <li>Enter the 6-digit code it shows.</li>
            </ol>
            <input type="hidden" name="sealed" value={setup.sealed} />
            <div className="flex flex-wrap items-end gap-2">
              <label><span className={label}>Code</span><input name="code" inputMode="numeric" autoComplete="one-time-code" required className={cn(input, "w-[160px]")} /></label>
              <button disabled={pending} className={cn(greenBtn, "h-[30px] px-3")}>Turn on</button>
            </div>
          </form>
        )}
        <div className="mt-3"><Err text={state?.error ?? ""} /><Ok show={!!state?.ok} text={enabled ? "Two-step verification is on." : "Two-step verification is off."} /></div>
      </section>
    </AppShell>
  );
}

// ---- Email templates

type Template = { kind: string; label: string; vars: readonly string[]; subject: string; body: string; custom: boolean };

export function AppEmailTemplates({ templates, configured }: { templates: Template[]; configured: boolean }) {
  const [edit, setEdit] = useState<Template | null>(null);
  return (
    <AppShell>
      <PageHeader icon={Mail} title="Email Templates" crumbs={[["Admin"], ["Email Templates"]]} />
      <GridPanel title="Client Portal Emails">
        {!configured && <p role="alert" className="mb-3 rounded-[3px] bg-[#fcf8e3] p-2 text-[#8a6d3b]">Email sending isn&apos;t set up (RESEND_API_KEY and EMAIL_FROM). Emails are recorded as not sent, and staff are given the invitation link to share another way.</p>}
        <p className="mb-2 text-[#999]">Notification emails never include document names or message text; they ask the client to sign in.</p>
        <Grid head={["Email", "Subject", "", ""]} rows={templates.map((t) => [
          t.label, t.subject, t.custom ? "Customized" : "Default",
          <button key="e" onClick={() => setEdit(t)} className={cn(blueBtn, small)}>Edit</button>,
        ])} />
      </GridPanel>
      {edit && <TemplateModal t={edit} close={() => setEdit(null)} />}
    </AppShell>
  );
}

function TemplateModal({ t, close }: { t: Template; close: () => void }) {
  const [subject, setSubject] = useState(t.subject);
  const [body, setBody] = useState(t.body);
  const run = useRun();
  return (
    <Modal wide title={`Edit: ${t.label}`} close={close} footer={<>
      {t.custom && <button disabled={run.pending} onClick={() => run.go(() => resetTemplateAction(t.kind), close)} className={cn(greyBtn, "mr-auto px-3 py-1.5 text-[12.6px]")}>Reset to default</button>}
      <button disabled={run.pending} onClick={() => run.go(() => saveTemplateAction(t.kind, { subject, body }), close)} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px] disabled:opacity-60")}>Save</button>
      <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
    </>}>
      <div className="grid gap-3 text-[12.6px]">
        <p className="text-[#999]">Placeholders: {t.vars.map((v) => `{{${v}}}`).join(", ")}. The body must keep {"{{link}}"}.</p>
        <label><span className={label}>Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className={input} /></label>
        <label><span className={label}>Body</span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} maxLength={5000} className={area} /></label>
        <Err text={run.error} />
      </div>
    </Modal>
  );
}

// ---- Document checklists

type Item = { name: string; category: string; description: string };
type Checklist = { id: string; name: string; items: Item[]; active: boolean };

export function AppChecklists({ checklists }: { checklists: Checklist[] }) {
  const [edit, setEdit] = useState<Checklist | null>(null);
  return (
    <AppShell>
      <PageHeader icon={ListChecks} title="Document Checklists" crumbs={[["Admin"], ["Document Checklists"]]} />
      <GridPanel title="Checklists" tools={<button onClick={() => setEdit({ id: "", name: "", items: [{ name: "", category: "", description: "" }], active: true })} className={cn(greenBtn, "px-3 py-1")}>Add</button>}>
        <p className="mb-2 text-[#999]">Staff request every document on a checklist in one step from a deal&apos;s Client Portal tab.</p>
        <Grid head={["Checklist", "Documents", "Status", ""]} rows={checklists.map((c) => [
          c.name, c.items.map((i) => i.name).join(", "), c.active ? "Active" : "Inactive",
          <button key="e" onClick={() => setEdit(c)} className={cn(blueBtn, small)}>Edit</button>,
        ])} />
      </GridPanel>
      {edit && <ChecklistModal c={edit} close={() => setEdit(null)} />}
    </AppShell>
  );
}

function ChecklistModal({ c, close }: { c: Checklist; close: () => void }) {
  const [name, setName] = useState(c.name);
  const [active, setActive] = useState(c.active);
  const [items, setItems] = useState(c.items);
  const run = useRun();
  const set = (i: number, patch: Partial<Item>) => setItems(items.map((x, j) => (i === j ? { ...x, ...patch } : x)));
  return (
    <Modal wide title={c.id ? "Edit Checklist" : "Add Checklist"} close={close} footer={<>
      <button disabled={run.pending} onClick={() => run.go(() => saveChecklistAction(c.id || null, { name, active, items }), close)} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px] disabled:opacity-60")}>Save</button>
      <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
    </>}>
      <div className="grid gap-3 text-[12.6px]">
        <label><span className={label}>Name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={input} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label>
        <div>
          <span className={label}>Documents</span>
          {items.map((it, i) => (
            <div key={i} className="mb-2 grid gap-1 rounded-[3px] border border-[#eee] p-2 sm:grid-cols-[1fr_160px_auto]">
              <input value={it.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Document name" aria-label="Document name" maxLength={120} className={input} />
              <input value={it.category} onChange={(e) => set(i, { category: e.target.value })} placeholder="Category" aria-label="Category" maxLength={60} className={input} />
              <button onClick={() => setItems(items.filter((_, j) => j !== i))} className={cn(greyBtn, small)}>Remove</button>
              <input value={it.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="What the client should upload (optional)" aria-label="Description" maxLength={1000} className={cn(input, "sm:col-span-3")} />
            </div>
          ))}
          <button onClick={() => setItems([...items, { name: "", category: "", description: "" }])} className={cn(greyBtn, small)}>Add Document</button>
        </div>
        <Err text={run.error} />
      </div>
    </Modal>
  );
}

// ---- Progress stages

type Stage = { id: string; label: string; clientDescription: string; nextAction: string; position: number; active: boolean };

export function AppStages({ stages }: { stages: Stage[] }) {
  const [edit, setEdit] = useState<Stage | null>(null);
  const next = (stages.at(-1)?.position ?? -1) + 1;
  return (
    <AppShell>
      <PageHeader icon={Route} title="Progress Stages" crumbs={[["Admin"], ["Progress Stages"]]} />
      <GridPanel title="Client-Facing Stages" tools={<button onClick={() => setEdit({ id: "", label: "", clientDescription: "", nextAction: "", position: next, active: true })} className={cn(greenBtn, "px-3 py-1")}>Add</button>}>
        <p className="mb-2 text-[#999]">What clients see in their portal. These are separate from the internal deal status, which clients never see.</p>
        <Grid head={["Order", "Stage", "Client sees", "Client's next step", "Status", ""]} rows={stages.map((s) => [
          s.position, s.label, s.clientDescription, s.nextAction, s.active ? "Active" : "Hidden",
          <button key="e" onClick={() => setEdit(s)} className={cn(blueBtn, small)}>Edit</button>,
        ])} />
      </GridPanel>
      {edit && <StageModal s={edit} close={() => setEdit(null)} />}
    </AppShell>
  );
}

function StageModal({ s, close }: { s: Stage; close: () => void }) {
  const [v, setV] = useState(s);
  const run = useRun();
  return (
    <Modal title={s.id ? "Edit Stage" : "Add Stage"} close={close} footer={<>
      <button disabled={run.pending} onClick={() => run.go(() => saveStageAction(s.id || null, v), close)} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px] disabled:opacity-60")}>Save</button>
      <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
    </>}>
      <div className="grid gap-3 text-[12.6px]">
        <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
          <label><span className={label}>Stage</span><input value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} maxLength={60} className={input} /></label>
          <label><span className={label}>Order</span><input type="number" min={0} max={99} value={v.position} onChange={(e) => setV({ ...v, position: Number(e.target.value) })} className={input} /></label>
        </div>
        <label><span className={label}>What the client sees</span><textarea value={v.clientDescription} onChange={(e) => setV({ ...v, clientDescription: e.target.value })} rows={3} maxLength={500} className={area} /></label>
        <label><span className={label}>Client&apos;s next step</span><input value={v.nextAction} onChange={(e) => setV({ ...v, nextAction: e.target.value })} maxLength={300} className={input} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Active (hidden stages stay on deals already at them)</label>
        <Err text={run.error} />
      </div>
    </Modal>
  );
}

// ---- Client portal settings

type Settings = { inviteExpiryDays: number; retentionDays: number | null; requireStaffMfa: boolean };

export function AppPortalSettings({ settings, status }: { settings: Settings; status: [string, boolean, string][] }) {
  const [expiry, setExpiry] = useState(String(settings.inviteExpiryDays));
  const [retention, setRetention] = useState(settings.retentionDays == null ? "" : String(settings.retentionDays));
  const [mfa, setMfa] = useState(settings.requireStaffMfa);
  const [saved, setSaved] = useState(false);
  const run = useRun();
  return (
    <AppShell>
      <PageHeader icon={UserCog} title="Client Portal" crumbs={[["Admin"], ["Client Portal"]]} />
      <GridPanel title="Settings">
        <div className="grid max-w-[640px] gap-3">
          <label><span className={label}>Invitations expire after (days, 1 to 30)</span><input type="number" min={1} max={30} value={expiry} onChange={(e) => setExpiry(e.target.value)} className={cn(input, "w-[120px]")} /></label>
          <label>
            <span className={label}>Delete portal documents and messages after a deal closes (days, 30 to 3650; blank keeps them)</span>
            <input type="number" min={30} max={3650} value={retention} onChange={(e) => setRetention(e.target.value)} className={cn(input, "w-[120px]")} />
            <span className="mt-1 block text-[#999]">Applies to funded, declined, cancelled and complete deals. File names, dates and the audit trail are kept.</span>
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={mfa} onChange={(e) => setMfa(e.target.checked)} /> Require two-step verification for all staff</label>
          <Err text={run.error} /><Ok show={saved} />
          <div><button disabled={run.pending} onClick={() => { setSaved(false); run.go(() => savePortalSettingsAction({ inviteExpiryDays: expiry, retentionDays: retention, requireStaffMfa: mfa }), () => setSaved(true)); }} className={cn(greenBtn, "px-4 py-1.5 text-[12.6px] disabled:opacity-60")}>Save</button></div>
        </div>
      </GridPanel>
      <GridPanel title="Integrations">
        <Grid min={500} head={["Integration", "Status", "Notes"]} rows={status.map(([name, ok, note]) => [
          name, <span key="s" className={ok ? "text-[#3c763d]" : "text-[#a94442]"}>{ok ? "Connected" : "Not configured"}</span>, note,
        ])} />
      </GridPanel>
    </AppShell>
  );
}
