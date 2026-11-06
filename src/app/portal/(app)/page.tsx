import { redirect } from "next/navigation";
import { requireClient } from "@/auth";
import { ApplicationCards, PortalTitle } from "@/components/platform/client-portal";
import { getDb } from "@/server/db";
import { clientDeals, clientProfile } from "@/server/portal-client";

export const metadata = { title: "My applications" };

export default async function PortalHome() {
  const [db, account] = [await getDb(), await requireClient()];
  const [list, profiles] = await Promise.all([clientDeals(db, account), clientProfile(db, account)]);
  // One application: no list to choose from, so go straight to it.
  if (list.length === 1) redirect(`/portal/applications/${list[0].id}`);
  const first = profiles[0]?.name.split(" ")[0];
  return (
    <div>
      <PortalTitle title={first ? `Welcome back, ${first}` : "Welcome back"}>Here&apos;s where your mortgage stands, and anything we need from you.</PortalTitle>
      <ApplicationCards list={list} />
    </div>
  );
}
