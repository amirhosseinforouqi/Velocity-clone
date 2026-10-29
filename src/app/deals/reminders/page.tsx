import { requireActor } from "@/auth";
import { AppReminders } from "@/components/platform/inbox";
import { getDb } from "@/server/db";
import { dealReminders } from "@/server/tasks";

export default async function Page() {
  return <AppReminders reminders={await dealReminders(await getDb(), await requireActor())} />;
}
