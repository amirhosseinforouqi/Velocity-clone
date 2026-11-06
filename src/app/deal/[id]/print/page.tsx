import { notFound } from "next/navigation";
import { requireActor } from "@/auth";
import { fieldKey, sections } from "@/components/platform/deal-sections";
import { enChrome, frChrome, frLabel, frStatus } from "@/components/platform/print-labels";
import { getDb } from "@/server/db";
import { dealCode, statusLabel } from "@/server/deal-status";
import { getDeal } from "@/server/deals";
import { PrintButton } from "./print-button";

// Print Application (En / Fr): every filled-in workspace field, grouped like the workspace, printed or saved as PDF
// through the browser's own print dialog. The SIN prints masked to its last 3 digits.
export default async function PrintApplication({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const fr = (await searchParams).lang === "fr";
  const db = await getDb();
  const deal = await getDeal(db, await requireActor(), (await params).id);
  if (!deal) notFound();
  const t = fr ? frChrome : enChrome;
  const label = fr ? frLabel : (s: string) => s;
  const b = deal.borrowers[0];
  const applicant = { "First Name": b?.firstName, "Last Name": b?.lastName, Email: b?.email, "Home Phone": b?.homePhone, "Cell Phone": b?.cellPhone, "Work Phone": b?.workPhone };
  const values: Record<string, string> = {
    ...deal.fields,
    ...Object.fromEntries(Object.entries(applicant).map(([k, v]) => [`borrowers/Applicant/${k}`, v ?? ""])),
    "closeOut//Closing Date": deal.closingDate ?? "",
  };
  const show = (name: string, v: string) => (name === "SIN" ? v.replace(/\d(?=(?:\D*\d){3})/g, "•") : v === "Yes" ? t.yes : v === "No" ? t.no : v);
  const printed = sections.flatMap((s) =>
    s.groups.flatMap((g) => {
      const rows = (g.fields ?? []).filter((f) => !f.endsWith("|calc")).map((f) => {
        const name = f.split("|")[0];
        return [label(name), show(name, values[fieldKey(s, g, f)]?.trim() ?? "")] as const;
      }).filter(([, v]) => v);
      return rows.length ? [{ key: `${s.id}/${g.title ?? ""}`, title: [label(s.title), g.title && label(g.title)].filter(Boolean).join(" — "), rows }] : [];
    }),
  );
  return (
    <main lang={fr ? "fr" : "en"} className="mx-auto max-w-[800px] bg-white p-8 font-sans text-[12px] text-black print:p-0">
      <div className="mb-4 flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <h1 className="text-[20px] font-semibold">{t.title}</h1>
          <p>{t.deal} {dealCode(deal.number)} · {t.status}: {fr ? frStatus[deal.status] : statusLabel[deal.status]} · {t.agent}: {deal.agent}</p>
          <p>{t.applicants}: {deal.borrowers.map((x) => `${x.firstName} ${x.lastName}`).join(", ") || "—"}</p>
        </div>
        <div className="text-right">
          <PrintButton label={t.print} />
          <p className="mt-1 text-[11px] text-[#555]">{t.printed} {new Date().toLocaleDateString(fr ? "fr-CA" : "en-CA")}</p>
        </div>
      </div>
      {printed.length === 0 && <p>{t.empty}</p>}
      {printed.map((g) => (
        <section key={g.key} className="mb-3 break-inside-avoid">
          <h2 className="mb-1 bg-[#eee] px-2 py-1 font-semibold">{g.title}</h2>
          <dl className="grid grid-cols-2 gap-x-6 px-2">
            {g.rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-[#ddd] py-0.5">
                <dt className="text-[#555]">{k}</dt>
                <dd className="text-right whitespace-pre-wrap">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </main>
  );
}
