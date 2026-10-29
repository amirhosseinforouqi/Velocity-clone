import { notFound } from "next/navigation";
import { AppLenderDetail } from "@/components/platform/lenders";
import { listUsers } from "@/server/admin";
import { getLender } from "@/server/lenders";
import { adminPage } from "../../guard";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { db, actor } = await adminPage(true);
  const found = await getLender(db, actor, (await params).id);
  if (!found) notFound();
  const { products, ...lender } = found;
  const agents = (await listUsers(db, actor)).filter((u) => !u.deactivatedAt).map(({ id, name }) => ({ id, name }));
  return <AppLenderDetail lender={lender} products={products} agents={agents} />;
}
