import { redirect } from "next/navigation";
import { requireActor } from "@/auth";
import { getDb } from "@/server/db";
import { findDealByCode } from "@/server/deals";

// /deal?loanCode=KW-12 opens that deal; links that don't name one (placeholder pages) land on the dashboard.
export default async function DealLookup({ searchParams }: { searchParams: Promise<{ loanCode?: string }> }) {
  const { loanCode } = await searchParams;
  const id = loanCode ? await findDealByCode(await getDb(), await requireActor(), loanCode) : null;
  redirect(id ? `/deal/${id}` : "/dashboard/deals");
}
