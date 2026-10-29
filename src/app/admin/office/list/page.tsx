import { AppOfficeList } from "@/components/platform/admin";
import { listOffices, listUsers } from "@/server/admin";
import { adminPage } from "../../guard";

export default async function Page() {
  const { db, actor } = await adminPage();
  return <AppOfficeList offices={await listOffices(db, actor)} users={await listUsers(db, actor)} canManage={actor.role === "org_admin"} />;
}
