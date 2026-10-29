import { notFound } from "next/navigation";
import { requireClient } from "@/auth";
import { ClientApplication } from "@/components/platform/client-portal";
import { Forbidden } from "@/server/access";
import { getDb } from "@/server/db";
import { clientDeal } from "@/server/portal-client";

export const metadata = { title: "Application" };

export default async function PortalApplication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const account = await requireClient();
  const d = await clientDeal(db, account, id).catch((e) => { if (e instanceof Forbidden) notFound(); throw e; });
  return <ClientApplication id={id} d={d} />;
}
