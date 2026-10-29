import { notFound } from "next/navigation";
import { requireActor } from "@/auth";
import { AppContact } from "@/components/platform/contacts";
import { contactView, getContact } from "@/server/contacts";
import { getDb } from "@/server/db";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const row = await getContact(await getDb(), await requireActor(), (await params).id);
  if (!row) notFound();
  return <AppContact contact={contactView(row)} />;
}
