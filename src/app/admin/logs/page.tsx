import { AppLogs } from "@/components/platform/admin";
import { LOG_PAGE, listAudit } from "@/server/admin";
import { adminPage } from "../guard";

export default async function Page({ searchParams }: { searchParams: Promise<{ entity?: string; page?: string }> }) {
  const { entity = "", page } = await searchParams;
  const { db, actor } = await adminPage(true);
  const data = await listAudit(db, actor, { entity: entity || undefined, page: Number(page) || 1 });
  return <AppLogs {...data} entity={entity} per={LOG_PAGE} />;
}
