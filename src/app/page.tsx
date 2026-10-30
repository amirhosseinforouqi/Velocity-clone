import { requireActor } from "@/auth";
import { AppHome } from "@/components/platform/home";
import { getDb } from "@/server/db";
import { boardStatuses } from "@/server/deal-status";
import { dealCode, listDeals, nextMilestone } from "@/server/deals";
import { portalDashboard } from "@/server/portal";
import { today } from "@/server/tasks";

// Deals still moving toward closing.
const open = new Set<string>(boardStatuses.map(([s]) => s).filter((s) => !["lead", "funded", "declined", "cancelled"].includes(s)));

export default async function Home() {
  const db = await getDb();
  const actor = await requireActor();
  const all = await listDeals(db, actor);
  const deals = all.map((d) => ({ status: d.status, amount: d.amount ?? 0 }));
  const name = (d: (typeof all)[number]) => [d.firstName, d.lastName].filter(Boolean).join(" ") || dealCode(d.number);
  const now = today();
  const active = all.filter((d) => open.has(d.status));
  const deadlines = active
    .flatMap((d) => { const m = nextMilestone(d, now); return m ? [{ id: d.id, name: name(d), ...m }] : []; })
    .sort((a, b) => a.daysTo - b.daysTo);
  const conditions = active
    .filter((d) => d.conditionsRequired + d.conditionsReceived + d.conditionsSatisfied > 0)
    .map((d) => ({ id: d.id, name: name(d), code: dealCode(d.number), required: d.conditionsRequired, received: d.conditionsReceived, satisfied: d.conditionsSatisfied }))
    .sort((a, b) => b.required - a.required);
  return <AppHome portal={await portalDashboard(db, actor)} deals={deals} deadlines={deadlines} conditions={conditions} />;
}
