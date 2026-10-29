"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { createTaskAction, removeTaskAction, updateTaskAction } from "@/app/deal/actions";
import { cn } from "@/lib/utils";
import type { dealTasks, TaskType } from "@/server/tasks";

export type DealTaskList = Awaited<ReturnType<typeof dealTasks>>;
export const TasksContext = createContext<DealTaskList | null>(null);

const control = "h-[30px] rounded-[3px] border border-[#ccc] bg-white px-2 text-[12.6px] text-[#555] outline-none focus:border-[#66afe9] disabled:bg-[#eee]";
const btn = "rounded-[3px] border border-[#3d81be] bg-gradient-to-b from-[#428bcd] to-[#3d81be] px-[13px] py-1.5 text-[12.6px] text-white disabled:opacity-60";
const taskTypes: [TaskType, string][] = [["phone", "Phone call"], ["sms", "SMS"], ["email", "Email"], ["appointment", "Appointment"], ["other", "Other"]];

// Reminders are follow-up tasks; Deal Specific Tasks are every other type. Like DealConditions this sits
// inside the deal form: buttons are type="button" and inputs have no name, so nothing is posted with Save.
export function DealTasks({ kind }: { kind: "reminders" | "tasks" }) {
  const data = useContext(TasksContext);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const [draft, setDraft] = useState({ type: "phone" as TaskType, title: "", dueDate: "", assigneeId: "" });
  if (!data) return null;

  const rows = data.tasks.filter((t) => (t.type === "followup") === (kind === "reminders"));
  const act = (fn: () => Promise<{ error?: string }>, then?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? "");
      if (!r.error) then?.();
    });
  const add = () =>
    act(
      () => createTaskAction({ ...draft, type: kind === "reminders" ? "followup" : draft.type, dealId: data.dealId, assigneeId: draft.assigneeId || undefined }),
      () => setDraft({ ...draft, title: "", dueDate: "" }),
    );
  const th = "border border-[#ddd] bg-[#f9f9f9] px-2 py-1.5 text-left font-semibold";
  const td = "border border-[#ddd] px-2 py-1.5";

  return (
    <div className={cn("text-[12.6px]", busy && "opacity-70")}>
      {error && <p role="alert" className="mb-2 rounded-[3px] border border-[#ebccd1] bg-[#f2dede] px-3 py-2 text-[#a94442]">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr>{[kind === "reminders" ? "Date" : "Deadline", kind === "reminders" ? "Reminder" : "Title", "Assigned To", "Actions"].map((c) => <th key={c} className={th}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td className={td}>{t.dueDate}{t.dueTime && ` ${t.dueTime}`}</td>
                <td className={td}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={t.done} onChange={(e) => act(() => updateTaskAction(t.id, { done: e.target.checked }))} aria-label="Done" />
                    <span className={cn(t.done && "line-through")}>{t.title}</span>
                  </label>
                </td>
                <td className={td}>
                  <select value={t.assigneeId} onChange={(e) => act(() => updateTaskAction(t.id, { assigneeId: e.target.value }))} className={control} aria-label="Assigned to">
                    {data.assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </td>
                <td className={td}>
                  <button type="button" onClick={() => act(() => removeTaskAction(t.id))} className="text-[#d9534f] hover:underline">Remove</button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className={cn(td, "text-[#999]")}>No {kind === "reminders" ? "reminders" : "tasks"} yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} className={control} aria-label="Due date" />
        {kind === "tasks" && (
          <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as TaskType })} className={control} aria-label="Type">
            {taskTypes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        <input value={draft.title} maxLength={200} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={kind === "reminders" ? "Reminder" : "Title"} className={cn(control, "min-w-[180px] flex-1")} />
        <select value={draft.assigneeId} onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })} className={control} aria-label="Assign to">
          <option value="">Me</option>
          {data.assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button type="button" disabled={busy || !draft.title.trim() || !draft.dueDate} onClick={add} className={btn}>
          {kind === "reminders" ? "Add Reminder" : "Add Task"}
        </button>
      </div>
    </div>
  );
}
