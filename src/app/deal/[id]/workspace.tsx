import { notFound } from "next/navigation";
import { requireActor } from "@/auth";
import { AppDeal } from "@/components/platform/deal";
import { dealTabs, legacyTabs } from "@/components/platform/deal-sections";
import { getOrganization } from "@/server/admin";
import { dealCompliance } from "@/server/compliance";
import { dealChecklist } from "@/server/conditions";
import { getDb } from "@/server/db";
import { listContacts } from "@/server/contacts";
import { dealActivity, dealHistory, dealStaff, getDeal, listDealContacts, maskSins } from "@/server/deals";
import { lenderChoices } from "@/server/lenders";
import { portalWorkspace } from "@/server/portal";
import { dealProgress } from "@/server/progress";
import { dealTasks } from "@/server/tasks";

// Also serves /deal/[id]/[tab]; a missing deal and one the user can't see are both a 404.
export async function DealWorkspace({ id, tab }: { id: string; tab?: string }) {
  const slug = tab ? legacyTabs[tab] ?? tab : undefined;
  if (slug && !dealTabs.some((t) => t.slug === slug)) notFound();
  const db = await getDb();
  const actor = await requireActor();
  const deal = await getDeal(db, actor, id);
  if (!deal) notFound();
  const { settings } = await getOrganization(db, deal.organizationId);
  const contacts = {
    dealId: deal.id,
    rows: await listDealContacts(db, actor, deal.id),
    choices: (await listContacts(db, actor)).map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, role: c.role, company: c.company })),
  };
  const team = { staff: (await dealStaff(db, actor, deal)).map(({ id, name }) => ({ id, name })), me: actor.id, canReassign: actor.role === "org_admin" || actor.role === "office_admin" };
  return <AppDeal deal={{ ...deal, fields: maskSins(deal.fields) }} team={team} contacts={contacts} progress={await dealProgress(db, actor, deal.id)} history={await dealHistory(db, deal.id)} checklist={await dealChecklist(db, actor, deal.id)} compliance={await dealCompliance(db, actor, deal.id)} tasks={await dealTasks(db, actor, deal.id)} lenders={await lenderChoices(db, deal.organizationId, deal.agentId)} activity={await dealActivity(db, actor, deal.id)} portal={await portalWorkspace(db, actor, deal.id)} orgAdmin={actor.role === "org_admin"} qualification={settings.qualification} lists={{ "Lead Stage": settings.leadStages, "Lead Source": settings.leadSources }} tab={slug} />;
}
