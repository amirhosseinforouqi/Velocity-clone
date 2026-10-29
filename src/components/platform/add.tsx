"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Star, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createContactAction, findDuplicatesAction } from "@/app/contacts/actions";
import { createContactDealAction, myLenderChoicesAction } from "@/app/deal/actions";
import type { LenderChoice } from "@/server/lenders";
import { placeholderAgents, type Contact } from "./placeholder-data";
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
    <select className={input} defaultValue={placeholderAgents[0]}>
      {placeholderAgents.map((a) => <option key={a}>{a}</option>)}
    </select>
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

type Borrower = { first: string; last: string; email: string; french: boolean };
const templates = ["[Shared] Blank Template", "[Shared] Purchasing a New Property", "[Shared] Refinancing an Existing Property", "[Shared] Renewing an Existing Mortgage"];
const groups = ["Purchase Documents Group", "Rental Documents Group", "Existing Property Group"];
const conditions = ["Letter of Employment", "Recent Pay Stub", "Notice of Assessment", "Purchase Agreement", "Down Payment Verification", "Void Cheque"];

function ClientExperienceModal({ close }: { close: () => void }) {
  const [step, setStep] = useState(0);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [primary, setPrimary] = useState(0);
  const [draft, setDraft] = useState<Borrower>({ first: "", last: "", email: "", french: false });
  const [draftErrors, setDraftErrors] = useState<string[]>([]);
  const [template, setTemplate] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  const addBorrower = () => {
    const e = [!draft.first.trim() && "First Name required", !draft.last.trim() && "Last Name required", !draft.email.trim() && "Email required"].filter((x): x is string => !!x);
    setDraftErrors(e);
    if (e.length) return;
    setBorrowers([...borrowers, draft]);
    setDraft({ first: "", last: "", email: "", french: false });
  };
  const next = () => {
    const e =
      step === 0 ? [!borrowers.length && "A contact is required."]
      : step === 1 ? [!subject.trim() && "A subject is required for the email.", !body.trim() && "Some content in the body of the email is required."]
      : [];
    const list = e.filter((x): x is string => !!x);
    setErrors(list);
    if (!list.length) setStep(step + 1);
  };
  const steps = ["Borrowers", "Email", "Conditions & Documents"];

  if (sent) {
    return (
      <Modal title="CREATE A CLIENT EXPERIENCE" close={close} footer={<button onClick={close} className={cn(blueBtn, "px-3 py-1.5 text-[12.6px]")}>Close</button>}>
        <p className="flex items-center gap-2 text-[#3c763d]"><Check className="size-5" /> Client Experience sent to {borrowers[primary].first} {borrowers[primary].last} (demo only, nothing was emailed).</p>
      </Modal>
    );
  }

  return (
    <Modal
      wide
      title="CREATE A CLIENT EXPERIENCE"
      close={close}
      footer={<>
        {step > 0 && <button onClick={() => { setErrors([]); setStep(step - 1); }} className={cn(greyBtn, "mr-auto px-3 py-1.5 text-[12.6px]")}>Previous</button>}
        {step < 2 ? (
          <button onClick={next} className={cn(blueBtn, "px-3 py-1.5 text-[12.6px]")}><strong>Next:</strong> {steps[step + 1]}</button>
        ) : (
          <button onClick={() => (template ? setSent(true) : setErrors(["Please select a template to proceed with conditions + documents."]))} className={cn(greenBtn, "px-3 py-1.5 text-[12.6px]")}>Send</button>
        )}
        <button onClick={close} className={cn(greyBtn, "px-3 py-1.5 text-[12.6px]")}>Cancel</button>
      </>}
    >
      <p className="mb-3 text-[#666]">Send out an Application and receive Documents from your prospective Clients</p>
      <ol className="mb-4 flex flex-wrap gap-2 text-[12.6px]">
        {steps.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2 rounded-[3px] px-3 py-1.5", i === step ? "bg-[#428bca] text-white" : i < step ? "bg-[#dff0d8] text-[#3c763d]" : "bg-[#f1f1f1] text-[#999]")}>
            <span className="grid size-5 place-items-center rounded-full bg-white/30 font-semibold">{i + 1}</span> {s}
          </li>
        ))}
      </ol>
      <Errors list={errors} />

      {step === 0 && (
        <div className="text-[12.6px]">
          {borrowers.length ? (
            <>
              <p className="mb-2 text-[#666]">Use the <Star className="inline size-3.5 fill-[#f39c12] stroke-[#f39c12]" /> icon to select your Primary borrower. Only the Primary Borrower will receive the Client Experience email.</p>
              {(["PRIMARY BORROWER", "ADDITIONAL BORROWERS"] as const).map((heading, h) => {
                const list = borrowers.map((b, i) => ({ b, i })).filter(({ i }) => (i === primary) === (h === 0));
                return list.length ? (
                  <div key={heading} className="mb-3">
                    <h6 className="mb-1 font-semibold text-[#428bca]">{heading}</h6>
                    {list.map(({ b, i }) => (
                      <div key={i} className="flex flex-wrap items-center gap-3 border border-[#ddd] p-2">
                        <button onClick={() => setPrimary(i)} aria-label="Make primary"><Star className={cn("size-4", i === primary ? "fill-[#f39c12] stroke-[#f39c12]" : "stroke-[#ccc]")} /></button>
                        <strong>{b.first} {b.last}</strong> <span className="text-[#999]">{b.email}</span>
                        <span className="ml-auto flex gap-2">
                          {(["En", "Fr"] as const).map((l) => (
                            <label key={l} className="flex items-center gap-1">
                              <input type="radio" checked={b.french === (l === "Fr")} onChange={() => setBorrowers(borrowers.map((x, j) => (j === i ? { ...x, french: l === "Fr" } : x)))} /> {l}
                            </label>
                          ))}
                          <button onClick={() => { setBorrowers(borrowers.filter((_, j) => j !== i)); setPrimary(0); }} aria-label="Remove borrower" className="text-[#d9534f]"><Trash2 className="size-4" /></button>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null;
              })}
            </>
          ) : (
            <p className="mb-3 text-[#666]">You don&apos;t have any borrowers selected, please <strong className="text-[#d9534f]">&apos;Add a Borrower&apos;</strong> below.</p>
          )}
          <fieldset className="rounded-[3px] border border-[#ddd] p-3">
            <legend className="px-1 font-semibold text-[#666]">Add a Borrower</legend>
            <Errors list={draftErrors} />
            <div className="grid gap-2 sm:grid-cols-3">
              <input value={draft.first} onChange={(e) => setDraft({ ...draft, first: e.target.value })} placeholder="First Name" className={input} />
              <input value={draft.last} onChange={(e) => setDraft({ ...draft, last: e.target.value })} placeholder="Last Name" className={input} />
              <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" type="email" className={input} />
            </div>
            <button onClick={addBorrower} className={cn(blueBtn, "mt-2 px-3 py-1.5")}>Add Borrower</button>
          </fieldset>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-3 text-[12.6px]">
          <Field text="Experience Template">
            <select value={template} onChange={(e) => { setTemplate(e.target.value); if (e.target.value && !subject) setSubject(e.target.value.replace("[Shared] ", "")); }} className={input}>
              <option value="">- Please Select a Template -</option>
              {templates.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field text="EMAIL SUBJECT LINE"><input value={subject} onChange={(e) => setSubject(e.target.value)} className={input} /></Field>
          <Field text="EMAIL BODY CONTENT"><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className={cn(input, "h-auto py-1")} /></Field>
          <Field text="EMAIL SIGNATURE"><textarea rows={3} defaultValue={`${placeholderAgents[0]}\nMortgage Agent`} className={cn(input, "h-auto py-1")} /></Field>
          <div>
            <span className={label}>ATTACHMENTS</span>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); setFiles([...files, ...Array.from(e.dataTransfer.files, (f) => f.name)]); }}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-[3px] border-2 border-dashed border-[#ccc] p-5 text-[#999]"
            >
              <Upload className="size-6" /> Drag &amp; Drop Files to Upload <span>Or</span>
              <span className={cn(blueBtn, "px-3 py-1")}>Browse Files</span>
              <input type="file" multiple className="sr-only" onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [], (f) => f.name)])} />
            </label>
            {files.map((f, i) => (
              <p key={i} className="mt-1 flex items-center gap-2">{f}<button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove file"><X className="size-3.5 text-[#d9534f]" /></button></p>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3 text-[12.6px]">
          <p className="text-[#666]">Choose Conditions &amp; Documents to use with this Experience Template.</p>
          <label className="flex items-center gap-2 font-semibold text-[#666]"><input type="checkbox" defaultChecked /> Use Smart Rules</label>
          <div>
            <span className={label}>Condition Groups:</span>
            <p className="mb-1 text-[#999]">Use Condition Groups to quickly assign Conditions to your Client Experiences. (If your Smart Rules assign the same Conditions they will not be duplicated.)</p>
            {groups.map((g) => <label key={g} className="mr-4 inline-flex items-center gap-1.5"><input type="checkbox" /> {g}</label>)}
          </div>
          <div>
            <span className={label}>Individual Conditions:</span>
            <div className="grid gap-1 sm:grid-cols-2">{conditions.map((c) => <label key={c} className="flex items-center gap-1.5"><input type="checkbox" /> {c}</label>)}</div>
          </div>
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
