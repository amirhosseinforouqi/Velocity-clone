"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { money } from "./shell";
import { greyBtn, input, label, Modal } from "./ui";

export const calculators = ["Scenario Builder", "Mortgage Calculator", "Purchase Calculator", "Closing Costs Calculator", "Land Transfer Calculator"] as const;
export type CalcKind = (typeof calculators)[number];

// Canadian fixed-rate mortgages compound semi-annually.
export function monthlyPayment(principal: number, ratePct: number, years: number) {
  const n = years * 12;
  const r = Math.pow(1 + ratePct / 200, 1 / 6) - 1;
  return r ? (principal * r) / (1 - Math.pow(1 + r, -n)) : principal / n;
}

// Ontario provincial land transfer tax (residential brackets).
export function ontarioLtt(price: number) {
  const brackets: [number, number][] = [[55_000, 0.005], [250_000, 0.01], [400_000, 0.015], [2_000_000, 0.02], [Infinity, 0.025]];
  let tax = 0, prev = 0;
  for (const [cap, rate] of brackets) { tax += Math.max(0, Math.min(price, cap) - prev) * rate; prev = cap; }
  return tax;
}

// CMHC premium as a share of the loan, by down payment percentage.
export function cmhcRate(downPct: number) {
  return downPct >= 20 ? 0 : downPct >= 15 ? 0.028 : downPct >= 10 ? 0.031 : 0.04;
}

const cents = (n: number) => "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Num({ name, value, set, step }: { name: string; value: number; set: (n: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className={label}>{name}</span>
      <input type="number" min={0} step={step ?? 1} value={value} onChange={(e) => set(Number(e.target.value))} className={input} />
    </label>
  );
}

function Out({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-4 divide-y divide-[#eee] rounded-[3px] border border-[#ddd] text-[12.6px]">
      {rows.map(([k, v], i) => (
        <div key={k} className={cn("flex justify-between p-2", i === rows.length - 1 && "bg-[#f5f5f5] font-semibold")}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

function Mortgage() {
  const [amount, setAmount] = useState(500_000);
  const [rate, setRate] = useState(4.99);
  const [years, setYears] = useState(25);
  const pay = monthlyPayment(amount, rate, years);
  return <>
    <div className="grid gap-3 sm:grid-cols-3"><Num name="Mortgage Amount" value={amount} set={setAmount} /><Num name="Interest Rate (%)" value={rate} set={setRate} step={0.01} /><Num name="Amortization (years)" value={years} set={setYears} /></div>
    <Out rows={[["Bi-weekly Payment", cents((pay * 12) / 26)], ["Accelerated Bi-weekly", cents(pay / 2)], ["Total Interest", cents(pay * years * 12 - amount)], ["Monthly Payment", cents(pay)]]} />
  </>;
}

function Purchase() {
  const [price, setPrice] = useState(750_000);
  const [down, setDown] = useState(10);
  const [rate, setRate] = useState(4.99);
  const [years, setYears] = useState(25);
  const base = price * (1 - down / 100);
  const premium = base * cmhcRate(down);
  return <>
    <div className="grid gap-3 sm:grid-cols-2"><Num name="Purchase Price" value={price} set={setPrice} /><Num name="Down Payment (%)" value={down} set={setDown} step={0.5} /><Num name="Interest Rate (%)" value={rate} set={setRate} step={0.01} /><Num name="Amortization (years)" value={years} set={setYears} /></div>
    {down < 5 && <p className="mt-2 text-xs text-[#a94442]">Minimum down payment is 5%.</p>}
    <Out rows={[["Down Payment", money(Math.round(price * down / 100))], ["CMHC Insurance", cents(premium)], ["Total Mortgage", cents(base + premium)], ["Monthly Payment", cents(monthlyPayment(base + premium, rate, years))]]} />
  </>;
}

function Closing() {
  const [price, setPrice] = useState(750_000);
  const [legal, setLegal] = useState(1_500);
  const [title, setTitle] = useState(350);
  const [inspection, setInspection] = useState(500);
  const [other, setOther] = useState(800);
  const ltt = ontarioLtt(price);
  return <>
    <div className="grid gap-3 sm:grid-cols-2"><Num name="Purchase Price" value={price} set={setPrice} /><Num name="Legal Fees" value={legal} set={setLegal} /><Num name="Title Insurance" value={title} set={setTitle} /><Num name="Home Inspection" value={inspection} set={setInspection} /><Num name="Adjustments & Other" value={other} set={setOther} /></div>
    <Out rows={[["Land Transfer Tax", cents(ltt)], ["Fees", cents(legal + title + inspection + other)], ["Total Closing Costs", cents(ltt + legal + title + inspection + other)]]} />
  </>;
}

function LandTransfer() {
  const [price, setPrice] = useState(750_000);
  const [toronto, setToronto] = useState(false);
  const [firstTime, setFirstTime] = useState(false);
  // ponytail: Toronto's municipal tax mirrors the provincial brackets below $3M; luxury tiers above that are not modelled.
  const prov = ontarioLtt(price), muni = toronto ? ontarioLtt(price) : 0;
  const rebate = firstTime ? Math.min(prov, 4_000) + Math.min(muni, 4_475) : 0;
  return <>
    <Num name="Purchase Price" value={price} set={setPrice} />
    <label className="mt-3 flex items-center gap-2 text-[12.6px]"><input type="checkbox" checked={toronto} onChange={(e) => setToronto(e.target.checked)} /> Property is in Toronto</label>
    <label className="mt-1 flex items-center gap-2 text-[12.6px]"><input type="checkbox" checked={firstTime} onChange={(e) => setFirstTime(e.target.checked)} /> First-time home buyer</label>
    <Out rows={[["Provincial Tax", cents(prov)], ["Municipal Tax", cents(muni)], ["First-time Buyer Rebate", "-" + cents(rebate)], ["Total Land Transfer Tax", cents(prov + muni - rebate)]]} />
  </>;
}

function Scenarios() {
  const [rows, setRows] = useState([{ amount: 500_000, rate: 4.79, years: 25 }, { amount: 500_000, rate: 5.19, years: 30 }]);
  const set = (i: number, k: "amount" | "rate" | "years", v: number) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return <>
    <div className="grid gap-3 sm:grid-cols-3">
      {rows.map((r, i) => {
        const pay = monthlyPayment(r.amount, r.rate, r.years);
        return (
          <div key={i} className="rounded-[3px] border border-[#ddd] p-2">
            <div className="mb-2 flex items-center font-semibold">Scenario {i + 1}
              {rows.length > 1 && <button onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove scenario" className="ml-auto text-[#999]">×</button>}
            </div>
            <div className="space-y-2"><Num name="Amount" value={r.amount} set={(v) => set(i, "amount", v)} /><Num name="Rate (%)" value={r.rate} set={(v) => set(i, "rate", v)} step={0.01} /><Num name="Amortization" value={r.years} set={(v) => set(i, "years", v)} /></div>
            <Out rows={[["Total Interest", money(Math.round(pay * r.years * 12 - r.amount))], ["Monthly", cents(pay)]]} />
          </div>
        );
      })}
    </div>
    {rows.length < 3 && <button onClick={() => setRows([...rows, rows[rows.length - 1]])} className={cn(greyBtn, "mt-3 px-3 py-1 text-[12.6px]")}>+ Add Scenario</button>}
  </>;
}

const bodies: Record<CalcKind, () => ReactNode> = {
  "Scenario Builder": Scenarios,
  "Mortgage Calculator": Mortgage,
  "Purchase Calculator": Purchase,
  "Closing Costs Calculator": Closing,
  "Land Transfer Calculator": LandTransfer,
};

export function CalculatorModal({ kind, close }: { kind: CalcKind; close: () => void }) {
  const Body = bodies[kind];
  return <Modal title={kind} close={close} wide={kind === "Scenario Builder"} footer={<button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Close</button>}><Body /></Modal>;
}
