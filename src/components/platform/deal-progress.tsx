"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { aftercareDoneAction, completeStepAction, createStepTasksAction, reopenStepAction, saveAftercareAction } from "@/app/deal/actions";
import { cn } from "@/lib/utils";
import type { dealProgress } from "@/server/progress";
import { btn, control } from "./deal-tasks";

export type Progress = Awaited<ReturnType<typeof dealProgress>>;
export const ProgressContext = createContext<Progress | null>(null);

// The deal's progress steps for its Application Type. Sits inside the deal form like DealTasks: type="button", unnamed inputs.
export function DealProgress() {
  const data = useContext(ProgressContext);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const [dates, setDates] = useState<Record<string, string>>({});
  if (!data) return null;

  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? "");
    });
  const now = new Date().toLocaleDateString("en-CA");
  const th = "border border-[#ddd] bg-[#f9f9f9] px-2 py-1.5 text-left font-semibold";
  const td = "border border-[#ddd] px-2 py-1.5 align-top";

  if (!data.dealType) return <p className="text-[12.6px] text-[#999]">Set the Application Type on the Mortgage Requests tab to see this deal&apos;s progress steps.</p>;
  return (
    <div className={cn("text-[12.6px]", busy && "opacity-70")}>
      {error && <p role="alert" className="mb-2 rounded-[3px] border border-[#ebccd1] bg-[#f2dede] px-3 py-2 text-[#a94442]">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead><tr>{["Step", "Target", "Needs", "Todos", "Completed", ""].map((c) => <th key={c} className={th}>{c}</th>)}</tr></thead>
          <tbody>
            {data.steps.map((s) => (
              <tr key={s.id}>
                <td className={td}>
                  {s.name}
                  {s.milestone && <span className="ml-1.5 rounded bg-[#f0ad4e] px-1.5 py-0.5 text-[11px] text-white">Milestone</span>}
                </td>
                <td className={cn(td, !s.completedOn && s.target < now && "text-[#d9534f]")}>{s.target}</td>
                <td className={td}>{s.prerequisite ?? "-"}</td>
                <td className={td}>
                  {s.todos.length || s.autoMessage ? (
                    <>
                      <ul className="list-disc pl-4">{s.todos.map((t) => <li key={t}>{t}</li>)}{s.autoMessage && <li>Auto message (reminder task)</li>}</ul>
                      {s.tasksCreated ? <span className="text-[#5cb85c]">Tasks created</span> : (
                        <button type="button" disabled={busy} onClick={() => act(() => createStepTasksAction(data.dealId, s.id))} className="text-[#428bca] hover:underline">Create Tasks</button>
                      )}
                    </>
                  ) : "-"}
                </td>
                <td className={td}>
                  {s.completedOn ?? (
                    <input type="date" value={dates[s.id] ?? now} onChange={(e) => setDates({ ...dates, [s.id]: e.target.value })} className={cn(control, "w-[140px]")} aria-label={`${s.name} completed on`} />
                  )}
                </td>
                <td className={td}>
                  {s.completedOn
                    ? <button type="button" disabled={busy} onClick={() => act(() => reopenStepAction(data.dealId, s.id))} className="text-[#d9534f] hover:underline">Reopen</button>
                    : <button type="button" disabled={busy} onClick={() => act(() => completeStepAction(data.dealId, s.id, dates[s.id] ?? now))} className={btn}>Complete</button>}
                </td>
              </tr>
            ))}
            {!data.steps.length && <tr><td colSpan={6} className={cn(td, "text-[#999]")}>No progress steps for {data.dealType} deals yet. An org admin adds them under Progress Steps.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// The deal's After Care items: add one, mark a due one done (moves it on one period), turn one off or back on.
export function DealAftercare() {
  const data = useContext(ProgressContext);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const blank = { label: "", nextDate: "", periodMonths: "12", maxTimes: "0" };
  const [form, setForm] = useState(blank);
  if (!data) return null;

  const act = (fn: () => Promise<{ error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? "");
      if (!r.error) after?.();
    });
  const now = new Date().toLocaleDateString("en-CA");
  const th = "border border-[#ddd] bg-[#f9f9f9] px-2 py-1.5 text-left font-semibold";
  const td = "border border-[#ddd] px-2 py-1.5 align-top";
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className={cn("text-[12.6px]", busy && "opacity-70")}>
      {error && <p role="alert" className="mb-2 rounded-[3px] border border-[#ebccd1] bg-[#f2dede] px-3 py-2 text-[#a94442]">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead><tr>{["Label", "Next Date", "Period", "Done", "Status", ""].map((c) => <th key={c} className={th}>{c}</th>)}</tr></thead>
          <tbody>
            {data.aftercare.map((a) => (
              <tr key={a.id}>
                <td className={td}>{a.label}</td>
                <td className={cn(td, a.active && a.nextDate < now && "text-[#d9534f]")}>{a.nextDate}</td>
                <td className={td}>{a.periodMonths ? `Every ${a.periodMonths} month${a.periodMonths > 1 ? "s" : ""}` : "Once"}</td>
                <td className={td}>{a.timesDone}{a.maxTimes ? ` of ${a.maxTimes}` : ""}</td>
                <td className={td}>{a.active ? "Active" : "Off"}</td>
                <td className={cn(td, "space-x-3")}>
                  {a.active && a.nextDate <= now && <button type="button" disabled={busy} onClick={() => act(() => aftercareDoneAction(a.id))} className="text-[#428bca] hover:underline">Mark Done</button>}
                  <button type="button" disabled={busy} onClick={() => act(() => saveAftercareAction(data.dealId, a.id, { ...a, active: !a.active }))} className="text-[#428bca] hover:underline">{a.active ? "Turn Off" : "Turn On"}</button>
                </td>
              </tr>
            ))}
            {!data.aftercare.length && <tr><td colSpan={6} className={cn(td, "text-[#999]")}>No after care items on this deal.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <input value={form.label} onChange={set("label")} placeholder="Label, e.g. Annual review" aria-label="After care label" maxLength={100} className={cn(control, "w-[220px]")} />
        <input type="date" value={form.nextDate} onChange={set("nextDate")} aria-label="Next date" className={cn(control, "w-[140px]")} />
        <label className="flex items-center gap-1">Every <input type="number" min={0} max={120} value={form.periodMonths} onChange={set("periodMonths")} aria-label="Period in months" className={cn(control, "w-[60px]")} /> months</label>
        <label className="flex items-center gap-1">Max <input type="number" min={0} max={100} value={form.maxTimes} onChange={set("maxTimes")} aria-label="Max times" className={cn(control, "w-[60px]")} /> times</label>
        <button type="button" disabled={busy} onClick={() => act(() => saveAftercareAction(data.dealId, null, { ...form, active: true }), () => setForm(blank))} className={btn}>Add</button>
      </div>
      <p className="mt-2 text-[#999]">Due items show on My Day. Keyway doesn&apos;t contact the client; mark an item done after you do. Period 0 means once, Max 0 means no limit.</p>
    </div>
  );
}
