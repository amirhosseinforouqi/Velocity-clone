"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { complianceDashboard } from "@/server/compliance";
import { dealCode, statusLabel } from "@/server/deal-status";
import { GridPanel } from "./admin";
import { complianceLabels } from "./aml-fields";
import { ManageCompliance } from "./deal-compliance";
import { AppShell } from "./shell";
import { Grid, PageHeader } from "./ui";

type Row = Awaited<ReturnType<typeof complianceDashboard>>[number];
const control = "h-[30px] rounded-[3px] border border-[#ccc] bg-white px-2 text-[12.6px] text-[#555] outline-none focus:border-[#66afe9]";
const btn = "rounded-[3px] border border-[#3d81be] bg-gradient-to-b from-[#428bcd] to-[#3d81be] px-[13px] py-1.5 text-[12.6px] text-white";
const day = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("en-CA") : "");

// GET form: the filters live in the URL, so a reload keeps them.
export function AppComplianceDashboard({ filter, rows }: { filter: { q: string; dealStatus: string; compliance: string }; rows: Row[] }) {
  return (
    <AppShell>
      <PageHeader icon={ShieldCheck} title="Compliance" crumbs={[["Compliance"], ["Dashboard"]]} />
      <GridPanel title="Compliance Dashboard">
        <form className="mb-3 flex flex-wrap items-end gap-2">
          <input name="q" defaultValue={filter.q} placeholder="Agent, client or loan code" aria-label="Search by agent, client or loan code" className={`${control} w-64`} />
          <select name="dealStatus" defaultValue={filter.dealStatus} aria-label="Deal status" className={control}>
            <option value="">All deal statuses</option>
            {Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select name="compliance" defaultValue={filter.compliance} aria-label="Compliance status" className={control}>
            <option value="">All compliance statuses</option>
            {Object.entries(complianceLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className={btn}>Search</button>
          {(filter.q || filter.dealStatus || filter.compliance) && <Link href="/compliance/dashboard" className="text-[#428bca] hover:underline">Clear</Link>}
        </form>
        <Grid
          min={1000}
          head={["Loan Code", "Client", "Agent", "Deal Status", "Amount", "Closing Date", "Compliance Status", "Package", "Last Review", ""]}
          rows={rows.map((r) => [
            <Link key="l" href={`/deal/${r.id}/conditionsAndDocuments`} className="text-[#428bca] hover:underline">{dealCode(r.number)}</Link>,
            r.borrower ?? "", r.agent, statusLabel[r.status], r.amount == null ? "" : "$" + r.amount.toLocaleString("en-CA"), r.closingDate ?? "",
            complianceLabels[r.compliance], r.lockedAt ? "Locked" : "Unlocked", day(r.reviewedAt),
            <ManageCompliance key="m" dealId={r.id} status={r.compliance} locked={!!r.lockedAt} />,
          ])}
        />
        {rows.length >= 500 && <p className="mt-2 text-[#999]">Only the 500 most recently updated deals are shown; narrow the search.</p>}
      </GridPanel>
    </AppShell>
  );
}
