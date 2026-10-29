import { requireActor } from "@/auth";
import { AppHome } from "@/components/platform/home";
import { getDb } from "@/server/db";
import { portalDashboard } from "@/server/portal";

export default async function Home() {
  return <AppHome portal={await portalDashboard(await getDb(), await requireActor())} />;
}
