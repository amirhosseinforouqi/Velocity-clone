import { requireActor } from "@/auth";
import { AppParked } from "@/components/platform/deal-lists";
import { getDb } from "@/server/db";
import { listDeals } from "@/server/deals";

export default async function ParkedPage() {
  return <AppParked deals={await listDeals(await getDb(), await requireActor(), ["parked"])} />;
}
