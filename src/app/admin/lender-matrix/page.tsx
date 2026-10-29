import { AppLenderMatrix } from "@/components/platform/lenders";
import { listUsers } from "@/server/admin";
import { listLenders } from "@/server/lenders";
import { adminPage } from "../guard";

export default async function Page() {
  const { db, actor } = await adminPage(true);
  const agents = (await listUsers(db, actor)).filter((u) => !u.deactivatedAt).map(({ id, name }) => ({ id, name }));
  return <AppLenderMatrix lenders={await listLenders(db, actor)} agents={agents} />;
}
