import { AppUserMatrix } from "@/components/platform/admin";
import { listOffices, listUsers } from "@/server/admin";
import { adminPage } from "../guard";

export default async function Page() {
  const { db, actor, roles } = await adminPage();
  return <AppUserMatrix users={await listUsers(db, actor)} offices={await listOffices(db, actor)} roles={roles} />;
}
