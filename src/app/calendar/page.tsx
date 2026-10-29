import { requireActor } from "@/auth";
import { AppCalendar } from "@/components/platform/calendar";
import { calendarDays, isDay, type CalendarView } from "@/lib/dates";
import { getDb } from "@/server/db";
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
  const tasks = await calendarTasks(await getDb(), actor, days[0], days[days.length - 1]);
  return <AppCalendar view={view} cursor={cursor} today={now} days={days} tasks={tasks} />;
}
