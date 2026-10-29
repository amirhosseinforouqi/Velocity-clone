import Link from "next/link";
import { requireClient } from "@/auth";
import { GridPanel } from "@/components/platform/admin";
import { getDb } from "@/server/db";
import { clientDeals } from "@/server/portal-client";

export const metadata = { title: "My applications" };

export default async function PortalHome() {
  const list = await clientDeals(await getDb(), await requireClient());
  return (
    <GridPanel title="My applications">
      {!list.length ? <p className="text-[#999]">You don&apos;t have access to any applications right now. If you expected one, contact your mortgage team.</p> : (
        <ul className="divide-y divide-[#eee]">
          {list.map((d) => (
            <li key={d.id}>
              <Link href={`/portal/applications/${d.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-[#f9f9f9]">
                <span className="font-semibold text-[#428bca]">Application {d.code}</span>
                <span className="text-[#777]">{d.firm}{d.purpose && ` · ${d.purpose}`}</span>
                <span className="ml-auto text-[#555]">{d.stage ?? "Getting started"}</span>
                {d.outstanding > 0 && <span className="rounded-[3px] bg-[#f0ad4e] px-1.5 text-[11px] font-semibold text-white">{d.outstanding} to upload</span>}
                {d.unread > 0 && <span className="rounded-full bg-[#d9534f] px-1.5 text-[11px] text-white">{d.unread} unread</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </GridPanel>
  );
}
