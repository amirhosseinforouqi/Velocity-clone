import { notFound } from "next/navigation";
import { requireActor } from "@/auth";
import { AppContact } from "@/components/platform/contacts";
import { getOrganization } from "@/server/admin";
import { contactView, getContact } from "@/server/contacts";
import { getDb } from "@/server/db";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const db = await getDb();
  const actor = await requireActor();
  const row = await getContact(db, actor, (await params).id);
  if (!row) notFound();
  return <AppContact contact={contactView(row)} subRoles={(await getOrganization(db, actor.organizationId)).settings.contactSubRoles} />;
}
