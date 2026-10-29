import { notFound } from "next/navigation";
import { AppUserEdit } from "@/components/platform/admin";
import { getUser, listOffices, listUsers } from "@/server/admin";
import { adminPage } from "../../../guard";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, actor, roles } = await adminPage();
  const user = id === "new" ? null : await getUser(db, actor, id);
  if (id !== "new" && !user) notFound();
  const mentors = (await listUsers(db, actor)).filter((u) => !u.deactivatedAt);
  return <AppUserEdit user={user} offices={await listOffices(db, actor)} mentors={mentors} roles={roles} />;
}
