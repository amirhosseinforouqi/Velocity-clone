"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { addDealContactAction, removeDealContactAction } from "@/app/deal/actions";
import { cn } from "@/lib/utils";
import { contactRoles } from "@/server/contact-roles";
import type { listDealContacts } from "@/server/deals";
import { btn, control } from "./deal-tasks";

export type DealContactData = {
  dealId: string;
  rows: Awaited<ReturnType<typeof listDealContacts>>;
  choices: { id: string; name: string; role: string | null; company: string | null }[];
};
export const DealContactsContext = createContext<DealContactData | null>(null);

// People on the deal in a role (lawyer, realtor, referral source...). Sits inside the deal form like DealTasks:
// type="button" and unnamed inputs. With `role` set it shows and adds only that role (the Referrals tab).
export function DealContacts({ role }: { role?: string }) {
  const data = useContext(DealContactsContext);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const [draft, setDraft] = useState({ contactId: "", role: role ?? "Lawyer" });
  if (!data) return null;

  const rows = role ? data.rows.filter((r) => r.role === role) : data.rows;
  const matching = data.choices.filter((c) => c.role === draft.role);
  const others = data.choices.filter((c) => c.role !== draft.role);
  const label = (c: DealContactData["choices"][number]) => `${c.name}${c.company ? ` (${c.company})` : ""}`;
  const act = (fn: () => Promise<{ error?: string }>, then?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? "");
      if (!r.error) then?.();
    });
  const th = "border border-[#ddd] bg-[#f9f9f9] px-2 py-1.5 text-left font-semibold";
  const td = "border border-[#ddd] px-2 py-1.5";

  return (
    <div className={cn("text-[12.6px]", busy && "opacity-70")}>
      {error && <p role="alert" className="mb-2 rounded-[3px] border border-[#ebccd1] bg-[#f2dede] px-3 py-2 text-[#a94442]">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead><tr>{["Role", "Name", "Company", "Email", "Actions"].map((c) => <th key={c} className={th}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.role}</td>
                <td className={td}><a href={`/contacts/${r.contactId}`} className="text-[#428bca] hover:underline">{r.firstName} {r.lastName}</a></td>
                <td className={td}>{r.company ?? "-"}</td>
                <td className={td}>{r.email ?? "-"}</td>
                <td className={td}><button type="button" onClick={() => act(() => removeDealContactAction(r.id))} className="text-[#d9534f] hover:underline">Remove</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className={cn(td, "text-[#999]")}>No {role ? role.toLowerCase() : "contacts"} on this deal yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {!role && (
          <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} className={control} aria-label="Role on this deal">
            {contactRoles.map((r) => <option key={r}>{r}</option>)}
          </select>
        )}
        <select value={draft.contactId} onChange={(e) => setDraft({ ...draft, contactId: e.target.value })} className={cn(control, "min-w-[220px] flex-1")} aria-label="Contact">
          <option value="">-- Select a contact --</option>
          {matching.length > 0 && <optgroup label={`Role: ${draft.role}`}>{matching.map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}</optgroup>}
          <optgroup label="Other contacts">{others.map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}</optgroup>
        </select>
        <button type="button" disabled={busy || !draft.contactId} onClick={() => act(() => addDealContactAction(data.dealId, draft.contactId, draft.role), () => setDraft({ ...draft, contactId: "" }))} className={btn}>
          {role ? `Add ${role}` : "Add Contact"}
        </button>
      </div>
    </div>
  );
}
