import { requireActor } from "@/auth";
import { AppMyDay } from "@/components/platform/myday";
import { isDay } from "@/lib/dates";
import { dueAftercare } from "@/server/aftercare";
import { getDb } from "@/server/db";
import { myDay, today } from "@/server/tasks";

// /my-day?d=YYYY-MM-DD shows that day; without it, today (in the app's time zone).
export default async function MyDayPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const actor = await requireActor();
  const now = today();
  const date = isDay(d) ? d : now;
  const db = await getDb();
  return <AppMyDay date={date} today={now} tasks={await myDay(db, actor, date, now)} aftercare={await dueAftercare(db, actor, date)} />;
}
