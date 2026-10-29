import { requireActor } from "@/auth";
import { AppContacts } from "@/components/platform/contacts";
import { contactView, listContacts } from "@/server/contacts";
import { getDb } from "@/server/db";

export default async function ContactsPage() {
  const rows = await listContacts(await getDb(), await requireActor());
  return <AppContacts contacts={rows.map(contactView)} />;
}
