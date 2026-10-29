import { AppComplianceDashboard } from "@/components/platform/compliance";
import { complianceDashboard } from "@/server/compliance";
import { adminPage } from "../../admin/guard";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// Organization and office admins only (everyone else gets a 404); rows are scoped like every deal list.
export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const { db, actor } = await adminPage();
  const s = await searchParams;
  const filter = { q: one(s.q), dealStatus: one(s.dealStatus), compliance: one(s.compliance) };
  return <AppComplianceDashboard filter={filter} rows={await complianceDashboard(db, actor, filter)} />;
}
