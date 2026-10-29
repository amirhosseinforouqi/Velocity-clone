import { AppConditionLibrary } from "@/components/platform/admin";
import { listConditionTemplates } from "@/server/admin";
import { adminPage } from "../guard";

export default async function Page() {
  const { db, actor } = await adminPage(true);
  return <AppConditionLibrary templates={await listConditionTemplates(db, actor)} />;
}
