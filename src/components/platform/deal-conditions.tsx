"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { addConditionAction, removeDocumentAction, setConditionStatusAction, uploadDocumentAction } from "@/app/deal/actions";
import type { dealChecklist } from "@/server/conditions";

export type Checklist = Awaited<ReturnType<typeof dealChecklist>>;
export const ChecklistContext = createContext<Checklist | null>(null);

const MAX_UPLOAD = 10 * 1024 * 1024; // the server's limit (conditions.ts); checked here only to fail fast
const statuses = [["outstanding", "Outstanding"], ["received", "Received"], ["met", "Met"], ["waived", "Waived"]] as const;
const control = "h-[30px] rounded-[3px] border border-[#ccc] bg-white px-2 text-[12.6px] text-[#555] outline-none focus:border-[#66afe9] disabled:bg-[#eee]";
const btn = "rounded-[3px] border border-[#3d81be] bg-gradient-to-b from-[#428bcd] to-[#3d81be] px-[13px] py-1.5 text-[12.6px] text-white disabled:opacity-60";
const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

// Sits inside the deal form, so every button is type="button" and no input has a name: none of this is posted with Save.
// Each change calls its own action; the page then re-renders with the stored checklist.
export function DealConditions() {
  const list = useContext(ChecklistContext);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const [custom, setCustom] = useState("");
  const [template, setTemplate] = useState("");
  if (!list) return null;

  const act = (fn: () => Promise<{ error?: string }>, then?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? "");
      if (!r.error) then?.();
    });
  const upload = (conditionId: string, input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD) return setError("Files must be 10 MB or less");
    const form = new FormData();
    form.set("file", file);
    act(() => uploadDocumentAction(conditionId, form));
  };
  const addCustom = () => custom.trim() && act(() => addConditionAction(list.dealId, { name: custom }), () => setCustom(""));

  return (
    // A locked package (compliance) disables every control here; downloads still work.
    <fieldset aria-busy={busy} disabled={list.locked} className="min-w-0">
      {list.locked && <p className="mb-2 rounded-[3px] border border-[#bce8f1] bg-[#d9edf7] px-3 py-2 text-[12.6px] text-[#31708f]">The package is locked by compliance. Conditions and documents can&apos;t be changed until a reviewer unlocks it.</p>}
      {error && <p role="alert" className="mb-2 rounded-[3px] border border-[#ebccd1] bg-[#f2dede] px-3 py-2 text-[12.6px] text-[#a94442]">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-[12.6px]">
          <thead>
            <tr>{["Condition", "Documents", "Status"].map((c) => <th key={c} className="border-b-2 border-[#ddd] p-2 text-left font-bold">{c}</th>)}</tr>
          </thead>
          <tbody>
            {list.conditions.length ? list.conditions.map((c) => (
              <tr key={c.id} className="align-top odd:bg-[#f9f9f9]">
                <td className="border-t border-[#ddd] p-2">{c.name}</td>
                <td className="border-t border-[#ddd] p-2">
                  <ul className="space-y-1">
                    {c.documents.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center gap-x-2">
                        <a href={`/api/documents/${d.id}`} className="text-[#428bca] hover:underline">{d.fileName}</a>
                        <span className="text-[#999]">{size(d.size)} · {d.by} · {new Date(d.at).toLocaleDateString("en-CA")}</span>
                        <button type="button" disabled={busy} onClick={() => confirm(`Remove ${d.fileName}?`) && act(() => removeDocumentAction(d.id))} className="text-[#a94442] hover:underline disabled:opacity-60">Remove</button>
                      </li>
                    ))}
                  </ul>
                  <label className="mt-1 inline-block cursor-pointer text-[#428bca] hover:underline">
                    Upload…
                    <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} className="sr-only" aria-label={`Upload a document for ${c.name}`} onChange={(e) => upload(c.id, e.currentTarget)} />
                  </label>
                </td>
                <td className="border-t border-[#ddd] p-2">
                  <select aria-label={`Status of ${c.name}`} value={c.status} disabled={busy} className={control} onChange={(e) => act(() => setConditionStatusAction(c.id, e.target.value))}>
                    {statuses.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={3} className="border-t border-[#ddd] p-2 text-center text-[#999]">No conditions yet. Library conditions are added automatically when the deal is saved as an application.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <select aria-label="Condition from the library" value={template} onChange={(e) => setTemplate(e.target.value)} className={control}>
          <option value="">Add from library...</option>
          {list.library.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button type="button" disabled={busy || !template} className={btn} onClick={() => act(() => addConditionAction(list.dealId, { templateId: template }), () => setTemplate(""))}>Add</button>
        <input
          aria-label="Custom condition"
          placeholder="Custom condition"
          value={custom}
          maxLength={200}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          className={control}
        />
        <button type="button" disabled={busy || !custom.trim()} className={btn} onClick={addCustom}>Add Custom</button>
      </div>
      <p className="mt-2 text-[12px] text-[#999]">PDF, JPEG or PNG, up to 10 MB. Files are not virus-scanned yet.</p>
    </fieldset>
  );
}
