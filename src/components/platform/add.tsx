"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createContactAction, findDuplicatesAction } from "@/app/contacts/actions";
import { createContactDealAction, myLenderChoicesAction } from "@/app/deal/actions";
import { clientExperienceAction } from "@/app/deal/portal-actions";
import { defaultDocuments, documentCatalog, employments, services, type Employment, type Service } from "@/server/doc-rules";
import type { LenderChoice } from "@/server/lenders";
import type { ChecklistItem } from "@/server/schema";
import { useSession } from "next-auth/react";
import type { Contact } from "./placeholder-data";
import { blueBtn, greenBtn, greyBtn, input, label, Modal } from "./ui";

export type AddKind = "clientExperience" | "application" | "contact" | "lead";

// Existing contacts (that this user can see) whose names start with what has been typed.
function useDuplicates(first: string, last: string) {
  const [dupes, setDupes] = useState<Contact[]>([]);
  useEffect(() => {
    let live = true;
    findDuplicatesAction(first, last).then((d) => live && setDupes(d));
    return () => { live = false; };
  }, [first, last]);
  return dupes;
}

function Errors({ list }: { list: string[] }) {
  if (!list.length) return null;
  return (
    <div className="mb-3 rounded-[4px] border border-[#ebccd1] bg-[#f2dede] p-2.5 text-[12.6px] text-[#a94442]">
      <strong>Validation Errors</strong>
      <ul className="ml-4 list-disc">{list.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );
}

function Field({ text, children, wide }: { text: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className={label}>{text}</span>
      {children}
    </label>
  );
}

function AgentSelect() {
  return (
    <select className={input}><option>{useSession().data?.user?.name}</option></select>
  );
}

// Add Contact / Add Lead share one form; a lead also gets a follow-up reminder.
function ContactModal({ lead, close }: { lead: boolean; close: () => void }) {
  const router = useRouter();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, startSaving] = useTransition();
  const dupes = useDuplicates(first, last);
  const save = (form: FormData) => {
    const e = [!first.trim() && "First Name is required.", !last.trim() && "Last Name is required."].filter((x): x is string => !!x);
    setErrors(e);
    if (e.length) return;
    startSaving(async () => {
      const res = lead ? await createContactDealAction("lead", form) : await createContactAction(form);
      if (res.error) return setErrors([res.error]);
      close();
      router.push(lead ? `/deal/${res.id}` : `/contacts/${res.id}`);
    });
  };
  return (
    <Modal
      title={lead ? "Add a New Lead" : "Add a new contact"}
      close={close}
      footer={<>
        <button type="submit" form="add-contact" disabled={saving} className={cn(blueBtn, "px-3 py-1.5 text-[12.6px] disabled:opacity-60")}>{saving ? "Saving…" : "Save"}</button>
        <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Close</button>
      </>}
    >
      <Errors list={errors} />
      {dupes.length > 0 && (
        <div className="mb-3 rounded-[4px] border border-[#faebcc] bg-[#fcf8e3] p-2.5 text-[12.6px] text-[#8a6d3b]">
          <strong>Duplicates found!</strong> Are you looking for one of these contacts:
          <ul className="mt-1">
            {dupes.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-0.5">
                {c.firstName} {c.lastName} {c.email && <span className="text-[#999]">({c.email})</span>}
                <Link href={`/contacts/${c.id}`} onClick={close} className="ml-auto text-[#428bca] hover:underline">Open Contact</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Saved: names, email, phones, CASL, and for a lead its deal with the follow-up date. Agent (always you for now), preference, DOB and notes are not stored yet. */}
      <form id="add-contact" action={save} className="grid gap-3 sm:grid-cols-2">
        <Field text="For Agent:"><AgentSelect /></Field>
        <Field text="Contact Preference:">
          <select className={input}>{["Select", "Home Phone", "Cell Phone", "Email", "Work Phone"].map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
        <Field text="First Name:"><input name="firstName" value={first} onChange={(e) => setFirst(e.target.value)} className={input} /></Field>
        <Field text="Last Name:"><input name="lastName" value={last} onChange={(e) => setLast(e.target.value)} className={input} /></Field>
        <Field text="Email:"><input name="email" type="email" className={input} /></Field>
        <label className="flex items-center gap-2 self-end pb-1.5 text-[12.6px] font-semibold text-[#666]"><input name="casl" type="checkbox" /> CASL Opt In:</label>
        <Field text="Home Phone:"><input name="homePhone" type="tel" className={input} /></Field>
        <Field text="Cell Phone:"><input name="cellPhone" type="tel" className={input} /></Field>
        <Field text="Marital Status:">
          <select className={input}>{["", "Single", "Married", "Widowed", "Separated", "Divorced", "Common Law"].map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
        <Field text="DOB:"><input type="date" className={input} /></Field>
        <Field text="Language:"><select className={input}><option>English</option><option>Français</option></select></Field>
        <Field text="Activity Type:">
          <select className={input}>{["Phone Call", "Email", "Appointment", "Other"].map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
        {lead && <Field text="Follow Up Reminder:" wide><input name="followUpDate" type="date" className={input} /></Field>}
        <Field text="Notes:" wide><textarea rows={3} className={cn(input, "h-auto py-1")} /></Field>
      </form>
    </Modal>
  );
}

function ApplicationModal({ close }: { close: () => void }) {
  const router = useRouter();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, startSaving] = useTransition();
  const dupes = useDuplicates(first, last);
  const [lenders, setLenders] = useState<LenderChoice[]>([]);
  useEffect(() => void myLenderChoicesAction().then(setLenders), []);
  const save = (form: FormData) => {
    const e = [!first.trim() && "First Name is required.", !last.trim() && "Last Name is required."].filter((x): x is string => !!x);
    setErrors(e);
    if (e.length) return;
    startSaving(async () => {
      const res = await createContactDealAction("new_deal", form);
      if (res.error) return setErrors([res.error]);
      close();
      router.push(`/deal/${res.id}`);
    });
  };
  return (
    <Modal
      title="Add Application"
      close={close}
      footer={<>
        <button type="submit" form="add-application" disabled={saving} className={cn(blueBtn, "px-3 py-1.5 text-[12.6px] disabled:opacity-60")}>{saving ? "Saving…" : "Save"}</button>
        <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
      </>}
    >
      <Errors list={errors} />
      {/* Saved: a new contact and its deal (closing date, lender, amount). Reference # and Agent (always you for now) are not stored yet. */}
      <form id="add-application" action={save}>
        <h5 className="mb-2 border-b border-[#eee] pb-1 font-semibold text-[#428bca]">Client</h5>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field text="First Name"><input name="firstName" value={first} onChange={(e) => setFirst(e.target.value)} className={input} /></Field>
          <Field text="Last Name"><input name="lastName" value={last} onChange={(e) => setLast(e.target.value)} className={input} /></Field>
          <label className="flex items-center gap-2 text-[12.6px] font-semibold text-[#666] sm:col-span-2"><input name="casl" type="checkbox" /> CASL Opt In</label>
        </div>
        {dupes.length > 0 && (
          <div className="my-3 rounded-[4px] border border-[#bce8f1] bg-[#d9edf7] p-2.5 text-[12.6px] text-[#31708f]">
            Are you looking for one of these contacts:
            {dupes.map((c) => (
              <div key={c.id} className="mt-1.5 flex flex-wrap items-center gap-x-3 border-t border-[#bce8f1] pt-1.5">
                <strong>{c.firstName} {c.lastName}</strong>
                <span>Email: {c.email ?? "-"}</span>
                <span>Home Phone: {c.homePhone ?? "-"}</span>
                <span>Cell Phone: {c.cellPhone ?? "-"}</span>
                <Link href={`/contacts/${c.id}`} onClick={close} className="ml-auto text-[#428bca] hover:underline">View Contact</Link>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field text="Reference #"><input className={input} /></Field>
          <Field text="Closing Date"><input name="closingDate" type="date" className={input} /></Field>
          <Field text="Agent"><AgentSelect /></Field>
          <Field text="Lender">
            <select name="lender" className={input} defaultValue="">
              <option value="">Select a lender</option>
              {[...new Set(lenders.map((l) => l.group))].map((g) => (
                <optgroup key={g} label={g}>{lenders.filter((l) => l.group === g).map((l) => <option key={l.name}>{l.name}</option>)}</optgroup>
              ))}
            </select>
          </Field>
          <Field text="Mortgage Amount"><input name="amount" type="number" min={0} step={1000} placeholder="$" className={input} /></Field>
        </div>
      </form>
    </Modal>
  );
}

type Borrower = { firstName: string; lastName: string; email: string };
type Invite = { status: string; error: string | null; login: { link: string; username: string; password: string | null; expires: string | null } | null };
const catalog = Object.values(documentCatalog);
const choice = (on: boolean) => cn("flex-1 rounded-[3px] border p-3 text-left", on ? "border-[#428bca] bg-[#eaf2fa] text-[#2a6496]" : "border-[#ddd] hover:border-[#aaa]");

// New client → deal + document requests (from the document rules, adjusted for this client) + portal invite with the welcome email.
function ClientExperienceModal({ close }: { close: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [service, setService] = useState<Service | null>(null);
  const [employment, setEmployment] = useState<Employment | null>(null);
  const [firstTimeBuyer, setFirstTimeBuyer] = useState(false);
  const [docs, setDocs] = useState<ChecklistItem[]>([]);
  const [rulesFor, setRulesFor] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [primary, setPrimary] = useState(0);
  const [draft, setDraft] = useState<Borrower>({ firstName: "", lastName: "", email: "" });
  const [draftErrors, setDraftErrors] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, startSending] = useTransition();
  const [done, setDone] = useState<{ dealId: string; invite: Invite } | null>(null);
  const steps = ["Service", "Employment", "Documents", "Client details"];

  const addBorrower = () => {
    const e = [!draft.firstName.trim() && "First Name required", !draft.lastName.trim() && "Last Name required", !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()) && "A valid Email is required"].filter((x): x is string => !!x);
    setDraftErrors(e);
    if (e.length) return;
    setBorrowers([...borrowers, draft]);
    setDraft({ firstName: "", lastName: "", email: "" });
  };
  const next = () => {
    const e = step === 0 ? !service && "Choose a service." : step === 1 ? !employment && "Choose the employment status." : step === 2 && !docs.length && "Choose at least one document.";
    setErrors(e ? [e] : []);
    if (e) return;
    // The rules fill the list when service or employment changes; edits survive going back and forth otherwise.
    if (step === 1 && rulesFor !== `${service}|${employment}`) {
      setDocs(defaultDocuments(service!, employment!));
      setRulesFor(`${service}|${employment}`);
      setEditing(null);
    }
    setStep(step + 1);
  };
  const send = () => {
    if (!borrowers.length) return setErrors(["Add the client."]);
    const ordered = [borrowers[primary], ...borrowers.filter((_, i) => i !== primary)];
    startSending(async () => {
      const r = await clientExperienceAction({ service, employment, firstTimeBuyer, documents: docs, borrowers: ordered });
      if (r.error || !r.data) return setErrors([r.error ?? "Something went wrong"]);
      setDone(r.data);
      router.refresh();
    });
  };
  const setDoc = (i: number, patch: Partial<ChecklistItem>) => setDocs(docs.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  if (done) {
    const p = borrowers[primary];
    const l = done.invite.login;
    const text = l && `Sign in: ${l.link}\nUsername: ${l.username}\n` + (l.password ? `Temporary password: ${l.password}\nIt stops working on ${l.expires}. You'll choose your own password when you first sign in.` : "Password: the one you already use for this portal");
    return (
      <Modal title="CREATE A CLIENT EXPERIENCE" close={close} footer={<>
        <Link href={`/deal/${done.dealId}/clientPortal`} onClick={close} className={cn(blueBtn, "px-3 py-1.5 text-[12.6px]")}>Open client portal</Link>
        <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Close</button>
      </>}>
        <p className="mb-2 flex items-center gap-2 text-[#3c763d]"><Check className="size-5" /> Deal and client portal created for {p.firstName} {p.lastName}, with {docs.length} documents requested.</p>
        {done.invite.status === "sent" ? (
          <p className="text-[12.6px] text-[#666]">The welcome email with their portal sign-in went to {p.email}.</p>
        ) : (
          <div role="status" className="rounded-[3px] border border-[#faebcc] bg-[#fcf8e3] p-3 text-[12.6px] text-[#8a6d3b]">
            <p><strong>The welcome email was not sent.</strong> {done.invite.status === "not_configured" ? "Email sending isn't set up." : done.invite.error ?? "The email couldn't be sent."} Give them these sign-in details another way (they aren&apos;t shown again):</p>
            {text && <>
              <textarea readOnly rows={4} value={text} onFocus={(e) => e.target.select()} aria-label="Portal sign-in details" className={cn(input, "mt-2 h-auto font-mono")} />
              <button onClick={() => navigator.clipboard?.writeText(text)} className={cn(blueBtn, "mt-2 px-3 py-1")}>Copy</button>
            </>}
          </div>
        )}
      </Modal>
    );
  }

  const byCategory = Object.entries(Object.groupBy(docs.map((d, i) => ({ d, i })), ({ d }) => d.category));
  const left = catalog.filter((c) => !docs.some((d) => d.name === c.name));
  return (
    <Modal
      wide
      title="CREATE A CLIENT EXPERIENCE"
      close={close}
      footer={<>
        {step > 0 && <button onClick={() => { setErrors([]); setStep(step - 1); }} className={cn(greyBtn, "mr-auto px-3 py-1.5 text-[12.6px]")}>Previous</button>}
        {step < 3 ? (
          <button onClick={next} className={cn(blueBtn, "px-3 py-1.5 text-[12.6px]")}><strong>Next:</strong> {steps[step + 1]}</button>
        ) : (
          <button onClick={send} disabled={sending} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px] disabled:opacity-60")}>{sending ? "Sending…" : "Create & send welcome email"}</button>
        )}
        <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
      </>}
    >
      <p className="mb-3 text-[#666]">Set up the client&apos;s file and portal, and send the welcome email that asks for their documents.</p>
      <ol className="mb-4 flex flex-wrap gap-2 text-[12.6px]">
        {steps.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2 rounded-[3px] px-3 py-1.5", i === step ? "bg-[#428bca] text-white" : i < step ? "bg-[#dff0d8] text-[#3c763d]" : "bg-[#f1f1f1] text-[#999]")}>
            <span className="grid size-5 place-items-center rounded-full bg-white/30 font-semibold">{i + 1}</span> {s}
          </li>
        ))}
      </ol>
      <Errors list={errors} />

      {step === 0 && (
        <div className="flex flex-col gap-2 text-[12.6px] sm:flex-row" role="radiogroup" aria-label="Service">
          {services.map((s) => (
            <button key={s} role="radio" aria-checked={service === s} onClick={() => setService(s)} className={choice(service === s)}><strong>{s}</strong></button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="text-[12.6px]">
          <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-label="Employment">
            {employments.map((e) => (
              <button key={e} role="radio" aria-checked={employment === e} onClick={() => setEmployment(e)} className={choice(employment === e)}><strong>{e}</strong></button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-[#666]"><input type="checkbox" checked={firstTimeBuyer} onChange={(e) => setFirstTimeBuyer(e.target.checked)} /> This is a first-time home buyer</label>
        </div>
      )}

      {step === 2 && (
        <div className="text-[12.6px]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <strong className="text-[#444]">Documents required</strong>
            {[service, employment, firstTimeBuyer && "First-time buyer"].filter(Boolean).map((b) => <span key={String(b)} className="rounded-full bg-[#eaf2fa] px-2 py-0.5 text-[11px] text-[#2a6496]">{b}</span>)}
          </div>
          <p className="mb-3 text-[#666]">{docs.length} document{docs.length === 1 ? "" : "s"} selected automatically from your document rules. Adjust them for this client; the rules for other clients stay as they are.</p>
          {byCategory.map(([cat, list]) => (
            <div key={cat} className="mb-3">
              <h6 className="mb-1 text-[11px] font-semibold tracking-wide text-[#999] uppercase">{cat}</h6>
              {list!.map(({ d, i }) => (
                <div key={i} className="flex items-start gap-3 border border-[#ddd] p-2 [&+&]:border-t-0">
                  {editing === i ? (
                    <div className="grid flex-1 gap-1.5">
                      <input value={d.name} onChange={(e) => setDoc(i, { name: e.target.value })} aria-label="Document name" maxLength={120} className={input} />
                      <textarea value={d.description} onChange={(e) => setDoc(i, { description: e.target.value })} aria-label="Instructions for the client" rows={2} maxLength={1000} className={cn(input, "h-auto py-1")} />
                    </div>
                  ) : (
                    <div className="flex-1"><strong>{d.name}</strong>{d.description && <p className="text-[#888]">{d.description}</p>}</div>
                  )}
                  <button onClick={() => setEditing(editing === i ? null : i)} disabled={editing === i && !d.name.trim()} className="text-[#428bca] hover:underline disabled:opacity-50">{editing === i ? "Done" : "Edit"}</button>
                  <button onClick={() => { setDocs(docs.filter((_, j) => j !== i)); setEditing(null); }} className="text-[#d9534f] hover:underline">Remove</button>
                </div>
              ))}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <select value="" onChange={(e) => { const c = catalog.find((x) => x.name === e.target.value); if (c) setDocs([...docs, c]); }} aria-label="Add a document" className={cn(input, "w-auto")}>
              <option value="">+ Add a document…</option>
              {left.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <button onClick={() => { setDocs([...docs, { name: "New document", category: "Other", description: "" }]); setEditing(docs.length); }} className="text-[#428bca] hover:underline">Add your own</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-[12.6px]">
          {borrowers.length ? (
            <>
              <p className="mb-2 text-[#666]">Use the <Star className="inline size-3.5 fill-[#f39c12] stroke-[#f39c12]" /> icon to choose the primary borrower. They get the welcome email and portal sign-in now; invite the others from the deal&apos;s Client Portal tab.</p>
              {borrowers.map((b, i) => (
                <div key={i} className="flex flex-wrap items-center gap-3 border border-[#ddd] p-2 [&+&]:border-t-0">
                  <button onClick={() => setPrimary(i)} aria-label="Make primary"><Star className={cn("size-4", i === primary ? "fill-[#f39c12] stroke-[#f39c12]" : "stroke-[#ccc]")} /></button>
                  <strong>{b.firstName} {b.lastName}</strong> <span className="text-[#999]">{b.email}</span>
                  {i === primary && <span className="text-[11px] text-[#f39c12]">Primary</span>}
                  <button onClick={() => { setBorrowers(borrowers.filter((_, j) => j !== i)); setPrimary(0); }} aria-label="Remove borrower" className="ml-auto text-[#d9534f]"><Trash2 className="size-4" /></button>
                </div>
              ))}
            </>
          ) : (
            <p className="mb-3 text-[#666]">Add the client below.</p>
          )}
          {borrowers.length < 4 && (
            <fieldset className="mt-3 rounded-[3px] border border-[#ddd] p-3">
              <legend className="px-1 font-semibold text-[#666]">{borrowers.length ? "Add a co-borrower" : "Add the client"}</legend>
              <Errors list={draftErrors} />
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} placeholder="First Name" aria-label="First Name" className={input} />
                <input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} placeholder="Last Name" aria-label="Last Name" className={input} />
                <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" aria-label="Email" type="email" className={input} />
              </div>
              <button onClick={addBorrower} className={cn(blueBtn, "mt-2 px-3 py-1.5")}>Add Borrower</button>
            </fieldset>
          )}
        </div>
      )}
    </Modal>
  );
}

export function AddModal({ kind, close }: { kind: AddKind; close: () => void }) {
  if (kind === "application") return <ApplicationModal close={close} />;
  if (kind === "clientExperience") return <ClientExperienceModal close={close} />;
  return <ContactModal lead={kind === "lead"} close={close} />;
}
