"use client";

import { useState } from "react";
import { LifeBuoy, Webhook } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { domainStatuses, placeholderDomains, placeholderWebhooks, placeholderWebhookTx, webhookStatuses } from "./placeholder-data";
import { AppShell } from "./shell";
import { blueBtn, greenBtn, greyBtn, Grid, input, label, Modal, PageHeader } from "./ui";
import { GridPanel } from "./admin";

const small = "px-2 py-0.5 text-xs";
const btn = "px-3 py-1.5 text-[12.6px]";
const today = () => new Date().toISOString().slice(0, 10);
type Domain = (typeof placeholderDomains)[number];
type DomainModal = "status" | "history" | "accounts" | "azure";

export function AppEmailDomains() {
  const [domains, setDomains] = useState<Domain[]>(placeholderDomains);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [open, setOpen] = useState<{ d: Domain; m: DomainModal } | null>(null);
  const update = (d: Domain) => { setDomains(domains.map((x) => (x.id === d.id ? d : x))); setOpen(null); };
  return (
    <AppShell>
      <PageHeader icon={LifeBuoy} title="Domains" crumbs={[["Support"], ["Email Configuration"], ["Domains"]]} />
      <GridPanel title="Domains" tools={<button onClick={() => setAdding(true)} className={cn(greenBtn, "px-3 py-1")}>Add New Domain</button>}>
        <Grid empty="There are no Domains to register for email access." head={["Name", "Status", "Created On", "Status Set On", "Accounts", ""]} rows={domains.map((d) => [
          d.name,
          <button key="s" onClick={() => setOpen({ d, m: "status" })} className="text-[#428bca] hover:underline">{d.status}</button>,
          d.createdOn, d.statusSetOn,
          <button key="a" onClick={() => setOpen({ d, m: "accounts" })} className="text-[#428bca] hover:underline">{d.accounts.length}</button>,
          <span key="x" className="flex gap-1">
            <button onClick={() => setOpen({ d, m: "history" })} className={cn(greyBtn, small)}>Status History</button>
            <button onClick={() => setOpen({ d, m: "azure" })} className={cn(blueBtn, small)}>Azure Settings</button>
          </span>,
        ])} />
      </GridPanel>
      {adding && (
        <Modal title="Add New Domain" close={() => setAdding(false)} footer={<>
          <button disabled={!name.trim()} onClick={() => { setDomains([...domains, { id: Date.now(), name: name.trim(), status: "Pending", createdOn: today(), statusSetOn: today(), azure: false, history: [], accounts: [] }]); setName(""); setAdding(false); }} className={cn(greenBtn, btn, "disabled:opacity-50")}>Save</button>
          <button onClick={() => setAdding(false)} className={cn(greyBtn, btn)}>Cancel</button>
        </>}>
          <label className="text-[12.6px]"><span className={label}>Domain Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="example.com" className={input} /></label>
        </Modal>
      )}
      {open?.m === "status" && <StatusModal d={open.d} close={() => setOpen(null)} save={update} />}
      {open?.m === "azure" && <AzureModal d={open.d} close={() => setOpen(null)} save={update} />}
      {open?.m === "history" && (
        <Modal wide title={`Status History - ${open.d.name}`} close={() => setOpen(null)}>
          <Grid min={400} empty="No data found" head={["Date", "Status", "Note"]} rows={open.d.history.map((h) => [h.date, h.status, h.note])} />
        </Modal>
      )}
      {open?.m === "accounts" && (
        <Modal wide title={`Accounts - ${open.d.name}`} close={() => setOpen(null)}>
          <Grid min={600} empty="No data found" head={["User", "Email Requested", "Request Date", "aMember User Name", "Status"]} rows={open.d.accounts.map((a) => [a.user, a.email, a.date, a.member, a.status])} />
        </Modal>
      )}
    </AppShell>
  );
}

function StatusModal({ d, close, save }: { d: Domain; close: () => void; save: (d: Domain) => void }) {
  const [status, setStatus] = useState(d.status);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const ok = () => {
    if (status === "Active" && !d.azure) return setErr("The domain cannot be activated with missing Azure Settings");
    save({ ...d, status, statusSetOn: today(), history: [...d.history, { date: today(), status, note }] });
  };
  return (
    <Modal title={`Change Status - ${d.name}`} close={close} footer={<><button onClick={ok} className={cn(greenBtn, btn)}>Save</button><button onClick={close} className={cn(greyBtn, btn)}>Cancel</button></>}>
      <div className="grid gap-3 text-[12.6px]">
        {err && <div className="rounded border border-[#ebccd1] bg-[#f2dede] p-2 text-[#a94442]"><b>Validation failed</b><p>{err}</p></div>}
        <label><span className={label}>Status</span><select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>{domainStatuses.map((s) => <option key={s}>{s}</option>)}</select></label>
        <p className="text-[#999]">Status must be set to &apos;Active&apos; for Users to register for this Domain.</p>
        <label><span className={label}>Note</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={cn(input, "h-auto py-1")} /></label>
        <p className="text-[#999]">This note will be sent to the User.</p>
      </div>
    </Modal>
  );
}

function AzureModal({ d, close, save }: { d: Domain; close: () => void; save: (d: Domain) => void }) {
  const [adding, setAdding] = useState(false);
  const fields = ["Client Id", "Client Secret Value", "Tenant Id", "API Scope"];
  return (
    <Modal wide title={`Azure Settings - ${d.name}`} close={close} footer={adding
      ? <><button onClick={() => save({ ...d, azure: true })} className={cn(greenBtn, btn)}>Save</button><button onClick={() => setAdding(false)} className={cn(greyBtn, btn)}>Cancel</button></>
      : <button onClick={close} className={cn(greyBtn, btn)}>Close</button>}>
      {adding ? (
        <div className="grid gap-3 text-[12.6px] sm:grid-cols-2">
          <label><span className={label}>Domain Name</span><input value={d.name} readOnly className={cn(input, "bg-[#eee]")} /></label>
          {fields.map((f) => <label key={f}><span className={label}>{f}</span><input type={f.includes("Secret") ? "password" : "text"} className={input} /></label>)}
          <label><span className={label}>Client Secret Expiry Date</span><input type="date" className={input} /></label>
        </div>
      ) : (
        <>
          <Grid min={500} empty="No data found" head={["Domain Name", "Client Id", "Tenant Id", "Client Secret Expiry Date"]} rows={d.azure ? [[d.name, "00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002", "2027-03-01"]] : []} />
          {!d.azure && <button onClick={() => setAdding(true)} className={cn(greenBtn, btn, "mt-2")}>Add</button>}
        </>
      )}
    </Modal>
  );
}

const PAGE = 10;

function Prev({ page, set, total }: { page: number; set: (n: number) => void; total: number }) {
  return (
    <div className="mt-2 flex justify-end gap-1">
      <button disabled={page === 0} onClick={() => set(page - 1)} className={cn(greyBtn, small, "disabled:opacity-50")}>Prev</button>
      <button disabled={(page + 1) * PAGE >= total} onClick={() => set(page + 1)} className={cn(greyBtn, small, "disabled:opacity-50")}>Next</button>
    </div>
  );
}

export function AppWebhooks() {
  const [page, setPage] = useState(0);
  const tone = (s: string) => (s === "Active" ? "bg-[#00a65a]" : s === "Pending Approval" ? "bg-[#f39c12]" : "bg-[#d9534f]");
  return (
    <AppShell>
      <PageHeader icon={Webhook} title="Webhooks" crumbs={[["Support"], ["Webhooks"]]} />
      <GridPanel title="Webhooks">
        <Grid min={900} head={["Name", "Status", "Created", "Callback Url", "Transaction Count", "Last Transaction", ""]} rows={placeholderWebhooks.slice(page * PAGE, (page + 1) * PAGE).map((w) => [
          w.name, <span key="s" className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold text-white uppercase", tone(w.status))} title={webhookStatuses.join(" / ")}>{w.status}</span>,
          w.created, <code key="u" className="text-[11px]">{w.callbackUrl}</code>, w.count, w.last || "—",
          <Link key="v" href={`/support/webhook/transactions/${w.key}`} className={cn(blueBtn, small)}>View Transactions</Link>,
        ])} />
        <Prev page={page} set={setPage} total={placeholderWebhooks.length} />
      </GridPanel>
    </AppShell>
  );
}

export function AppWebhookTransactions({ webhookKey }: { webhookKey: string }) {
  const [page, setPage] = useState(0);
  const [json, setJson] = useState<object | null>(null);
  const tx = placeholderWebhookTx.filter((t) => t.key === webhookKey);
  return (
    <AppShell>
      <PageHeader icon={Webhook} title="Transactions" crumbs={[["Webhooks", "/support/webhook/list"], ["Transactions"]]} />
      <GridPanel title={placeholderWebhooks.find((w) => w.key === webhookKey)?.name ?? webhookKey}>
        <Grid min={900} head={["Created Timestamp", "Request Timestamp", "Response Timestamp", "Status Code", "Attempt Number", "Callback Key", ""]} rows={tx.slice(page * PAGE, (page + 1) * PAGE).map((t) => [
          t.created, t.request, t.response, <span key="c" className={t.statusCode >= 400 ? "text-[#d9534f]" : "text-[#00a65a]"}>{t.statusCode}</span>, t.attempt, t.key,
          <button key="j" onClick={() => setJson(t.json)} className={cn(blueBtn, small)}>View Json</button>,
        ])} />
        <Prev page={page} set={setPage} total={tx.length} />
      </GridPanel>
      {json && <Modal wide title="Json" close={() => setJson(null)}><pre className="max-h-[400px] overflow-auto bg-[#f5f5f5] p-3 text-xs">{JSON.stringify(json, null, 2)}</pre></Modal>}
    </AppShell>
  );
}
