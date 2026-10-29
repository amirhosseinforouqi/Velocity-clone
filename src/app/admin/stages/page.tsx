import { AppStages } from "@/components/platform/portal-admin";
import { listStages } from "@/server/portal-admin";
import { adminPage } from "../guard";

export default async function Page() {
  const { db, actor } = await adminPage(true);
  return <AppStages stages={await listStages(db, actor)} />;
}
