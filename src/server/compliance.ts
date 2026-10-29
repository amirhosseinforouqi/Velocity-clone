// Per-deal compliance: the status and package lock set by reviewers (organization and office admins), the AML
// assessment of each borrower, and the compliance dashboard. Everything goes through dealScope and is audited.
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { amlQuestions, amlRisk, complianceLabels, screeningLabels, type ComplianceStatus, type Screening } from "../components/platform/aml-fields.ts";
import { isDay } from "../lib/dates.ts";
import { dealScope, Forbidden, type Actor } from "./access.ts";
import { isAdmin as isReviewer, text } from "./admin.ts";
import { audit } from "./audit.ts";
import { ValidationError } from "./contacts.ts";
import type { Db, Tx } from "./db.ts";
import type { DealStatus } from "./deal-status.ts";
import { amlAssessments, complianceReviews, contacts, dealBorrowers, deals, dealStatus, users } from "./schema.ts";

const UUID = /^[0-9a-f-]{36}$/i;

async function visibleDeal(db: Db | Tx, actor: Actor, id: string) {
  const [row] = UUID.test(id) ? await db.select().from(deals).where(and(eq(deals.id, id), dealScope(actor))) : [];
  if (!row) throw new Forbidden("Deal not found");
  return row;
}

const borrowersOf = (db: Db | Tx, dealId: string) =>
  db.select({ contactId: contacts.id, name: sql<string>`trim(concat(${contacts.firstName}, ' ', ${contacts.lastName}))` })
    .from(dealBorrowers).innerJoin(contacts, eq(contacts.id, dealBorrowers.contactId))
    .where(eq(dealBorrowers.dealId, dealId)).orderBy(asc(dealBorrowers.position));

// The deal's compliance panel: status, lock, review history and each current borrower's assessment.
export async function dealCompliance(db: Db, actor: Actor, dealId: string) {
  const deal = await visibleDeal(db, actor, dealId);
  const reviews = await db
    .select({ at: complianceReviews.createdAt, by: users.name, status: complianceReviews.status, note: complianceReviews.note, locked: complianceReviews.locked })
    .from(complianceReviews).innerJoin(users, eq(users.id, complianceReviews.actorId))
    .where(eq(complianceReviews.dealId, dealId)).orderBy(desc(complianceReviews.createdAt));
  const assessed = await db
    .select({ a: amlAssessments, by: users.name }).from(amlAssessments).innerJoin(users, eq(users.id, amlAssessments.assessedBy))
    .where(eq(amlAssessments.dealId, dealId));
  const borrowers = (await borrowersOf(db, dealId)).map((b) => {
    const found = assessed.find((x) => x.a.contactId === b.contactId);
    return { ...b, assessment: found && { ...found.a, by: found.by } };
  });
  return { dealId, status: deal.complianceStatus, lockedAt: deal.packageLockedAt, canReview: isReviewer(actor), reviews, borrowers };
}

export type DealCompliance = Awaited<ReturnType<typeof dealCompliance>>;

// Compliant needs every borrower assessed and screened; a lock needs Compliant; Non-compliant needs a note saying why.
export async function setCompliance(db: Db, actor: Actor, dealId: string, input: { status: unknown; note: unknown; locked: unknown }) {
  if (!isReviewer(actor)) throw new Forbidden("Only an organization or office admin can review compliance");
  const deal = await visibleDeal(db, actor, dealId);
  if (!(typeof input.status === "string" && input.status in complianceLabels)) throw new ValidationError("Choose a compliance status");
  const status = input.status as ComplianceStatus;
  const note = text(input.note, "Note", 1000, status === "non_compliant");
  const locked = input.locked === true;
  if (locked && status !== "compliant") throw new ValidationError("Only a compliant deal's package can be locked");
  if (status === "compliant") {
    const { borrowers } = await dealCompliance(db, actor, dealId);
    const missing = borrowers.filter((b) => !b.assessment || b.assessment.screening === "not_screened");
    if (!borrowers.length) throw new ValidationError("The deal has no borrowers to assess");
    if (missing.length) throw new ValidationError(`Complete the AML assessment and sanction screening for ${missing.map((b) => b.name).join(", ")} first`);
  }
  await db.transaction(async (tx) => {
    const lockedAt = locked ? (deal.packageLockedAt ?? new Date()) : null;
    await tx.update(deals).set({ complianceStatus: status, packageLockedAt: lockedAt }).where(eq(deals.id, dealId));
    await tx.insert(complianceReviews).values({ dealId, actorId: actor.id, status, note, locked });
    await audit(tx, actor, "deal", dealId, "compliance", { status: deal.complianceStatus, locked: !!deal.packageLockedAt }, { status, locked, note });
  });
}

// Anyone who can see the deal fills in the questionnaire; the risk is computed, not chosen.
// Changing an assessment on a compliant deal puts it back to In progress, and a locked package can't be changed at all.
export async function saveAmlAssessment(db: Db, actor: Actor, dealId: string, contactId: string, input: Record<string, unknown>) {
  const deal = await visibleDeal(db, actor, dealId);
  if (deal.packageLockedAt) throw new ValidationError("The package is locked by compliance");
  if (!(await borrowersOf(db, dealId)).some((b) => b.contactId === contactId)) throw new ValidationError("That contact isn't a borrower on this deal");
  const answers: Record<string, string> = {};
  for (const q of amlQuestions) {
    const v = input[q.key];
    if (!q.options.some(([a]) => a === v)) throw new ValidationError(`Answer: ${q.label}`);
    answers[q.key] = v as string;
  }
  if (!(typeof input.screening === "string" && input.screening in screeningLabels)) throw new ValidationError("Choose a sanction screening result");
  const screening = input.screening as Screening;
  const screened = screening !== "not_screened";
  const screeningList = screened ? text(input.screeningList, "Lists checked", 200) : "";
  const screenedOn = screened ? input.screenedOn : null;
  if (screened && !isDay(screenedOn)) throw new ValidationError("Enter the date the screening was done");
  const values = { answers, risk: amlRisk(answers, screening), screening, screeningList, screenedOn: screenedOn as string | null, assessedBy: actor.id, updatedAt: new Date() };
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(amlAssessments).where(and(eq(amlAssessments.dealId, dealId), eq(amlAssessments.contactId, contactId)));
    await tx.insert(amlAssessments).values({ dealId, contactId, ...values })
      .onConflictDoUpdate({ target: [amlAssessments.dealId, amlAssessments.contactId], set: values });
    await audit(tx, actor, "aml_assessment", dealId, before ? "update" : "create", before ?? null, { contactId, ...values });
    if (deal.complianceStatus === "compliant") {
      await tx.update(deals).set({ complianceStatus: "in_progress" }).where(eq(deals.id, dealId));
      await tx.insert(complianceReviews).values({ dealId, actorId: actor.id, status: "in_progress", note: "AML assessment changed after the deal was marked compliant", locked: false });
    }
  });
  return values.risk;
}

// ---- Compliance dashboard

// Reviewers only. Search matches the agent, any borrower's name, or the loan code (KW-number).
// ponytail: capped at 500 rows with no paging; add paging when an office has more open deals than that.
export async function complianceDashboard(db: Db, actor: Actor, filter: { q?: string; dealStatus?: string; compliance?: string }) {
  if (!isReviewer(actor)) throw new Forbidden("Only an organization or office admin can open the compliance dashboard");
  const q = (filter.q ?? "").trim();
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const n = Number(/^(?:KW-?)?(\d+)$/i.exec(q)?.[1]);
  const borrowerMatch = db.select({ id: dealBorrowers.dealId }).from(dealBorrowers).innerJoin(contacts, eq(contacts.id, dealBorrowers.contactId))
    .where(ilike(sql`concat(${contacts.firstName}, ' ', ${contacts.lastName})`, like));
  const search = q ? or(ilike(users.name, like), inArray(deals.id, borrowerMatch), Number.isSafeInteger(n) ? eq(deals.number, n) : undefined) : undefined;
  const status = dealStatus.enumValues.includes(filter.dealStatus as DealStatus) ? eq(deals.status, filter.dealStatus as DealStatus) : undefined;
  const compliance = filter.compliance && filter.compliance in complianceLabels ? eq(deals.complianceStatus, filter.compliance as ComplianceStatus) : undefined;
  return db
    .select({
      id: deals.id, number: deals.number, status: deals.status, compliance: deals.complianceStatus, lockedAt: deals.packageLockedAt,
      amount: deals.amount, closingDate: deals.closingDate, agent: users.name,
      borrower: sql<string | null>`(select trim(concat(c.first_name, ' ', c.last_name)) from ${dealBorrowers} b join ${contacts} c on c.id = b.contact_id where b.deal_id = ${deals.id} order by b.position limit 1)`,
      reviewedAt: sql<string | null>`(select max(r.created_at)::text from ${complianceReviews} r where r.deal_id = ${deals.id})`,
    })
    .from(deals).innerJoin(users, eq(users.id, deals.agentId))
    .where(and(dealScope(actor), search, status, compliance))
    .orderBy(desc(deals.updatedAt)).limit(500);
}
