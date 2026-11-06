import { requireClient } from "@/auth";
import { ClientProfile } from "@/components/platform/client-portal";
import { serif } from "@/components/platform/portal-style";
import { getDb } from "@/server/db";
import { clientProfile } from "@/server/portal-client";

export const metadata = { title: "Profile" };

// One card per firm: each firm keeps its own copy of the client's contact details.
export default async function PortalProfile() {
  const list = await clientProfile(await getDb(), await requireClient());
  return (
    <div>
      <h1 className={`${serif} text-3xl font-medium sm:text-4xl`}>Your details</h1>
      <p className="mt-2 text-[#5d6b66]">Keep these up to date so your team can reach you.</p>
      <div className="mt-8 grid gap-6">{list.map((p) => <ClientProfile key={p.clientId} p={p} />)}</div>
    </div>
  );
}
