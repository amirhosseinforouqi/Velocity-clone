import { notFound } from "next/navigation";
import { requireActor } from "@/auth";
import { AppDeal } from "@/components/platform/deal";
import { dealTabs } from "@/components/platform/deal-sections";
import { dealCompliance } from "@/server/compliance";
import { dealChecklist } from "@/server/conditions";
import { getDb } from "@/server/db";
import { dealHistory, getDeal } from "@/server/deals";
import { lenderChoices } from "@/server/lenders";
import { dealTasks } from "@/server/tasks";

// Also serves /deal/[id]/[tab]; a missing deal and one the user can't see are both a 404.
export async function DealWorkspace({ id, tab }: { id: string; tab?: string }) {
  if (tab && !dealTabs.some((t) => t.slug === tab)) notFound();
  const db = await getDb();
  const actor = await requireActor();
  const deal = await getDeal(db, actor, id);
  if (!deal) notFound();
  return <AppDeal deal={deal} history={await dealHistory(db, deal.id)} checklist={await dealChecklist(db, actor, deal.id)} compliance={await dealCompliance(db, actor, deal.id)} tasks={await dealTasks(db, actor, deal.id)} lenders={await lenderChoices(db, deal.organizationId, deal.agentId)} tab={tab} />;
}
