// Calendar days as "YYYY-MM-DD" strings, shared by server and client. Arithmetic runs in UTC so daylight saving never shifts a day.
const utc = (day: string) => new Date(day + "T00:00Z");

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(utc(s).getTime()) && utc(s).toISOString().startsWith(s);

export function addDays(day: string, n: number) {
  const d = utc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type CalendarView = "month" | "week" | "day";

// The days a view shows: a six-week grid for a month, Sunday to Saturday for a week.
export function calendarDays(view: CalendarView, cursor: string) {
  const first = view === "month" ? cursor.slice(0, 8) + "01" : cursor;
  const start = view === "day" ? cursor : addDays(first, -utc(first).getUTCDay());
  return Array.from({ length: view === "month" ? 42 : view === "week" ? 7 : 1 }, (_, i) => addDays(start, i));
}
