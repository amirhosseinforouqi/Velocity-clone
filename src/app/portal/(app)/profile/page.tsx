import { requireClient } from "@/auth";
import { ClientProfile } from "@/components/platform/client-portal";
import { getDb } from "@/server/db";
import { clientProfile } from "@/server/portal-client";

export const metadata = { title: "Profile" };

// One card per firm: each firm keeps its own copy of the client's contact details.
export default async function PortalProfile() {
  const list = await clientProfile(await getDb(), await requireClient());
  return <div className="grid gap-4">{list.map((p) => <ClientProfile key={p.clientId} p={p} />)}</div>;
}
