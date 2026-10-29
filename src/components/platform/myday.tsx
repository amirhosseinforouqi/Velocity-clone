"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, CloudSun, Mail, MessageSquareText, PhoneCall, SearchCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bulkTasksAction, removeTaskAction, updateTaskAction } from "@/app/deal/actions";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { dealCode } from "@/server/deal-status";
import type { TaskRow } from "@/server/tasks";
import { AppShell } from "./shell";

const blueBtn = "rounded-[3px] border border-[#3d81be] bg-gradient-to-b from-[#428bcd] to-[#3d81be] text-white";

// Follow-ups, appointments and personal tasks are listed under Other.
const lists = [
  { type: "phone", title: "Phone Calls", icon: PhoneCall, to: "# to Call" },
  { type: "sms", title: "SMS", icon: MessageSquareText, to: "# to SMS" },
  { type: "email", title: "Email", icon: Mail, to: "E-mail Address" },
  { type: "other", title: "Other", icon: SearchCheck, to: "# to Call" },
] as const;
const listOf = (t: TaskRow) => (t.type === "phone" || t.type === "sms" || t.type === "email" ? t.type : "other");

type Run = (fn: () => Promise<{ error?: string }>) => void;

function TaskList({ list, tasks, today, act }: { list: (typeof lists)[number]; tasks: TaskRow[]; today: string; act: Run }) {
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [bulk, setBulk] = useState("");
  const [error, setError] = useState(false);
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id]);
  const apply = () => {
    if (!picked.length) return setError(true);
    setError(false);
    if (!bulk) return;
    act(() => bulkTasksAction(picked, bulk));
    setPicked([]);
  };
  const th = "border-x border-[#797979] px-2 py-2 text-left font-semibold whitespace-nowrap";
  const td = "border border-[#ddd] p-2";
  return (
    <div className="mb-5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.1)]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center px-3 py-2.5 text-[#428bca]">
        <h5 className="flex items-center text-[1.5em]">
          <list.icon className="mr-2.5 size-[1.1em]" /> {list.title}
        </h5>
        <ChevronDown className={cn("ml-auto size-7 text-[#666] transition-transform", !open && "rotate-90")} />
      </button>
      {open && (
        <div className="bg-[#f1f1f1] p-[15px]">
          {(list.type === "sms" || list.type === "email") && (
            <p className="mb-2 text-[12.6px] text-[#8a6d3b]">
              <span className="mr-1 rounded-[3px] bg-[#f0ad4e] px-1.5 py-0.5 text-[11px] font-semibold text-white">Pending integration</span>
              Sending {list.type === "sms" ? "SMS" : "email"} isn&apos;t connected yet. Send it yourself, then mark the task as done.
            </p>
          )}
          <div className="mb-[5px] flex gap-2">
            <select value={bulk} onChange={(e) => setBulk(e.target.value)} className="h-[34px] rounded-[3px] border border-[#ccc] bg-white px-2 text-[12.6px]">
              <option value="">Bulk Actions</option>
              <option value="done">Mark as Done</option>
              <option value="postpone">Postpone</option>
              <option value="remove">Remove</option>
            </select>
            <button onClick={apply} className={cn(blueBtn, "h-[34px] px-5 text-[12.6px]")}>Apply</button>
          </div>
          {error && <p className="mb-2 text-[12.6px] text-[#a94442]">At least one task must be selected.</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12.6px]">
              <thead className="bg-black/60 text-white">
                <tr>
                  <th className={th}>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={!!tasks.length && picked.length === tasks.length} onChange={(e) => setPicked(e.target.checked ? tasks.map((t) => t.id) : [])} />
                      Title
                    </label>
                  </th>
                  {["Deal #", "Status", "Recipients", list.to, "Actions"].map((c) => <th key={c} className={th}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="odd:bg-white even:bg-[#f9f9f9] hover:bg-[#f5f5f5]">
                    <td className={td}>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={picked.includes(t.id)} onChange={() => toggle(t.id)} />
                        <span className={cn(t.done && "line-through")}>{t.title}</span>
                      </label>
                    </td>
                    <td className={td}>
                      {t.dealId ? <Link href={`/deal/${t.dealId}/remindersAndTasks`} className="text-[#428bca] hover:underline">{dealCode(t.dealNumber!)}</Link> : "—"}
                    </td>
                    <td className={cn(td, !t.done && t.dueDate < today && "text-[#a94442]")}>
                      {t.done ? "Done" : t.dueDate < today ? `Overdue (${t.dueDate})` : "Open"}
                      {t.dueTime && ` · ${t.dueTime}`}
                    </td>
                    <td className={td}>{[t.firstName, t.lastName].filter(Boolean).join(" ")}</td>
                    <td className={td}>{list.type === "email" ? t.email : t.phone}</td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[false, true].map((d) => (
                            <button
                              key={String(d)}
                              onClick={() => act(() => updateTaskAction(t.id, { done: d }))}
                              className={cn(
                                "border border-[#ccc] px-2 py-1 first:rounded-l-[3px] last:rounded-r-[3px]",
                                t.done === d ? (d ? "border-[#d43f3a] bg-[#d9534f] text-white" : "border-[#4cae4c] bg-[#5cb85c] text-white") : "bg-white",
                              )}
                            >
                              {d ? "Done" : "To do"}
                            </button>
                          ))}
                        </div>
                        <details className="relative">
                          <summary className="flex cursor-pointer list-none items-center gap-1 rounded-[3px] border border-[#ccc] bg-white px-2 py-1 [&::-webkit-details-marker]:hidden">
                            Actions <ChevronDown className="size-3" />
                          </summary>
                          <ul className="absolute right-0 z-10 mt-1 w-32 rounded-[3px] border border-[#ddd] bg-white py-1 shadow-lg">
                            <li><Link href={`/calendar?v=day&d=${t.dueDate}`} className="block px-3 py-1 hover:bg-[#f5f5f5]">Edit</Link></li>
                            <li><button onClick={() => act(() => bulkTasksAction([t.id], "postpone"))} className="w-full px-3 py-1 text-left hover:bg-[#f5f5f5]">Postpone</button></li>
                            <li><button onClick={() => act(() => removeTaskAction(t.id))} className="w-full px-3 py-1 text-left text-[#d9534f] hover:bg-[#f5f5f5]">Remove</button></li>
                          </ul>
                        </details>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppMyDay({ date, today, tasks }: { date: string; today: string; tasks: TaskRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const act: Run = (fn) => start(async () => setError((await fn()).error ?? ""));
  const shown = new Date(date + "T00:00Z");
  const label = (o: Intl.DateTimeFormatOptions) => shown.toLocaleDateString("en-CA", { ...o, timeZone: "UTC" });
  const arrow = "text-[37px] leading-none text-[#666] hover:text-[#428bca]";
  return (
    <AppShell>
      <section className="mx-[25px] mb-5 flex items-center gap-2.5 text-[#666]">
        <CloudSun className="size-7 stroke-[1.5]" />
        <h1 className="text-[28px] leading-[38px] font-light uppercase">My Day</h1>
        <ol className="ml-auto hidden items-center gap-1 text-xs sm:flex">
          <li><Link href="/" className="text-[#444] hover:underline">Home</Link></li>
          <li className="uppercase before:mr-1 before:text-[#ccc] before:content-['>']">Your workflow tasks for the day</li>
        </ol>
      </section>
      <section className={cn("mx-[25px] pb-[35px]", pending && "opacity-70")}>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-[15px]">
          <ul className="flex items-center text-[#666]">
            <li className="mr-5"><button onClick={() => router.push(`/my-day?d=${addDays(date, -1)}`)} aria-label="Previous day" className={arrow}><ChevronLeft className="size-9" /></button></li>
            <li className="flex items-center">
              <span className="text-[41px] leading-none font-medium">{shown.getUTCDate()}</span>
              <span className="w-[100px] pt-[5px] pl-[7px] text-[15px] leading-[1.1] uppercase">
                {label({ month: "long" })}
                <b className="block">{label({ weekday: "long" })}</b>
              </span>
            </li>
            <li className="ml-5"><button onClick={() => router.push(`/my-day?d=${addDays(date, 1)}`)} aria-label="Next day" className={arrow}><ChevronRight className="size-9" /></button></li>
            {date !== today && <li className="ml-3"><Link href="/my-day" className="text-sm text-[#428bca] hover:underline">Today</Link></li>}
          </ul>
          <Link href="/calendar" className={cn(blueBtn, "flex items-center gap-2 px-[15px] py-[5px] text-sm")}>
            Open your <b className="tracking-tight">calendar</b>
          </Link>
        </div>
        {error && <p role="alert" className="mb-3 rounded-[3px] border border-[#ebccd1] bg-[#f2dede] px-3 py-2 text-sm text-[#a94442]">{error}</p>}
        <div className="pb-[50px]">
          {tasks.length ? (
            lists.map((l) => {
              const rows = tasks.filter((t) => listOf(t) === l.type);
              return rows.length ? <TaskList key={l.type} list={l} tasks={rows} today={today} act={act} /> : null;
            })
          ) : (
            <p className="mx-auto w-fit bg-white px-5 py-[15px] text-sm text-[#428bca] shadow-[0_0_4px_rgba(0,0,0,0.1)]">
              You have no tasks {date === today ? "today" : "on this day"}.
            </p>
          )}
        </div>
      </section>
    </AppShell>
  );
}
