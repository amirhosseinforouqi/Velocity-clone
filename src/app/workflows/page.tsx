import { requireActor } from "@/auth";
import { AppProgressSteps } from "@/components/platform/admin";
import { getDb } from "@/server/db";
import { dealTypes, listProgressSteps } from "@/server/progress";

// Every staff member can read the steps; only an org admin edits them.
export default async function Page() {
  const actor = await requireActor();
  return <AppProgressSteps steps={await listProgressSteps(await getDb(), actor)} dealTypes={dealTypes} canEdit={actor.role === "org_admin"} />;
}
