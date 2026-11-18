import { requireActor } from "@/auth";
import { AppCalendar } from "@/components/platform/calendar";
import { calendarDays, isDay, type CalendarView } from "@/lib/dates";
import { getDb } from "@/server/db";
import { listDeals } from "@/server/deals";
import { calendarTasks, today } from "@/server/tasks";

const views: CalendarView[] = ["month", "week", "day"];

// /calendar?v=month|week|day&d=YYYY-MM-DD; loads only the days the view shows.
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ v?: string; d?: string }> }) {
  const { v, d } = await searchParams;
  const actor = await requireActor();
  const now = today();
  const view = views.find((x) => x === v) ?? "month";
  const cursor = isDay(d) ? d : now;
  const days = calendarDays(view, cursor);
  const db = await getDb();
  const tasks = await calendarTasks(db, actor, days[0], days[days.length - 1]);
  // Key dates from the files themselves, so a closing shows without anyone making a task for it.
  // ponytail: filters every visible deal in memory, like the Pipeline; query by date range past a few thousand files.
  const kinds = [["closingDate", "Closing"], ["conditionsDate", "Conditions due"], ["followUpDate", "Follow up"]] as const;
  const dates = (await listDeals(db, actor)).filter((d) => d.status !== "cancelled" && d.status !== "declined").flatMap((d) => kinds.flatMap(([k, label]) => {
    const day = d[k];
    return day && day >= days[0] && day <= days[days.length - 1] ? [{ day, label, dealId: d.id, name: [d.firstName, d.lastName].filter(Boolean).join(" ") || "File" }] : [];
  }));
  return <AppCalendar view={view} cursor={cursor} today={now} days={days} tasks={tasks} dates={dates} />;
}
