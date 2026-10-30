import { requireActor } from "@/auth";
import { AppHome } from "@/components/platform/home";
import { getDb } from "@/server/db";
import { listDeals } from "@/server/deals";
import { portalDashboard } from "@/server/portal";

export default async function Home() {
  const db = await getDb();
  const actor = await requireActor();
  const deals = (await listDeals(db, actor)).map((d) => ({ status: d.status, amount: d.amount ?? 0 }));
  return <AppHome portal={await portalDashboard(db, actor)} deals={deals} />;
}
