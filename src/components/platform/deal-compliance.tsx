"use client";

import { createContext, useContext, useRef, useState, useTransition } from "react";
import { saveAmlAction, setComplianceAction } from "@/app/deal/actions";
import type { DealCompliance as Compliance } from "@/server/compliance";
import { amlQuestions, complianceLabels, riskLabels, screeningLabels, type ComplianceStatus, type Screening } from "./aml-fields";

export const ComplianceContext = createContext<Compliance | null>(null);

const control = "h-[30px] w-full rounded-[3px] border border-[#ccc] bg-white px-2 text-[12.6px] text-[#555] outline-none focus:border-[#66afe9] disabled:bg-[#eee]";
const btn = "rounded-[3px] border border-[#3d81be] bg-gradient-to-b from-[#428bcd] to-[#3d81be] px-[13px] py-1.5 text-[12.6px] text-white disabled:opacity-60";
const greyBtn = "rounded-[3px] border border-[#ccc] bg-white px-[13px] py-1.5 text-[12.6px] text-[#333] disabled:opacity-60";
const cell = "border-t border-[#ddd] p-2";
const riskColour = { low: "text-[#3c763d]", medium: "text-[#8a6d3b]", high: "font-semibold text-[#a94442]" };

const Alert = ({ text }: { text: string }) =>
  text ? <p role="alert" className="mb-2 rounded-[3px] border border-[#ebccd1] bg-[#f2dede] px-3 py-2 text-[12.6px] text-[#a94442]">{text}</p> : null;

// Manage Compliance: status, note and package lock in a modal. Used on the deal and the compliance dashboard.
// Every button is type="button": on the deal this sits inside the deal form and must not submit it.
export function ManageCompliance({ dealId, status, locked }: { dealId: string; status: ComplianceStatus; locked: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [s, setS] = useState(status);
  const [note, setNote] = useState("");
  const [lock, setLock] = useState(locked);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const open = () => {
    setS(status); setNote(""); setLock(locked); setError("");
    dialog.current?.showModal();
  };
  const save = () => start(async () => {
    const r = await setComplianceAction(dealId, { status: s, note, locked: lock });
    setError(r.error ?? "");
    if (!r.error) dialog.current?.close();
  });
  return (
    <>
      <button type="button" className={btn} onClick={open}>Manage Compliance</button>
      <dialog ref={dialog} aria-labelledby={`mc-${dealId}`} className="m-auto w-[min(480px,calc(100vw-32px))] rounded-[4px] p-0 text-left shadow-xl backdrop:bg-black/40">
        <div className="border-b border-[#e5e5e5] px-4 py-3"><h3 id={`mc-${dealId}`} className="text-lg text-[#333]">Manage Compliance</h3></div>
        <div className="space-y-3 px-4 py-3 text-[12.6px] text-[#666]">
          <Alert text={error} />
          <label className="block">
            <span className="mb-1 block font-semibold">Compliance Status</span>
            <select value={s} className={control} onChange={(e) => { const v = e.target.value as ComplianceStatus; setS(v); if (v !== "compliant") setLock(false); }}>
              {Object.entries(complianceLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold">Note{s === "non_compliant" && " (required)"}</span>
            <textarea value={note} maxLength={1000} rows={3} onChange={(e) => setNote(e.target.value)} className={`${control} h-auto py-1`} />
          </label>
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={lock} disabled={s !== "compliant"} onChange={(e) => setLock(e.target.checked)} /> Lock package
          </label>
          <p className="text-[12px] text-[#999]">Compliant needs every borrower&apos;s AML assessment and sanction screening. A locked package freezes the deal&apos;s conditions, documents and AML answers.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e5e5e5] px-4 py-3">
          <button type="button" className={greyBtn} onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="button" className={btn} disabled={busy} onClick={save}>Save</button>
        </div>
      </dialog>
    </>
  );
}

type Borrower = Compliance["borrowers"][number];

// One borrower's questionnaire. Controlled inputs with no names, so the deal form's Save never posts them.
function AmlForm({ dealId, b, done }: { dealId: string; b: Borrower; done: () => void }) {
  const a = b.assessment;
  const [answers, setAnswers] = useState<Record<string, string>>(a?.answers ?? {});
  const [screening, setScreening] = useState<Screening>(a?.screening ?? "not_screened");
  const [list, setList] = useState(a?.screeningList ?? "");
  const [on, setOn] = useState(a?.screenedOn ?? "");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const save = () => start(async () => {
    const r = await saveAmlAction(dealId, b.contactId, { ...answers, screening, screeningList: list, screenedOn: on });
    setError(r.error ?? "");
    if (!r.error) done();
  });
  return (
    <div className="mt-2 space-y-3 rounded-[3px] border border-[#ddd] bg-[#fafafa] p-3 text-[12.6px] text-[#666]">
      <Alert text={error} />
      {amlQuestions.map((q) => (
        <label key={q.key} className="block">
          <span className="mb-1 block font-semibold">{q.label}</span>
          <select value={answers[q.key] ?? ""} className={control} onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}>
            <option value="">Select...</option>
            {q.options.map(([o]) => <option key={o}>{o}</option>)}
          </select>
        </label>
      ))}
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 font-semibold">Sanction screening (record a check done outside Keyway)</legend>
        <label className="block">
          <span className="mb-1 block">Result</span>
          <select value={screening} className={control} onChange={(e) => setScreening(e.target.value as Screening)}>
            {Object.entries(screeningLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block">Lists checked</span>
          <input value={list} maxLength={200} disabled={screening === "not_screened"} onChange={(e) => setList(e.target.value)} className={control} />
        </label>
        <label className="block">
          <span className="mb-1 block">Screened on</span>
          <input type="date" value={on} disabled={screening === "not_screened"} onChange={(e) => setOn(e.target.value)} className={control} />
        </label>
      </fieldset>
      <div className="flex gap-2">
        <button type="button" className={btn} disabled={busy} onClick={save}>Save Assessment</button>
        <button type="button" className={greyBtn} onClick={done}>Cancel</button>
      </div>
    </div>
  );
}

export function DealCompliance() {
  const c = useContext(ComplianceContext);
  const [editing, setEditing] = useState<string | null>(null);
  if (!c) return null;
  const locked = !!c.lockedAt;
  return (
    <div className="space-y-4 text-[12.6px]">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span><b>Compliance Status:</b> {complianceLabels[c.status]}</span>
        <span><b>Package:</b> {locked ? `Locked ${new Date(c.lockedAt!).toLocaleDateString("en-CA")}` : "Unlocked"}</span>
        {c.canReview && <ManageCompliance dealId={c.dealId} status={c.status} locked={locked} />}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>{["Date Sent", "Actioned by", "Compliance Status", "Note", "Package"].map((h) => <th key={h} className="border-b-2 border-[#ddd] p-2 text-left font-bold whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody>
            {c.reviews.length ? c.reviews.map((r, i) => (
              <tr key={i} className="odd:bg-[#f9f9f9]">
                <td className={cell}>{new Date(r.at).toLocaleString("en-CA")}</td>
                <td className={cell}>{r.by}</td>
                <td className={cell}>{complianceLabels[r.status]}</td>
                <td className={`${cell} whitespace-pre-wrap`}>{r.note}</td>
                <td className={cell}>{r.locked ? "Locked" : "Unlocked"}</td>
              </tr>
            )) : <tr><td colSpan={5} className={`${cell} text-center text-[#999]`}>No records found.</td></tr>}
          </tbody>
        </table>
      </div>

      <div>
        <h5 className="mb-1 font-semibold text-[#444]">AML Risk Assessment</h5>
        <ul className="divide-y divide-[#eee]">
          {c.borrowers.map((b) => (
            <li key={b.contactId} className="py-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="min-w-40 font-semibold">{b.name}</span>
                {b.assessment ? (
                  <>
                    <span>Risk: <span className={riskColour[b.assessment.risk]}>{riskLabels[b.assessment.risk]}</span></span>
                    <span>Screening: {screeningLabels[b.assessment.screening]}</span>
                    <span className="text-[#999]">{b.assessment.by} · {new Date(b.assessment.updatedAt).toLocaleDateString("en-CA")}</span>
                  </>
                ) : <span className="text-[#999]">Not assessed</span>}
                {!locked && editing !== b.contactId && (
                  <button type="button" className="text-[#428bca] hover:underline" onClick={() => setEditing(b.contactId)}>{b.assessment ? "Edit" : "Assess"}</button>
                )}
              </div>
              {editing === b.contactId && <AmlForm dealId={c.dealId} b={b} done={() => setEditing(null)} />}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[12px] text-[#999]">The risk is worked out from the answers. Automated sanction-list screening is not connected; record checks done elsewhere.</p>
      </div>
    </div>
  );
}
