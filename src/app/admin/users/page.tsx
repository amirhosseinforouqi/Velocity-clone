import { AppAdminUsers } from "@/components/platform/admin";
import { listUsers } from "@/server/admin";
import { adminPage } from "../guard";

export default async function Page() {
  const { db, actor } = await adminPage();
  return <AppAdminUsers users={await listUsers(db, actor)} me={actor.id} />;
}
