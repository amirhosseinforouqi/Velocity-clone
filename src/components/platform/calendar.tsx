"use client";

import { useState, useTransition, type DragEvent } from "react";
import { Bell, Bookmark, CalendarDays, CalendarRange, CircleEllipsis, Link2, Mail, MessageSquareText, Phone, Star, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createTaskAction, removeTaskAction, updateTaskAction } from "@/app/deal/actions";
import { addDays, type CalendarView } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { dealCode } from "@/server/deal-status";
import type { TaskRow, TaskType } from "@/server/tasks";
import { AppShell } from "./shell";

const types: Record<TaskType, { label: string; icon: LucideIcon; bg: string; border: string }> = {
  phone: { label: "Phone call", icon: Phone, bg: "#006596", border: "#005077" },
  sms: { label: "SMS", icon: MessageSquareText, bg: "#1b7f8c", border: "#14616b" },
  email: { label: "Email", icon: Mail, bg: "#2c4e86", border: "#213d6b" },
  followup: { label: "Followup", icon: Bookmark, bg: "#5a98cd", border: "#3473a9" },
  appointment: { label: "Appointment", icon: Bell, bg: "#64ab23", border: "#528b1e" },
  personal: { label: "Personal", icon: Star, bg: "#68468f", border: "#51376f" },
  other: { label: "Other", icon: CircleEllipsis, bg: "#6f6f6f", border: "#555555" },
};

const pad = (n: number) => String(n).padStart(2, "0");
// FullCalendar's "h:mma" with the last character trimmed, e.g. "10:00a".
const timeLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)}${h < 12 ? "a" : "p"}`;
};
const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
const fmt = (day: string, o: Intl.DateTimeFormatOptions) => new Date(day + "T00:00Z").toLocaleDateString("en-US", { ...o, timeZone: "UTC" });

function shiftMonth(day: string, n: number) {
  const d = new Date(day.slice(0, 8) + "01T00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function title(view: CalendarView, cursor: string, days: string[]) {
  if (view === "month") return fmt(cursor, { month: "long", year: "numeric" });
  if (view === "day") return fmt(cursor, { month: "long", day: "numeric", year: "numeric" });
  const [s, e] = [days[0], days[6]];
  return s.slice(5, 7) === e.slice(5, 7)
    ? `${fmt(s, { month: "short", day: "numeric" })} – ${Number(e.slice(8))}, ${e.slice(0, 4)}`
    : `${fmt(s, { month: "short", day: "numeric" })} – ${fmt(e, { month: "short", day: "numeric" })}, ${e.slice(0, 4)}`;
}

const card = "rounded-[2px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]";
const cardTitle = "flex items-center gap-2 px-5 pt-[15px] pr-2.5 text-[21px] font-light text-[#666]";
const fcBtn = "border border-[#2c3e50] bg-[#2c3e50] px-2 py-[5px] text-[12.6px] text-white hover:bg-[#1e2b37] disabled:opacity-65";
const input = "h-[30px] w-full rounded-[3px] border border-[#ccc] px-2 text-[12.6px] text-[#555] outline-none focus:border-[#66afe9]";
const dragMove = (t: TaskRow) => (e: DragEvent) => e.dataTransfer.setData("text/plain", `move:${t.id}`);

function Chip({ t, onOpen }: { t: TaskRow; onOpen: () => void }) {
  const c = types[t.type];
  // Timed tasks in the month grid show as a coloured dot, like FullCalendar's list-item display.
  return !t.dueTime ? (
    <button draggable onDragStart={dragMove(t)} onClick={onOpen} style={{ background: c.bg, borderColor: c.border }} className={cn("mb-px block w-full truncate rounded-[3px] border px-1 text-left text-[11.5px] text-white", t.done && "line-through opacity-70")}>
      {t.title}
    </button>
  ) : (
    <button draggable onDragStart={dragMove(t)} onClick={onOpen} className={cn("mb-px flex w-full items-center gap-1 truncate rounded-[3px] px-1 text-left text-[11.5px] text-[#333] hover:bg-black/5", t.done && "line-through opacity-70")}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: c.bg }} />
      <span>{timeLabel(t.dueTime)}</span>
      <b className="truncate">{t.title}</b>
    </button>
  );
}

function EditModal({ t, save, remove, close }: { t: TaskRow; save: (input: Record<string, unknown>) => void; remove: () => void; close: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [draft, setDraft] = useState({ type: t.type, title: t.title, dueDate: t.dueDate, dueTime: t.dueTime ?? "", notes: t.notes ?? "", done: t.done });
  const set = (p: Partial<typeof draft>) => setDraft({ ...draft, ...p });
  const label = "mb-1 block text-[12.6px] font-semibold text-[#666]";
  const who = [t.firstName, t.lastName].filter(Boolean).join(" ");
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4" onClick={close}>
      <form
        className="mx-auto mt-[30px] max-w-[600px] rounded-[6px] bg-white shadow-[0_5px_15px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); save(draft); }}
      >
        <div className="flex items-center border-b border-[#e5e5e5] p-[15px]">
          <h4 className="text-lg">Edit Item</h4>
          <button type="button" onClick={close} aria-label="Close" className="ml-auto text-xl leading-none text-black/40">×</button>
        </div>
        <div className="grid gap-3 p-[15px] sm:grid-cols-2">
          <label className="flex items-center gap-2 text-[12.6px] font-semibold text-[#666]">
            <input type="checkbox" checked={!draft.dueTime} onChange={(e) => set({ dueTime: e.target.checked ? "" : "09:00" })} /> All day
          </label>
          <label>
            <span className={label}>Type:</span>
            <select value={draft.type} onChange={(e) => set({ type: e.target.value as TaskType })} className={input}>
              {(Object.keys(types) as TaskType[]).map((k) => <option key={k} value={k}>{types[k].label}</option>)}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className={label}>Date:</span>
            <span className="flex gap-1">
              <input type="date" required value={draft.dueDate} onChange={(e) => set({ dueDate: e.target.value })} className={input} />
              {!!draft.dueTime && <input type="time" required value={draft.dueTime} onChange={(e) => set({ dueTime: e.target.value })} className={input} />}
            </span>
          </label>
          <label className="sm:col-span-2">
            <span className={label}>Title:</span>
            <input required maxLength={200} value={draft.title} onChange={(e) => set({ title: e.target.value })} className={input} />
          </label>
          <label className="sm:col-span-2">
            <span className={label}>Description:</span>
            <textarea rows={3} maxLength={2000} placeholder="Enter note here" value={draft.notes} onChange={(e) => set({ notes: e.target.value })} className={cn(input, "h-auto py-1")} />
          </label>
          <label className="flex items-center gap-2 text-[12.6px] font-semibold text-[#666]">
            <input type="checkbox" checked={draft.done} onChange={(e) => set({ done: e.target.checked })} /> Done
          </label>
          {t.dealId && (
            <details open className="rounded-[4px] border border-[#ddd] sm:col-span-2">
              <summary className="cursor-pointer bg-[#f5f5f5] px-[15px] py-2.5 text-[12.6px]">{who} [{dealCode(t.dealNumber!)}]</summary>
              <div className="flex flex-wrap items-center gap-4 p-[15px] text-[12.6px]">
                <Link href={`/my-day?d=${t.dueDate}`} className="text-[#428bca] hover:underline">View in My Day</Link>
                <Link href={`/deal/${t.dealId}/remindersAndTasks`} className="text-[#428bca] hover:underline">View Deal</Link>
                {t.phone && <span><b>Phone:</b> {t.phone}</span>}
                {t.email && <span><b>Email:</b> {t.email}</span>}
              </div>
            </details>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#e5e5e5] p-[15px] text-[12.6px]">
          {confirm ? (
            <>
              <span className="mr-auto text-[#a94442]">Are you sure you want to remove this item?</span>
              <button type="button" onClick={remove} className="rounded-[3px] border border-[#d43f3a] bg-[#d9534f] px-3 py-1.5 text-white">Yes</button>
              <button type="button" onClick={() => setConfirm(false)} className="rounded-[3px] border border-[#ccc] px-3 py-1.5">No</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setConfirm(true)} className="mr-auto rounded-[3px] border border-[#cf4f4c] bg-gradient-to-b from-[#d9534f] to-[#cf4f4c] px-3 py-1.5 text-white">Delete</button>
              <button type="submit" className="rounded-[3px] border border-[#3d81be] bg-gradient-to-b from-[#428bcd] to-[#3d81be] px-3 py-1.5 text-white">Save</button>
              <button type="button" onClick={close} className="rounded-[3px] border border-[#ccc] px-3 py-1.5">Close</button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

// Not connected: there is no Google account link yet, so nothing here pretends to sync.
function GoogleSync() {
  return (
    <div className={cn(card, "mt-5 pb-[15px]")}>
      <h3 className={cardTitle}>Google Sync</h3>
      <div className="px-5 pt-2.5 text-[12.6px] text-[#666]">
        <div className="flex items-center justify-between gap-2">
          <span>
            Link Google Account
            <span className="ml-2 rounded-[3px] bg-[#f0ad4e] px-1.5 py-0.5 text-[11px] font-semibold text-white">Pending integration</span>
          </span>
          <button disabled title="Google Calendar sync isn't connected yet" className="flex items-center gap-1 rounded-[3px] border border-[#3d81be] bg-gradient-to-b from-[#428bcd] to-[#3d81be] px-3 py-1.5 text-white opacity-50">
            <Link2 className="size-3.5" /> Connect
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppCalendar({ view, cursor, today, days, tasks }: { view: CalendarView; cursor: string; today: string; days: string[]; tasks: TaskRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const go = (v: CalendarView, d: string) => router.push(`/calendar?v=${v}&d=${d}`);
  const act = (fn: () => Promise<{ error?: string; id?: string }>, then?: (id?: string) => void) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? "");
      if (!r.error) then?.(r.id);
    });

  const shift = (n: number) => go(view, view === "month" ? shiftMonth(cursor, n) : addDays(cursor, n * (view === "week" ? 7 : 1)));
  const on = (day: string) => tasks.filter((t) => t.dueDate === day);

  // Native drag and drop: "new:<type>" from the Drag to Add list, "move:<id>" for an existing task.
  // Dropping on an hour sets the time; dropping on a day keeps it.
  const drop = (day: string, hour?: number) => (e: DragEvent) => {
    e.preventDefault();
    const [kind, val] = e.dataTransfer.getData("text/plain").split(":");
    const time = hour === undefined ? {} : { dueTime: `${pad(hour)}:00` };
    if (kind === "move") return act(() => updateTaskAction(val, { dueDate: day, ...time }));
    if (kind === "new" && val in types) act(() => createTaskAction({ type: val, title: types[val as TaskType].label, dueDate: day, ...time }), (id) => id && setEditing(id));
  };
  const over = (e: DragEvent) => e.preventDefault();
  const editTask = tasks.find((t) => t.id === editing);

  const cols = view === "day" ? "grid-cols-1" : "grid-cols-7";
  const hasToday = days.includes(today) && (view !== "month" || cursor.slice(0, 7) === today.slice(0, 7));

  return (
    <AppShell>
      <section className="mx-[25px] mb-5 flex items-center gap-2.5 text-[#666]">
        <CalendarDays className="size-7 stroke-[1.5]" />
        <h1 className="text-[28px] leading-[38px] font-light">Calendar</h1>
        <ol className="ml-auto hidden items-center gap-1 text-xs sm:flex">
          <li><Link href="/" className="text-[#444] hover:underline">Home</Link></li>
          <li className="before:mr-1 before:text-[#ccc] before:content-['>']">Calendar</li>
        </ol>
      </section>
      <div className="mx-[25px] grid gap-5 md:grid-cols-[1fr_3fr]">
        <div>
          <div className={cn(card, "pb-[15px]")}>
            <h3 className={cardTitle}>Drag to Add</h3>
            <div className="px-5 pt-2.5">
              {(Object.keys(types) as TaskType[]).map((k) => {
                const t = types[k];
                return (
                  <div
                    key={k}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", `new:${k}`)}
                    style={{ background: t.bg }}
                    className="my-0.5 flex cursor-pointer items-center px-2.5 py-[5px] text-[12.6px] text-white"
                  >
                    <t.icon className="mr-1.5 size-3.5" /> {t.label}
                  </div>
                );
              })}
            </div>
          </div>
          <GoogleSync />
        </div>
        <div className={cn(card, "min-w-0 pb-5", pending && "opacity-70")}>
          <h3 className={cardTitle}><CalendarRange className="size-5" /> Agenda</h3>
          <div className="px-5 pt-[15px]">
            {error && <p role="alert" className="mb-3 rounded-[3px] border border-[#ebccd1] bg-[#f2dede] px-3 py-2 text-sm text-[#a94442]">{error}</p>}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <div className="flex">
                  <button onClick={() => shift(-1)} aria-label={`Previous ${view}`} className={cn(fcBtn, "rounded-l-[3px]")}>‹</button>
                  <button onClick={() => shift(1)} aria-label={`Next ${view}`} className={cn(fcBtn, "rounded-r-[3px] border-l-0")}>›</button>
                </div>
                <button onClick={() => go(view, today)} disabled={hasToday} className={cn(fcBtn, "rounded-[3px]")}>today</button>
              </div>
              <h2 className="order-first w-full text-center text-[22px] font-light text-[#666] sm:order-none sm:w-auto">{title(view, cursor, days)}</h2>
              <div className="flex">
                {(["month", "week", "day"] as const).map((v) => (
                  <button key={v} onClick={() => go(v, cursor)} className={cn(fcBtn, "first:rounded-l-[3px] last:rounded-r-[3px]", view === v && "border-[#151e27] bg-[#1a252f]")}>{v}</button>
                ))}
              </div>
            </div>
            <div className="border border-[#ddd] text-[12.6px]">
              <div className={cn("grid border-b border-[#ddd]", cols, view !== "month" && "pl-[50px]")}>
                {days.slice(0, 7).map((d) => (
                  <div key={d} className="truncate border-l border-[#ddd] px-1 py-0.5 text-center font-bold text-[#428bca] first:border-l-0">
                    {fmt(d, view === "month" ? { weekday: "short" } : view === "week" ? { weekday: "short", month: "numeric", day: "numeric" } : { weekday: "long" })}
                  </div>
                ))}
              </div>
              {view === "month" ? (
                <div className={cn("grid", cols)}>
                  {days.map((day) => {
                    const list = on(day);
                    return (
                      <div
                        key={day}
                        onDragOver={over}
                        onDrop={drop(day)}
                        className={cn("h-[139px] min-w-0 border-t border-l border-[#ddd] p-0.5 [&:nth-child(-n+7)]:border-t-0 [&:nth-child(7n+1)]:border-l-0", day === today && "bg-[rgba(255,220,40,0.15)]")}
                      >
                        <div className={cn("p-1 text-right text-[#428bca]", day.slice(0, 7) !== cursor.slice(0, 7) && "opacity-50")}>{Number(day.slice(8))}</div>
                        {list.slice(0, 3).map((t) => <Chip key={t.id} t={t} onOpen={() => setEditing(t.id)} />)}
                        {list.length > 3 && (
                          <button onClick={() => go("day", day)} className="px-1 text-[11.5px] text-[#428bca] hover:underline">+{list.length - 3} more</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div className={cn("relative grid border-b-2 border-[#ddd] pl-[50px]", cols)}>
                    <span className="absolute top-0 left-0 w-[50px] px-1 py-1 text-[11px] text-[#666]">all-day</span>
                    {days.map((d) => (
                      <div key={d} onDragOver={over} onDrop={drop(d)} className={cn("min-h-[30px] min-w-0 border-l border-[#ddd] p-0.5", d === today && "bg-[rgba(255,220,40,0.15)]")}>
                        {on(d).filter((t) => !t.dueTime).map((t) => <Chip key={t.id} t={t} onOpen={() => setEditing(t.id)} />)}
                      </div>
                    ))}
                  </div>
                  <div className="max-h-[760px] overflow-y-auto">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="flex border-t border-[#ddd] first:border-t-0">
                        <span className="w-[50px] shrink-0 px-1 text-right text-[11px] text-[#666]">{hourLabel(h)}</span>
                        <div className={cn("grid flex-1", cols)}>
                          {days.map((day) => (
                            <div key={day} onDragOver={over} onDrop={drop(day, h)} className={cn("min-h-[42px] min-w-0 border-l border-[#ddd] p-0.5", day === today && "bg-[rgba(255,220,40,0.15)]")}>
                              {on(day).filter((t) => t.dueTime && Number(t.dueTime.slice(0, 2)) === h).map((t) => (
                                <button
                                  key={t.id}
                                  draggable
                                  onDragStart={dragMove(t)}
                                  onClick={() => setEditing(t.id)}
                                  style={{ background: types[t.type].bg, borderColor: types[t.type].border }}
                                  className={cn("mb-px block w-full truncate rounded-[3px] border px-1 text-left text-[11.5px] text-white", t.done && "line-through opacity-70")}
                                >
                                  {timeLabel(t.dueTime!)} {t.title}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {editTask && (
        <EditModal
          key={editTask.id}
          t={editTask}
          save={(input) => act(() => updateTaskAction(editTask.id, input), () => setEditing(null))}
          remove={() => act(() => removeTaskAction(editTask.id), () => setEditing(null))}
          close={() => setEditing(null)}
        />
      )}
    </AppShell>
  );
}
