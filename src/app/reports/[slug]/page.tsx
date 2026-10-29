import { notFound } from "next/navigation";
import { requireActor } from "@/auth";
import { reports } from "@/components/platform/placeholder-data";
import { AppReport } from "@/components/platform/reports";
import { ValidationError } from "@/server/contacts";
import { getDb } from "@/server/db";
import { statusLabel } from "@/server/deal-status";
import { builderFields, builderOps, defaultCols, oneTouch, opsFor, pendingReports, reportOptions, runReport, slaDays, type Table } from "@/server/reports";

type Search = Record<string, string | string[] | undefined>;

export default async function ReportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  const { slug } = await params;
  const title = reports.find((r) => r.slug === slug)?.title;
  if (!title) notFound();
  const actor = await requireActor();
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) for (const x of [v ?? []].flat()) q.append(k, x);

  const db = await getDb();
  const pending = pendingReports.includes(slug);
  let table: Table | null = null, error = "";
  if (!pending) {
    try {
      table = await runReport(db, actor, slug, q);
    } catch (e) {
      if (!(e instanceof ValidationError)) throw e;
      error = e.message;
    }
  }
  return (
    <AppReport
      slug={slug}
      title={title}
      query={q.toString()}
      table={table}
      error={error}
      pending={pending}
      options={await reportOptions(db, actor)}
      builder={{ fields: builderFields, ops: builderOps, opsFor, defaultCols }}
      oneTouch={oneTouch}
      slaNote={`Targets: ${(await slaDays(db, actor.organizationId)).map(([s, n]) => `${statusLabel[s]} ${n} days`).join(", ")}. Days are counted from when the deal entered its current status.`}
    />
  );
}
