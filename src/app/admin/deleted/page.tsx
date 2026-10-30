import { AppDeletedDeals } from "@/components/platform/admin";
import { listDeletedDeals } from "@/server/deals";
import { adminPage } from "../guard";

export default async function Page() {
  const { db, actor } = await adminPage();
  return <AppDeletedDeals rows={await listDeletedDeals(db, actor)} />;
}
