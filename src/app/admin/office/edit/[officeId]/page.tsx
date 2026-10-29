import { notFound } from "next/navigation";
import { AppOfficeEdit } from "@/components/platform/admin";
import { getOffice, listConsents } from "@/server/admin";
import { adminPage } from "../../../guard";

export default async function Page({ params }: { params: Promise<{ officeId: string }> }) {
  const { officeId } = await params;
  const { db, actor } = await adminPage(officeId === "new");
  if (officeId === "new") return <AppOfficeEdit office={null} consents={[]} />;
  const office = await getOffice(db, actor, officeId);
  if (!office) notFound();
  return <AppOfficeEdit office={office} consents={(await listConsents(db, actor, office.id)).map((c) => ({ ...c, acceptanceText: c.acceptanceText ?? "" }))} />;
}
