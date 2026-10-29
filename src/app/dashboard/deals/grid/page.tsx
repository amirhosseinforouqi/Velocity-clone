import { requireActor } from "@/auth";
import { AppDealsGrid } from "@/components/platform/deals";
import { getDb } from "@/server/db";
import { boardStatuses } from "@/server/deal-status";
import { listDeals } from "@/server/deals";

export default async function DealsGridPage({ searchParams }: { searchParams: Promise<{ status?: string; noAgent?: string }> }) {
  const { status, noAgent } = await searchParams;
  const deals = await listDeals(await getDb(), await requireActor(), boardStatuses.map(([s]) => s));
  return <AppDealsGrid deals={deals} status={status} noAgent={noAgent === "true"} />;
}
