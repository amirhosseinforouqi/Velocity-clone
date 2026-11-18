"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { CheckCircle, ChevronDown, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { assignDealAction, deleteDealAction, duplicateDealAction, moveDealAction, saveDealAction } from "@/app/deal/actions";
import { allowedMoves, dealCode, isReinstate, statusLabel, type DealStatus } from "@/server/deal-status";
import type { dealActivity, dealHistory, getDeal } from "@/server/deals";
import { calcFields, dealMetrics, defaultQualification, type Qualification } from "@/server/metrics";
import type { DealCompliance as Compliance } from "@/server/compliance";
import type { LenderChoice } from "@/server/lenders";
import type { PortalWorkspace } from "@/server/portal";
import { LENDER, lenderFor, limitsFor, PRODUCT, type Problem } from "@/server/validate";
import { dealTabs, fieldKey, sections, selectOptions, type Group } from "./deal-sections";
import { PortalPanels, type PortalPart } from "./deal-portal";
import { InviteModal } from "./new-lead";
import { ComplianceContext, DealCompliance } from "./deal-compliance";
import { ChecklistContext, DealConditions, type Checklist } from "./deal-conditions";
import { DealContacts, DealContactsContext, type DealContactData } from "./deal-contacts";
import { DealAftercare, DealProgress, ProgressContext, type Progress } from "./deal-progress";
import { DealTasks, TasksContext, type DealTaskList } from "./deal-tasks";
import { AppShell } from "./shell";

type Deal = NonNullable<Awaited<ReturnType<typeof getDeal>>>;
type History = Awaited<ReturnType<typeof dealHistory>>;
type Activity = Awaited<ReturnType<typeof dealActivity>>;
type SaveState = { error?: string; ok?: string; problems?: Problem[] };
type Message = SaveState & { tab: string; focus: (key: string) => void };

const input = "h-[30px] w-full rounded-[3px] border border-[#ccc] bg-white px-2 text-[12.6px] text-[#555] outline-none focus:border-[#66afe9] disabled:bg-[#eee]";
const blueBtn = "rounded-[3px] border border-[#3d81be] bg-gradient-to-b from-[#428bcd] to-[#3d81be] px-[13px] py-1.5 text-[12.6px] text-white disabled:opacity-60";

// Workspace actions that need an outside service (lender portals, an external CRM, the co-broker's system), or whose
// meaning isn't settled yet (Remove); shown disabled so nothing pretends to work.
const notBuilt = ["Remove", "Submit to Lender", "Update Lender", "Queue for External CRM", "Respond - Co-Broker"];
export type Team = { staff: { id: string; name: string }[]; me: string; canReassign: boolean };

// Field values by storage key. `locked` keys mirror the contact or a column and are edited there, not here.
// `options` are the firm's own lists (lead stages, lead sources) that replace the built-in choices for a label.
const Values = createContext<{ values: Record<string, string>; locked: Set<string>; lenders: LenderChoice[]; options: Record<string, string[]>; qualification: Qualification }>({ values: {}, locked: new Set(), lenders: [], options: {}, qualification: defaultQualification });

// Lender and Product pick from the lenders this deal's agent may use, grouped; a saved name that's no longer offered stays listed.
function LenderSelect({ name, value }: { name: string; value: string }) {
  const { lenders } = useContext(Values);
  const groups = name === LENDER
    ? [...new Set(lenders.map((l) => l.group))].map((g) => [g, lenders.filter((l) => l.group === g).map((l) => l.name)] as const)
    : lenders.filter((l) => l.products.length).map((l) => [l.name, l.products] as const);
  const offered = groups.some(([, xs]) => xs.includes(value));
  return (
    <select name={name} defaultValue={value} className={input}>
      <option value="">Select...</option>
      {value && !offered && <option>{value}</option>}
      {groups.map(([g, xs]) => <optgroup key={g} label={g}>{xs.map((x) => <option key={x}>{x}</option>)}</optgroup>)}
    </select>
  );
}

function Field({ name, spec }: { name: string; spec: string }) {
  const { values, locked, options: lists } = useContext(Values);
  const [label, type] = spec.split("|");
  const value = values[name] ?? "";
  const disabled = locked.has(name);
  if (type === "check")
    return (
      <label className="flex items-center gap-2 self-end pb-1.5 text-[12.6px] font-semibold text-[#666]">
        {/* The hidden empty value is sent when the box is unticked, which clears the field. */}
        <input type="hidden" name={name} value="" />
        <input type="checkbox" name={name} value="Yes" defaultChecked={value === "Yes"} /> {label}
      </label>
    );
  if (type === "calc") return <CalcField label={label} />;
  const options = lists[label] ?? selectOptions[label];
  return (
    <label className="block text-[12.6px] text-[#666]">
      <span className="mb-1 block font-semibold">{label}</span>
      {name === LENDER || name === PRODUCT ? (
        <LenderSelect name={name} value={value} />
      ) : type === "select" && options ? (
        <select name={name} defaultValue={value} className={input}>
          <option value="">Select...</option>
          {value && !options.includes(value) && <option>{value}</option>}
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : type === "area" ? (
        <textarea name={name} defaultValue={value} rows={2} maxLength={2000} className={cn(input, "h-auto py-1")} />
      ) : (
        <input name={disabled ? undefined : name} disabled={disabled} type={type === "date" ? "date" : "text"} defaultValue={value} maxLength={2000} className={input} />
      )}
    </label>
  );
}

// A computed value (payment, totals), recomputed from the form as the user types (unsaved edits over the saved values).
function CalcField({ label }: { label: string }) {
  const { values } = useContext(Values);
  const ref = useRef<HTMLOutputElement>(null);
  const calc = calcFields[label];
  const [payment, setPayment] = useState(() => calc.value(values));
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const update = () => setPayment(calc.value({ ...values, ...(Object.fromEntries(new FormData(form)) as Record<string, string>) }));
    update();
    form.addEventListener("input", update);
    return () => form.removeEventListener("input", update);
  }, [values, calc]);
  return (
    <label className="block text-[12.6px] text-[#666]">
      <span className="mb-1 block font-semibold">{label}</span>
      <output ref={ref} title={calc.from} className={cn(input, "flex items-center bg-[#eee]")}>{money(payment === null ? null : Math.round(payment * 100) / 100)}</output>
    </label>
  );
}

function Table({ cols, rows }: { cols: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.6px]">
        <thead>
          <tr>{cols.map((c) => <th key={c} className="border-b-2 border-[#ddd] p-2 text-left font-bold whitespace-nowrap">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i} className="odd:bg-[#f9f9f9]">
                {r.map((c, j) => (
                  <td key={j} className="border-t border-[#ddd] p-2">
                    {c.startsWith("Mark as") ? <button type="button" className="text-[#428bca] hover:underline">{c}</button> : c}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr><td colSpan={cols.length} className="border-t border-[#ddd] p-2 text-center text-[#999]">No records found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function GroupView({ group, section, action }: { group: Group; section: string; action?: ReactNode }) {
  return (
    <div>
      {group.title && <h4 className="mb-2.5 flex items-center border-b border-[#eee] pb-1 text-[15px] font-semibold text-[#444]">{group.title}<span className="ml-auto">{action}</span></h4>}
      {group.fields && (
        <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {group.fields.map((f) => <Field key={f} spec={f} name={fieldKey({ id: section }, group, f)} />)}
        </div>
      )}
      {group.custom === "conditions" && <DealConditions />}
      {group.custom === "compliance" && <DealCompliance />}
      {(group.custom === "reminders" || group.custom === "tasks") && <DealTasks kind={group.custom} />}
      {group.custom === "contacts" && <DealContacts />}
      {group.custom === "referrals" && <DealContacts role="Referral Source" />}
      {group.custom === "progress" && <DealProgress />}
      {group.custom === "aftercare" && <DealAftercare />}
      {/* ponytail: the other workspace tables (notes, messages...) have no storage yet; each gets its own table when built. */}
      {group.cols && <Table cols={group.cols} rows={group.rows ?? []} />}
      {group.buttons && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {group.buttons.map((b) => <button key={b} type="button" disabled title="Not built yet" className={blueBtn}>{b}</button>)}
        </div>
      )}
    </div>
  );
}

const PROGRAM = "mortgageRequest/Mortgage Breakdown/Program";
const linkBtn = "inline-flex items-center gap-1 text-[12.6px] font-normal text-[#428bca] hover:underline";

// Numbered families (Asset 1…8, Employment 2…4): an entry shows once it has data or was added. Removing one keeps it
// recoverable until Save, then blanks its fields (the audit trail keeps the old values).
function Groups({ groups, section }: { groups: Group[]; section: string }) {
  const { values } = useContext(Values);
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const keys = (g: Group) => (g.fields ?? []).map((f) => fieldKey({ id: section }, g, f));
  const filled = (g: Group) => keys(g).some((k) => values[k]);
  const shown = (g: Group) => !removed.includes(g.title!) && (filled(g) || added.includes(g.title!));
  return groups.map((g, i) => {
    // ponytail: follows the saved Program, so the business-loan fields appear after choosing it and saving.
    if (g.title === "Business Loan" && values[PROGRAM] !== "Business Loan" && !filled(g)) return null;
    if (!g.repeat) return <GroupView key={g.title ?? i} group={g} section={section} />;
    const t = g.title!;
    const next = groups[i + 1]?.repeat === g.repeat ? null : groups.find((x) => x.repeat === g.repeat && !shown(x) && !(removed.includes(x.title!) && filled(x)));
    return (
      <div key={t} className="space-y-6 empty:hidden">
        {shown(g) ? (
          <GroupView group={g} section={section} action={
            <button type="button" className={cn(linkBtn, "text-[#a94442]")} onClick={() => {
              if (filled(g) && !confirm(`Remove ${t}? Its details are cleared when you save; until then you can undo.`)) return;
              setAdded(added.filter((x) => x !== t));
              if (filled(g)) setRemoved([...removed, t]);
            }}><Trash2 className="size-3.5" /> Remove</button>
          } />
        ) : removed.includes(t) && filled(g) ? (
          <p className="rounded-[3px] border border-[#faebcc] bg-[#fcf8e3] px-3 py-2 text-[12.6px] text-[#8a6d3b]">
            {keys(g).map((k) => <input key={k} type="hidden" name={k} value="" />)}
            {t} removed — it will be deleted when you save. <button type="button" className={linkBtn} onClick={() => setRemoved(removed.filter((x) => x !== t))}>Undo</button>
          </p>
        ) : null}
        {next && (
          <button type="button" className={linkBtn} onClick={() => { setRemoved(removed.filter((x) => x !== next.title)); setAdded([...added, next.title!]); }}>
            <Plus className="size-3.5" /> Add {g.repeat!.startsWith("Other") ? "" : /^[AEI]/.test(g.repeat!) ? "an " : "a "}{g.repeat!.toLowerCase()}
          </button>
        )}
      </div>
    );
  });
}

export function SectionBox({ id, title, groups, open }: { id?: string; title: string; groups: Group[]; open: boolean }) {
  return (
    <details open={open} className="group mb-5 rounded-[2px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
      <summary className="flex cursor-pointer list-none items-center px-5 py-3 text-lg font-light text-[#444] [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="ml-auto size-4 text-[#999] transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-6 border-t border-[#f4f4f4] px-5 py-[15px]">
        <Groups groups={groups} section={id ?? title} />
      </div>
    </details>
  );
}

const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(2)}%`);
const money = (n: number | null) => (n === null ? "—" : "$" + n.toLocaleString("en-CA", { maximumFractionDigits: 2 }));
const over = (n: number | null, limit: number) => (n !== null && n > limit ? "font-semibold text-[#c9302c]" : undefined);

const moveLabel = (from: DealStatus, to: DealStatus) =>
  to === "parked" ? "Park" : to === "cancelled" ? "Cancel" : isReinstate(from) ? `Reinstate to ${statusLabel[to]}` : `Move to ${statusLabel[to]}`;

const btn = "rounded-[3px] border border-[#ccc] bg-white px-3 py-1.5 text-[12.6px] text-[#333] hover:bg-[#f5f5f5] disabled:opacity-60";
const chip = "rounded-full border px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap";
const tones = { grey: "border-[#ddd] bg-[#f5f5f5] text-[#666]", blue: "border-[#bce8f1] bg-[#d9edf7] text-[#31708f]", green: "border-[#d6e9c6] bg-[#dff0d8] text-[#3c763d]", amber: "border-[#faebcc] bg-[#fcf8e3] text-[#8a6d3b]", red: "border-[#ebccd1] bg-[#f2dede] text-[#a94442]" };

// Where the primary applicant's portal invitation stands. "Sent" only when an email really went out.
function portalStatus(w: PortalWorkspace): [string, keyof typeof tones] {
  const a = w.applicants.find((x) => x.primary);
  const inv = a?.invitations.find((i) => i.status !== "revoked");
  if (inv?.status === "accepted" || a?.lastSignInAt) return ["Portal account activated", "green"];
  if (!inv) return ["Not invited to portal", "grey"];
  if (inv.status === "expired") return ["Invitation expired", "red"];
  if (inv.delivery && ["failed", "bounced", "complained"].includes(inv.delivery.status)) return ["Invitation delivery failed", "red"];
  return inv.sentCount ? ["Invitation sent — pending", "blue"] : ["Invitation prepared — not emailed", "amber"];
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div><span className="block text-[11px] text-[#999] uppercase">{label}</span><span className="text-[13px] text-[#333]">{children}</span></div>;
}

// Who the client is, what they need and where the file stands; everything else lives in the tabs below.
function Header({ deal, team, portal, tasks, go, message, saving }: { deal: Deal; team: Team; portal: PortalWorkspace; tasks: DealTaskList; go: (slug: string) => void; message: Message; saving: boolean }) {
  const [moved, setMoved] = useState<{ error?: string }>({});
  const [inviting, setInviting] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const closeMenus = () => document.querySelectorAll("#deal-header details[open]").forEach((d) => d.removeAttribute("open"));
  const code = dealCode(deal.number);
  const remove = () => {
    closeMenus();
    if (!confirm(`Delete ${code}? It disappears from every list. An admin can restore it from Admin > Recently Deleted.`)) return;
    start(async () => {
      const r = await deleteDealAction(deal.id);
      if (r.error) setMoved(r);
      else router.push("/");
    });
  };
  const move = (to: DealStatus) => {
    closeMenus();
    if ((to === "parked" || to === "cancelled") && !confirm(`${moveLabel(deal.status, to)} ${code}?`)) return;
    start(async () => setMoved(await moveDealAction(deal.id, to)));
  };
  const duplicate = () => {
    closeMenus();
    if (!confirm(`Duplicate ${code}? The copy keeps the borrowers, contacts and application fields; dates, conditions, documents and tasks start fresh.`)) return;
    start(async () => {
      const r = await duplicateDealAction(deal.id);
      if (r.error) setMoved(r);
      else router.push(`/deal/${r.id}`);
    });
  };
  const assign = (input: { agentId?: string; assigneeId?: string | null }, ask?: string) => {
    closeMenus();
    if (ask && !confirm(ask)) return;
    start(async () => setMoved(await assignDealAction(deal.id, input)));
  };
  const nameOf = (id: string) => team.staff.find((u) => u.id === id)?.name ?? "";
  // The current agent / assignee stay listed even when they're outside the pickable staff (deactivated, other office).
  const withCurrent = (id: string | null, name: string | null) => (id && name && !team.staff.some((u) => u.id === id) ? [{ id, name }, ...team.staff] : team.staff);
  const item = "block w-full px-4 py-1.5 text-left hover:bg-[#f5f5f5] disabled:text-[#aaa] disabled:hover:bg-transparent";
  const menuList = "absolute right-0 z-20 mt-1 w-56 rounded-[3px] border border-[#ddd] bg-white py-1 text-[12.6px] text-[#333] shadow-lg";
  const summary = cn(btn, "flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden");
  const note = moved.error ?? message.error;
  const dateInput = "h-[26px] rounded-[3px] border border-[#ccc] bg-white px-1 text-[12.6px] text-[#555]";
  // From the saved values, so the ratios change after Save.
  const f = deal.fields;
  const ctx = useContext(Values);
  const m = dealMetrics(f, ctx.qualification);
  const LIMITS = limitsFor(lenderFor(f, ctx.lenders));
  const breakdown: [string, string][] = [
    ["Qualifying rate", pct(m.parts.qualifyingRate)], ["Mortgage payment", money(m.parts.payment)], ["Property taxes", money(m.parts.taxes)],
    ["Heat", money(m.parts.heat)], ["Condo fees", money(m.parts.condo)], ["Other debts", money(m.parts.other)], ["Gross monthly income", money(m.parts.monthlyIncome)],
  ];
  const b = deal.borrowers[0];
  const phone = b?.cellPhone ?? b?.homePhone ?? b?.workPhone;
  const kind = f[PROGRAM] === "Business Loan" ? "Business Loan" : f["mortgageRequest/Mortgage Breakdown/Application Purpose"] || "Application type not set";
  const stage = deal.status === "lead" ? `Lead · ${f["lead//Lead Stage"] || "New Lead"}` : statusLabel[deal.status];
  const [portalLabel, portalTone] = portalStatus(portal);
  const canInvite = portalTone === "grey" || portalLabel === "Invitation expired";
  const missing = portal.requests.filter((r) => r.status === "requested" || r.status === "replacement_required").length;
  const toReview = portal.requests.filter((r) => r.status === "uploaded" || r.status === "under_review").length;
  const unread = portal.conversations.reduce((n, c) => n + c.unread, 0);
  const nextTask = tasks.tasks.find((t) => !t.done);
  const next = nextTask ? `${nextTask.title}${nextTask.dueDate ? ` — due ${nextTask.dueDate}` : ""}` : f["lead//Next Step"];
  const badge: Record<string, number> = { documents: missing + toReview, messages: unread, tasks: tasks.tasks.filter((t) => !t.done).length };
  return (
    <div id="deal-header" className="mx-[25px] mb-4">
      <div className="rounded-t-[3px] bg-white px-5 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.12)]">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-baseline gap-x-2.5 text-[24px] leading-tight font-medium text-[#333]">
              {b ? `${b.firstName} ${b.lastName}` : "No client"}
              <span className="text-[13px] font-normal text-[#999]">{code}</span>
            </h1>
            <p className="mt-0.5 flex flex-wrap gap-x-4 text-[13.5px] text-[#555]">
              {phone ? <a href={`tel:${phone}`} className="hover:underline">{phone}</a> : <span className="text-[#999]">No phone</span>}
              {b?.email ? <a href={`mailto:${b.email}`} className="hover:underline">{b.email}</a> : <span className="text-[#999]">No email</span>}
              {deal.borrowers.slice(1).map((c) => <Link key={c.id} href={`/contacts/${c.id}`} className="text-[#428bca] hover:underline">+ {c.firstName} {c.lastName}</Link>)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={cn(chip, tones.blue)}>{kind}</span>
              <span className={cn(chip, tones.grey)}>{stage}</span>
              <span className={cn(chip, tones[portalTone])}>{portalLabel}</span>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {b && <Link href={`/contacts/${b.id}`} className={btn}>Edit Client</Link>}
            <button type="button" className={btn} onClick={() => go("documents")}>Upload Document</button>
            <button type="button" className={btn} onClick={() => go("messages")}>Send Message</button>
            {canInvite && b && (
              <button type="button" className={btn} disabled={!b.email} title={b.email ? undefined : "Add the client's email first"} onClick={() => setInviting(true)}>Invite Client</button>
            )}
            <details data-dropdown className="relative">
              <summary className={summary}>{pending ? "Working..." : "Change Stage"} <ChevronDown className="size-3.5" /></summary>
              <ul className={menuList}>
                {allowedMoves(deal.status, deal.previousStatus).map((to) => (
                  <li key={to}><button type="button" onClick={() => move(to)} className={item}>{moveLabel(deal.status, to)}</button></li>
                ))}
                {deal.status === "lead" && <li><button type="button" onClick={() => { closeMenus(); go("client"); }} className={item}>Set lead stage…</button></li>}
              </ul>
            </details>
            <details data-dropdown className="relative">
              <summary className={summary}>More Actions <ChevronDown className="size-3.5" /></summary>
              <ul className={menuList}>
                <li><button type="submit" form="deal-form" name="intent" value="validate" onClick={closeMenus} className={item}>Save + Validate</button></li>
                <li><button type="button" onClick={duplicate} className={item}>Duplicate</button></li>
                <li>
                  <button type="button" disabled={deal.assigneeId === team.me || !team.staff.some((u) => u.id === team.me)} className={item} onClick={() => assign({ assigneeId: team.me })}>Assign to Me</button>
                </li>
                {(["en", "fr"] as const).map((l) => (
                  <li key={l}><a href={`/deal/${deal.id}/print?lang=${l}`} target="_blank" rel="noopener" onClick={closeMenus} className={item}>Print Application ({l === "en" ? "En" : "Fr"})</a></li>
                ))}
                <li><button type="button" onClick={remove} className={cn(item, "text-[#a94442]")}>Delete</button></li>
                {notBuilt.map((a) => (
                  <li key={a}><button type="button" disabled title="Not built yet" className={item}>{a}</button></li>
                ))}
              </ul>
            </details>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2 border-t border-[#f0f0f0] pt-2.5">
          {/* Not part of the deal form; each change saves on its own. */}
          <Fact label="Agent">
            <select aria-label="Agent" value={deal.agentId} disabled={!team.canReassign || pending} className="max-w-[150px] text-[13px]"
              onChange={(e) => assign({ agentId: e.target.value }, `Reassign ${code} to ${nameOf(e.target.value)}? They become the file's agent.`)}>
              {withCurrent(deal.agentId, deal.agent).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Fact>
          <Fact label="Assistant">
            <select aria-label="Assistant" value={deal.assigneeId ?? ""} disabled={pending} className="max-w-[150px] text-[13px]" onChange={(e) => assign({ assigneeId: e.target.value || null })}>
              <option value="">Nobody</option>
              {withCurrent(deal.assigneeId, deal.assignee).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Fact>
          <Fact label="GDS"><span className={over(m.gds, LIMITS.gds)}>{pct(m.gds)}</span></Fact>
          <Fact label="TDS">
            <details data-dropdown className="relative">
              <summary className={cn("flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden", over(m.tds, LIMITS.tds))}>{pct(m.tds)} <ChevronDown className="size-3" /></summary>
              <dl className="absolute z-20 mt-1 grid w-64 grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-[3px] border border-[#ddd] bg-white p-3 text-[12px] text-[#333] shadow-lg">
                {breakdown.map(([k, v]) => [<dt key={k}>{k}</dt>, <dd key={k + "v"} className="text-right">{v}</dd>])}
              </dl>
            </details>
          </Fact>
          <Fact label="LTV"><span className={over(m.ltv, LIMITS.uninsuredLtv)}>{pct(m.ltv)}</span></Fact>
          <Fact label="Closing"><input form="deal-form" type="date" name="closingDate" defaultValue={deal.closingDate ?? ""} className={dateInput} /></Fact>
          <Fact label="Conditions due"><input form="deal-form" type="date" name="conditionsDate" defaultValue={deal.conditionsDate ?? ""} className={dateInput} /></Fact>
          <Fact label="Lawyer instructed"><input form="deal-form" type="date" name="lawyerInstructedDate" defaultValue={deal.lawyerInstructedDate ?? ""} className={dateInput} /></Fact>
          {deal.submittedDate && <Fact label="Submitted">{deal.submittedDate}</Fact>}
        </div>
        <p className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-[12.6px] text-[#555]">
          <button type="button" onClick={() => go("documents")} className="hover:underline">
            <strong>Documents:</strong> {portal.requests.length ? `${missing} missing · ${toReview} to review · ${portal.requests.length - missing - toReview} accepted` : "no checklist yet"}
          </button>
          <button type="button" onClick={() => go("tasks")} className="hover:underline"><strong>Next action:</strong> {next || "none set"}</button>
        </p>
      </div>
      <div className="sticky top-[65px] z-10 rounded-b-[3px] border-t border-[#e5e5e5] bg-[#fafafa] shadow-[0_2px_4px_rgba(0,0,0,0.12)]">
        <div className="flex items-center gap-3 pr-3">
          <nav role="tablist" aria-label="Application sections" className="flex flex-1 overflow-x-auto">
            {dealTabs.map((t) => (
              <button key={t.slug} type="button" role="tab" id={`tab-${t.slug}`} aria-selected={t.slug === message.tab} onClick={() => go(t.slug)}
                className={cn("border-b-[3px] px-3.5 py-2.5 text-[13px] whitespace-nowrap", t.slug === message.tab ? "border-[#428bca] bg-white font-semibold text-[#333]" : "border-transparent text-[#666] hover:bg-white")}>
                {t.label}{badge[t.slug] ? <span className="ml-1.5 rounded-full bg-[#d9534f] px-1.5 text-[11px] font-normal text-white">{badge[t.slug]}</span> : null}
              </button>
            ))}
          </nav>
          <button type="submit" form="deal-form" disabled={saving} className={blueBtn}>{saving ? "Saving…" : "Save"}</button>
        </div>
        {(note || message.ok) && (
          <div role="status" className={cn("flex items-center gap-2 border-t px-[15px] py-2 text-[12.6px]", note ? "border-[#ebccd1] bg-[#f2dede] text-[#a94442]" : "border-[#d6e9c6] bg-[#dff0d8] text-[#3c763d]")}>
            {!note && <CheckCircle className="size-4" />} {note ?? message.ok}
          </div>
        )}
        {message.problems && (
          <div className={cn("border-t px-[15px] py-2 text-[12.6px]", message.problems.length ? "border-[#ebccd1] bg-[#f2dede] text-[#a94442]" : "border-[#d6e9c6] bg-[#dff0d8] text-[#3c763d]")}>
            {message.problems.length ? (
              <>
                <strong>Validation Errors</strong>
                <ul className="mt-1 list-disc pl-5">
                  {message.problems.map((p) => (
                    <li key={p.message}><button type="button" onClick={() => message.focus(p.key)} className="text-left hover:underline">{p.message}</button></li>
                  ))}
                </ul>
              </>
            ) : "No errors"}
          </div>
        )}
      </div>
      {inviting && b && <InviteModal dealId={deal.id} contactId={b.id} name={`${b.firstName} ${b.lastName}`} email={b.email ?? ""} close={() => setInviting(false)} />}
    </div>
  );
}

// Which portal panels belong to a tab, and whether they sit above or below that tab's application fields.
const portalParts: Record<string, PortalPart> = { documents: "documents", messages: "messages", lender: "stage", activity: "activity" };

export function AppDeal({ deal, team, history, checklist, compliance, tasks, contacts, progress, lenders, activity, portal, orgAdmin, lists, qualification, tab: initial = "client" }: { qualification: Qualification; deal: Deal; team: Team; history: History; checklist: Checklist; compliance: Compliance; tasks: DealTaskList; contacts: DealContactData; progress: Progress; lenders: LenderChoice[]; activity: Activity; portal: PortalWorkspace; orgAdmin: boolean; lists: Record<string, string[]>; tab?: string }) {
  const [state, save, saving] = useActionState(async (prev: SaveState | null, form: FormData): Promise<SaveState> => {
    const r = await saveDealAction(deal.id, prev, form);
    return r.error ? r : { ok: "Saved", problems: r.problems };
  }, null);
  const [tab, setTab] = useState(initial);
  const [linked, setLinked] = useState(initial);
  if (linked !== initial) { setLinked(initial); setTab(initial); } // a link to another section of the same file
  // Switching sections never leaves the page, so unsaved edits in other sections survive; the address still follows.
  const go = (slug: string) => { setTab(slug); window.history.replaceState(null, "", `/deal/${deal.id}/${slug}`); };
  // Opens the section holding a reported field and puts the cursor in it.
  const focus = (key: string) => {
    const el = document.getElementsByName(key)[0];
    const slug = el?.closest<HTMLElement>("[data-tab]")?.dataset.tab;
    if (slug) go(slug);
    el?.closest("details")?.setAttribute("open", "");
    setTimeout(() => el?.focus());
  };
  const b = deal.borrowers[0];
  const applicant = { "First Name": b?.firstName, "Last Name": b?.lastName, Email: b?.email, "Home Phone": b?.homePhone, "Cell Phone": b?.cellPhone, "Work Phone": b?.workPhone };
  const mirrored = { ...Object.fromEntries(Object.entries(applicant).map(([k, v]) => [`borrowers/Applicant/${k}`, v ?? ""])), "closeOut//Closing Date": deal.closingDate ?? "" };
  const values = { values: { ...deal.fields, ...mirrored }, locked: new Set(Object.keys(mirrored)), lenders, options: lists, qualification };
  const part = portalParts[tab];
  const panels = part && <PortalPanels w={portal} orgAdmin={orgAdmin} part={part} />;
  return (
    <AppShell deal={{ id: deal.id, number: deal.number }}>
      <ChecklistContext value={checklist}>
      <ComplianceContext value={compliance}>
      <TasksContext value={tasks}>
      <DealContactsContext value={contacts}>
      <ProgressContext value={progress}>
      <Values value={values}>
        <Header deal={deal} team={team} portal={portal} tasks={tasks} go={go} saving={saving} message={{ ...state, tab, focus }} />
        {tab === "client" && b && (
          <p className="mx-[25px] mb-3 text-[12.6px] text-[#777]">
            Name, email and phone belong to the client record and are shared by all of their files — <Link href={`/contacts/${b.id}`} className="text-[#428bca] hover:underline">edit them on the client</Link>. Everything else is edited here.
          </p>
        )}
        {(part === "documents" || part === "messages") && panels}
        {/* Not action={save}: React resets the form after an action, and selects reset to their mount-time value, which wiped saved choices. */}
        <form
          id="deal-form"
          aria-busy={saving}
          className="mx-[25px]"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
            startTransition(() => save(data));
          }}
        >
          {/* Every section stays mounted so one Save covers the whole application; only the chosen one is visible. */}
          {dealTabs.map((t) => (
            <div key={t.slug} data-tab={t.slug} role="tabpanel" aria-labelledby={`tab-${t.slug}`} hidden={t.slug !== tab}>
              {t.parts.map((p) => {
                const sec = sections.find((x) => x.id === p.section)!;
                return <SectionBox key={sec.id} id={sec.id} title={p.title ?? sec.title} groups={p.only ? sec.groups.filter(p.only) : sec.groups} open />;
              })}
            </div>
          ))}
        </form>
        {(part === "stage" || part === "activity") && panels}
        <div className="mx-[25px]">
          {tab === "lender" && (
            <SectionBox title="Stage History" open groups={[{ cols: ["Date", "From", "To", "By"], rows: history.map((h) => [new Date(h.at).toLocaleString("en-CA"), h.from ? statusLabel[h.from] : "Created", statusLabel[h.to], h.actor]) }]} />
          )}
          {tab === "activity" && (
            <SectionBox title="File Activity" open groups={[{ cols: ["Date", "By", "Action", "Details"], rows: activity.map((a) => [new Date(a.at).toLocaleString("en-CA"), a.by, `${a.entity === "deal" ? "" : `${a.entity} `}${a.action}`.replaceAll("_", " "), a.detail]) }]} />
          )}
        </div>
      </Values>
      </ProgressContext>
      </DealContactsContext>
      </TasksContext>
      </ComplianceContext>
      </ChecklistContext>
    </AppShell>
  );
}
