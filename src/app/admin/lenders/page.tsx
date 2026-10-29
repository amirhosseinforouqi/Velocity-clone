import { AppLenders } from "@/components/platform/lenders";
import { listLenders } from "@/server/lenders";
import { adminPage } from "../guard";

export default async function Page() {
  const { db, actor } = await adminPage(true);
  return <AppLenders lenders={await listLenders(db, actor)} />;
}
