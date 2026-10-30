import { Suspense } from "react";
import { requireActor } from "@/auth";
import { AppSearch } from "@/components/platform/inbox";
import { contactView, listContacts } from "@/server/contacts";
import { getDb } from "@/server/db";
import { dealCode, statusLabel } from "@/server/deal-status";
import { listDeals } from "@/server/deals";

export default async function Page() {
  const db = await getDb();
  const actor = await requireActor();
  const deals = (await listDeals(db, actor)).map((d) => ({
    id: d.id, loanCode: dealCode(d.number), client: [d.firstName, d.lastName].filter(Boolean).join(" "), status: statusLabel[d.status],
    amount: d.amount ?? 0, lender: d.lender ?? "", closingDate: d.closingDate ?? "", agent: d.agent,
  }));
  return <Suspense><AppSearch contacts={(await listContacts(db, actor)).map(contactView)} deals={deals} /></Suspense>;
}
