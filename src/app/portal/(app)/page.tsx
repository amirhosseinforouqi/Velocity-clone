import Link from "next/link";
import { ArrowRight, CircleCheck, Upload } from "lucide-react";
import { requireClient } from "@/auth";
import { card, serif } from "@/components/platform/portal-style";
import { cn } from "@/lib/utils";
import { getDb } from "@/server/db";
import { clientDeals, clientProfile } from "@/server/portal-client";

export const metadata = { title: "My applications" };

export default async function PortalHome() {
  const [db, account] = [await getDb(), await requireClient()];
  const [list, profiles] = await Promise.all([clientDeals(db, account), clientProfile(db, account)]);
  const first = profiles[0]?.name.split(" ")[0];
  return (
    <div>
      <h1 className={cn(serif, "text-3xl font-medium sm:text-4xl")}>{first ? `Welcome back, ${first}` : "Welcome back"}</h1>
      <p className="mt-2 text-[#5d6b66]">Here&apos;s where your mortgage stands, and anything we need from you.</p>
      {!list.length ? (
        <div className={cn(card, "mt-8 p-8 text-center text-[#5d6b66]")}>You don&apos;t have access to any applications right now. If you expected one, contact your mortgage team.</div>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {list.map((d) => {
            const pct = d.steps ? Math.round((d.step / d.steps) * 100) : 0;
            return (
              <li key={d.id}>
                <Link href={`/portal/applications/${d.id}`} className={cn(card, "group block p-6 transition hover:border-[#1f5c4a]/40 hover:shadow-md")}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold tracking-[0.14em] text-[#5d6b66] uppercase">{d.firm}</p>
                      <h2 className={cn(serif, "mt-1 text-xl font-medium")}>{d.purpose ? `${d.purpose} mortgage` : "Mortgage application"}</h2>
                      <p className="text-sm text-[#8a948f]">Application {d.code}</p>
                    </div>
                    {d.unread > 0 && <span className="rounded-full bg-[#b4443a] px-2 py-0.5 text-xs font-semibold text-white">{d.unread} new message{d.unread > 1 ? "s" : ""}</span>}
                  </div>
                  <div className="mt-5">
                    <div className="flex justify-between text-sm"><span className="font-medium">{d.stage ?? "Getting started"}</span>{d.step > 0 && <span className="text-[#8a948f]">Step {d.step} of {d.steps}</span>}</div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#efebe2]" aria-hidden><div className="h-full rounded-full bg-[#1f5c4a]" style={{ width: `${pct}%` }} /></div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
                    {d.outstanding > 0
                      ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fbf0dc] px-3 py-1 font-semibold text-[#87570f]"><Upload className="size-3.5" aria-hidden />{d.outstanding} document{d.outstanding > 1 ? "s" : ""} to upload</span>
                      : d.docs > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e1f0e6] px-3 py-1 font-semibold text-[#24653f]"><CircleCheck className="size-3.5" aria-hidden />Nothing to upload</span>}
                    {d.docs > 0 && <span className="text-[#8a948f]">{d.approved} of {d.docs} approved</span>}
                    <span className="ml-auto inline-flex items-center gap-1 font-semibold text-[#1f5c4a]">Open<ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden /></span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
