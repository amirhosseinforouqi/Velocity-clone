import { AppChecklists } from "@/components/platform/portal-admin";
import { listChecklists } from "@/server/portal-admin";
import { adminPage } from "../guard";

export default async function Page() {
  const { db, actor } = await adminPage(true);
  return <AppChecklists checklists={await listChecklists(db, actor)} />;
}
