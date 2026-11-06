import { requireClient } from "@/auth";
import { ClientProfile, PortalTitle } from "@/components/platform/client-portal";
import { getDb } from "@/server/db";
import { clientProfile } from "@/server/portal-client";

export const metadata = { title: "Profile" };

// One panel per firm: each firm keeps its own copy of the client's contact details.
export default async function PortalProfile() {
  const list = await clientProfile(await getDb(), await requireClient());
  return (
    <div>
      <PortalTitle title="Your details">Keep these up to date so your team can reach you.</PortalTitle>
      {list.map((p) => <ClientProfile key={p.clientId} p={p} />)}
    </div>
  );
}
