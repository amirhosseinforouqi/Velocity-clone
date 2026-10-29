"use client";

import { useState, type FormEvent } from "react";
import { Landmark, Table2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createLenderAction, deleteProductAction, saveLenderAction, saveProductAction, setLenderHiddenAction } from "@/app/admin/actions";
import type { LenderRow } from "@/server/lenders";
import { lenderFees, lenderGroups, lenderTypes, limitKeys, productFees, underwriterTypes } from "./admin-fields";
import { Confirm, Err, GridPanel, Search, useRun } from "./admin";
import { Saved } from "./me";
import { AppShell } from "./shell";
import { blueBtn, greenBtn, greyBtn, Grid, input, label, Modal, PageHeader, redBtn } from "./ui";

const small = "px-2 py-0.5 text-xs";
type Agent = { id: string; name: string };
type Product = { id: string; name: string; term: number; fees: Record<string, number> };
const pct = (n = 0) => `${n}%`;
const limit = (n?: number) => (n === undefined ? "Default" : pct(n));

// Shared by Lenders and Lender Matrix: search, add, show removed, remove/unhide.
function useLenders(lenders: LenderRow[]) {
  const [q, setQ] = useState("");
  const [removed, setRemoved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<LenderRow | null>(null);
  const run = useRun();
  const rows = lenders.filter((l) => (removed || !l.hiddenAt) && l.name.toLowerCase().includes(q.toLowerCase()));
  const name = (l: LenderRow) => <span key="n" className={cn(l.hiddenAt && "text-[#999] line-through")}>{l.name}</span>;
  const actions = (l: LenderRow) => (
    <span key="a" className="flex gap-1">
      <Link href={`/admin/lenders/${l.id}`} className={cn(blueBtn, small)}>Edit</Link>
      {l.hiddenAt
        ? <button onClick={() => run.go(() => setLenderHiddenAction(l.id, false))} className={cn(greyBtn, small)}>Unhide</button>
        : <button onClick={() => setPending(l)} className={cn(redBtn, small)}>Remove</button>}
    </span>
  );
  const tools = (
    <>
      <Search value={q} set={setQ} />
      <button onClick={() => setRemoved(!removed)} className={cn(greyBtn, "px-3 py-1")}>{removed ? "Hide Removed" : "Show Removed"}</button>
      <button onClick={() => setAdding(true)} className={cn(greenBtn, "px-3 py-1")}>Add</button>
    </>
  );
  const modals = (
    <>
      {adding && <AddLender close={() => setAdding(false)} />}
      {pending && <Confirm title="Confirm" yes="Yes" text={`Remove ${pending.name}? It stops showing as a choice on deals; deals that already use it keep the name.`} close={() => setPending(null)} ok={() => run.go(() => setLenderHiddenAction(pending.id, true))} />}
    </>
  );
  return { rows, name, actions, tools, modals, error: <Err text={run.error} /> };
}

function AddLender({ close }: { close: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const run = useRun();
  return (
    <Modal title="Add Lender" close={close} footer={<>
      <button disabled={run.pending} onClick={() => run.go(() => createLenderAction({ name, type }), close)} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px] disabled:opacity-60")}>Save</button>
      <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
    </>}>
      <div className="grid gap-3 text-[12.6px]">
        <label><span className={label}>Lender Name</span><input value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
        <label><span className={label}>Lender Type</span><select value={type} onChange={(e) => setType(e.target.value)} className={input}><option value="">- Select -</option>{lenderTypes.map((t) => <option key={t}>{t}</option>)}</select></label>
        <Err text={run.error} />
      </div>
    </Modal>
  );
}

export function AppLenders({ lenders }: { lenders: LenderRow[] }) {
  const { rows, name, actions, tools, modals, error } = useLenders(lenders);
  return (
    <AppShell>
      <PageHeader icon={Landmark} title="Lenders" crumbs={[["Admin"], ["Lenders"]]} />
      <GridPanel title="Lenders" tools={tools}>
        {error}
        <Grid head={["Name", "Lender Type", "Lender Code", "Group", ""]} rows={rows.map((l) => [name(l), l.type, l.code, l.displayAs, actions(l)])} />
      </GridPanel>
      {modals}
    </AppShell>
  );
}

export function AppLenderMatrix({ lenders, agents }: { lenders: LenderRow[]; agents: Agent[] }) {
  const { rows, name, actions, tools, modals, error } = useLenders(lenders);
  const agentNames = (ids: string[]) => ids.map((id) => agents.find((a) => a.id === id)?.name ?? "Inactive user").join(", ");
  return (
    <AppShell>
      <PageHeader icon={Table2} title="Lender Matrix" crumbs={[["Admin"], ["Lender Matrix"]]} />
      <GridPanel title="Lender Matrix" tools={tools}>
        {error}
        <Grid min={1300} head={["Name", "Underwriter Type", "Allow All Agents", "Submission Agents", ...limitKeys.map(([, n]) => n), "VB", "VB Days", "PB", "PB Days", "II", "II Days", ""]} rows={rows.map((l) => [
          name(l), l.underwriterType, l.allAgents ? "Yes" : "No", l.allAgents ? "All" : agentNames(l.agentIds), ...limitKeys.map(([k]) => limit(l.limits[k])),
          pct(l.fees.vb), l.fees.vbDays ?? 0, pct(l.fees.pb), l.fees.pbDays ?? 0, pct(l.fees.ii), l.fees.iiDays ?? 0, actions(l),
        ])} />
      </GridPanel>
      {modals}
    </AppShell>
  );
}

function Num({ name, text, value, step = "0.001" }: { name: string; text: string; value?: number; step?: string }) {
  return <label><span className={label}>{text}</span><input name={name} type="number" min="0" step={step} defaultValue={value ?? ""} className={input} /></label>;
}

export function AppLenderDetail({ lender, products, agents }: { lender: LenderRow; products: Product[]; agents: Agent[] }) {
  const [underwriters, setUnderwriters] = useState(lender.underwriters);
  const [newUw, setNewUw] = useState("");
  const [allAgents, setAllAgents] = useState(lender.allAgents);
  const [agentIds, setAgentIds] = useState(lender.agentIds);
  const [prod, setProd] = useState<Product | null>(null);
  const [del, setDel] = useState<Product | null>(null);
  const [saved, setSaved] = useState(false);
  const run = useRun();
  const productRun = useRun();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = { ...Object.fromEntries(new FormData(e.currentTarget)), underwriters, allAgents, agentIds };
    run.go(() => saveLenderAction(lender.id, input), () => setSaved(true));
  };
  const addUw = () => { if (newUw.trim() && !underwriters.includes(newUw.trim())) setUnderwriters([...underwriters, newUw.trim()]); setNewUw(""); };
  const sel = (name: string, text: string, options: string[], value: string) => (
    <label><span className={label}>{text}</span><select name={name} defaultValue={value} className={input}>{options.map((o) => <option key={o}>{o}</option>)}</select></label>
  );
  return (
    <AppShell>
      <PageHeader icon={Landmark} title="Edit Lender" crumbs={[["Lenders", "/admin/lenders"], [lender.name]]} />
      <form onSubmit={submit}>
        <GridPanel title={lender.hiddenAt ? `${lender.name} (removed)` : lender.name}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label><span className={label}>Lender Name</span><input name="name" defaultValue={lender.name} required className={input} /></label>
            {sel("type", "Lender Type", lenderTypes, lender.type)}
            <label><span className={label}>Lender Code</span><input name="code" defaultValue={lender.code} className={input} /></label>
            {sel("displayAs", "Display Lender Drop Down As", lenderGroups, lender.displayAs)}
            {sel("underwriterType", "Underwriter Type", underwriterTypes, lender.underwriterType)}
            <label><span className={label}>Default Underwriter</span>
              <select name="defaultUnderwriter" defaultValue={lender.defaultUnderwriter} className={input}><option value="">- None -</option>{underwriters.map((u) => <option key={u}>{u}</option>)}</select>
            </label>
          </div>
          <p className="mt-4 mb-1 font-semibold">Fees <span className="font-normal text-[#999]">Rates in %, e.g. 25 bps is 0.25</span></p>
          <div className="grid gap-3 sm:grid-cols-4">
            {lenderFees.map(([k, n]) => <div key={k} className="grid grid-cols-[1fr_80px] gap-2"><Num name={k} text={`${n} (%)`} value={lender.fees[k]} /><Num name={`${k}Days`} text="Days" step="1" value={lender.fees[`${k}Days`]} /></div>)}
          </div>
          <p className="mt-4 mb-1 font-semibold">Ratio limits <span className="font-normal text-[#999]">Leave blank to use the defaults (GDS 39%, TDS 44%, LTV 95%)</span></p>
          <div className="grid gap-3 sm:grid-cols-3">{limitKeys.map(([k, n]) => <Num key={k} name={k} text={`${n} (%)`} value={lender.limits[k]} />)}</div>
        </GridPanel>
        <GridPanel title="Submission Agents">
          <label className="flex items-center gap-2 py-1"><input type="checkbox" checked={allAgents} onChange={(e) => setAllAgents(e.target.checked)} /> Allow all agents</label>
          {!allAgents && (
            <div className="grid gap-1 sm:grid-cols-3">
              {agents.map((a) => (
                <label key={a.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={agentIds.includes(a.id)} onChange={(e) => setAgentIds(e.target.checked ? [...agentIds, a.id] : agentIds.filter((x) => x !== a.id))} /> {a.name}
                </label>
              ))}
            </div>
          )}
        </GridPanel>
        <GridPanel title="Underwriters">
          <div className="mb-2 flex gap-2">
            <input value={newUw} onChange={(e) => setNewUw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUw(); } }} placeholder="Underwriter name" aria-label="Underwriter name" className={cn(input, "max-w-[300px]")} />
            <button type="button" onClick={addUw} className={cn(greenBtn, "px-3 py-1")}>Add</button>
          </div>
          <Grid min={400} head={["Name", ""]} rows={underwriters.map((u) => [u, <button type="button" key="r" onClick={() => setUnderwriters(underwriters.filter((x) => x !== u))} className={cn(redBtn, small)}>Remove</button>])} />
        </GridPanel>
        {run.error && <p role="alert" className="mx-[25px] mb-2 text-right text-[12.6px] text-[#a94442]">{run.error}</p>}
        <div className="mx-[25px] mb-5 flex justify-end gap-2">
          <Link href="/admin/lenders" className={cn(greyBtn, "px-4 py-1.5 text-[12.6px]")}>Cancel</Link>
          <button disabled={run.pending} className={cn(greenBtn, "px-4 py-1.5 text-[12.6px] disabled:opacity-60")}>{run.pending ? "Saving..." : "Save"}</button>
        </div>
      </form>
      <GridPanel title="Products" tools={<button onClick={() => setProd({ id: "", name: "", term: 5, fees: {} })} className={cn(greenBtn, "px-3 py-1")}>Add</button>}>
        <p className="mb-2 text-[#999]">Products save as soon as you save them here.</p>
        <Err text={productRun.error} />
        <Grid min={1000} head={["Name", "Term (yrs)", ...productFees.map(([, , a]) => `${a} (days)`), ""]} rows={products.map((p) => [
          p.name, p.term, ...productFees.map(([k]) => `${pct(p.fees[k])} (${p.fees[`${k}Days`] ?? 0})`),
          <span key="a" className="flex gap-1"><button onClick={() => setProd(p)} className={cn(blueBtn, small)}>Edit</button><button onClick={() => setDel(p)} className={cn(redBtn, small)}>Delete</button></span>,
        ])} />
      </GridPanel>
      <Saved show={saved} close={() => setSaved(false)} />
      {prod && <ProductModal lenderId={lender.id} product={prod} close={() => setProd(null)} />}
      {del && <Confirm title="Confirm" yes="Yes" text={`Delete ${del.name}? Deals that already use it keep the name.`} close={() => setDel(null)} ok={() => productRun.go(() => deleteProductAction(lender.id, del.id))} />}
    </AppShell>
  );
}

function ProductModal({ lenderId, product, close }: { lenderId: string; product: Product; close: () => void }) {
  const run = useRun();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const p = Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v)]));
    run.go(() => saveProductAction(lenderId, product.id || null, p), close);
  };
  return (
    <Modal wide title={product.id ? "Edit Product" : "New Product"} close={close} footer={<>
      <button form="product-form" disabled={run.pending} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px] disabled:opacity-60")}>Save</button>
      <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
    </>}>
      <form id="product-form" onSubmit={submit} className="grid gap-3 text-[12.6px] sm:grid-cols-2">
        <label><span className={label}>Name</span><input name="name" defaultValue={product.name} className={input} /></label>
        <Num name="term" text="Term (years)" step="1" value={product.term} />
        {productFees.map(([k, n]) => <div key={k} className="grid grid-cols-[1fr_90px] gap-2"><Num name={k} text={`${n} (%)`} value={product.fees[k]} /><Num name={`${k}Days`} text="Days" step="1" value={product.fees[`${k}Days`]} /></div>)}
        <div className="sm:col-span-2"><Err text={run.error} /></div>
      </form>
    </Modal>
  );
}
