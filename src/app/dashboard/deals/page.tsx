import { requireActor } from "@/auth";
import { AppDeals } from "@/components/platform/deals";
import { getDb } from "@/server/db";
import { boardStatuses } from "@/server/deal-status";
import { listDeals } from "@/server/deals";

export default async function DealsPage() {
  return <AppDeals deals={await listDeals(await getDb(), await requireActor(), boardStatuses.map(([s]) => s))} />;
}
