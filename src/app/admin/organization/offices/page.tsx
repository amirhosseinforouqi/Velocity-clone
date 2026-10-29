import { AppOfficeList } from "@/components/platform/admin";
import { listOffices } from "@/server/admin";
import { adminPage } from "../../guard";

export default async function Page() {
  const { db, actor } = await adminPage(true);
  return <AppOfficeList org offices={await listOffices(db, actor)} users={[]} canManage />;
}
