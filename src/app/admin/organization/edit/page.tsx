import { AppOrganizationEdit } from "@/components/platform/admin";
import { getOrganization, slaStatuses } from "@/server/admin";
import { adminPage } from "../../guard";

export default async function Page() {
  const { db, actor } = await adminPage(true);
  return <AppOrganizationEdit org={await getOrganization(db, actor.organizationId)} slaStatuses={slaStatuses} />;
}
