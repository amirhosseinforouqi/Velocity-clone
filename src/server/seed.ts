// Synthetic development data only. No real people, clients or deals.
import { fieldKey, sections } from "../components/platform/deal-sections.ts";
import { placeholderContacts, placeholderDeal, placeholderDeals, placeholderParked } from "../components/platform/placeholder-data.ts";
import type { Db } from "./db.ts";
import { boardStatuses, type DealStatus } from "./deal-status.ts";
import { hashPassword } from "./password.ts";
import { conditionTemplates, contacts, dealBorrowers, deals, dealStatusHistory, lenderProducts, lenders, offices, organizations, users } from "./schema.ts";

// Development-only sign-in password shared by every seeded user. Never used outside a local database.
export const DEV_PASSWORD = "urX_EwrIbKbR24TJ";

export const seedUsers = [
  { email: "admin@keyway.test", name: "Jordan Admin", role: "org_admin", office: 0 },
  { email: "office.admin@keyway.test", name: "Sam Office", role: "office_admin", office: 0 },
  { email: "agent@keyway.test", name: "Alex Morgan", role: "agent", office: 0 },
  { email: "agent2@keyway.test", name: "Taylor Brooks", role: "agent", office: 0 },
  { email: "assistant@keyway.test", name: "Casey Assist", role: "assistant", office: 0 },
  { email: "ottawa.agent@keyway.test", name: "Riley Chen", role: "agent", office: 1 },
] as const;

export async function seedIfEmpty(db: Db) {
  if (!(await db.select({ id: organizations.id }).from(organizations).limit(1)).length) await seedPeople(db);
  if (!(await db.select({ id: conditionTemplates.id }).from(conditionTemplates).limit(1)).length) await seedTemplates(db);
  if (!(await db.select({ id: deals.id }).from(deals).limit(1)).length) await seedDeals(db);
  if (!(await db.select({ id: lenders.id }).from(lenders).limit(1)).length) await seedLenders(db);
}

// Made-up lenders; real ones are entered by an organization admin.
const starterLenders = [
  { name: "Sample Bank", type: "Bank", displayAs: "Prime Lenders", limits: {}, products: [["5 Year Fixed", 5], ["5 Year Variable", 5], ["3 Year Fixed", 3]] },
  { name: "Example Trust", type: "Trust", displayAs: "Alternative Lenders", limits: { gds: 45, tds: 50, ltv: 80 }, products: [["1 Year Fixed", 1], ["2 Year Fixed", 2]] },
  { name: "Demo Credit Union", type: "Credit Union", displayAs: "Prime Lenders", limits: { gds: 35, tds: 42 }, products: [["5 Year Fixed", 5], ["HELOC", 0]] },
  { name: "Test Capital", type: "Private", displayAs: "Private Lenders", limits: { ltv: 75 }, products: [["1 Year Interest Only", 1]], hidden: true },
] as const;

async function seedLenders(db: Db) {
  for (const org of await db.select({ id: organizations.id }).from(organizations))
    for (const { products, hidden, ...l } of starterLenders.map((x) => ({ hidden: false, ...x }))) {
      const [row] = await db.insert(lenders).values({ ...l, organizationId: org.id, underwriters: ["Underwriting Desk"], defaultUnderwriter: "Underwriting Desk", hiddenAt: hidden ? new Date() : null }).returning();
      await db.insert(lenderProducts).values(products.map(([name, term]) => ({ lenderId: row.id, name, term })));
    }
}

// A starter condition library in our own wording. A rule lists the accepted values per workspace field; all must match.
const EMPLOYMENT = "borrowers/Employment/Employment Type";
const PURPOSE = "mortgageRequest/Mortgage Breakdown/Application Purpose";
const starterTemplates: { name: string; rule: Record<string, string[]> }[] = [
  { name: "Government photo ID for each applicant", rule: {} },
  { name: "Void cheque or pre-authorized debit form", rule: {} },
  { name: "Letter of employment", rule: { [EMPLOYMENT]: ["Salaried", "Hourly", "Commissioned"] } },
  { name: "Two most recent pay stubs", rule: { [EMPLOYMENT]: ["Salaried", "Hourly", "Commissioned"] } },
  { name: "T1 Generals and Notices of Assessment, last 2 years", rule: { [EMPLOYMENT]: ["Self-Employed"] } },
  { name: "Business financial statements, last 2 years", rule: { [EMPLOYMENT]: ["Self-Employed"] } },
  { name: "Agreement of purchase and sale", rule: { [PURPOSE]: ["Purchase"] } },
  { name: "90-day down payment history", rule: { [PURPOSE]: ["Purchase"] } },
  { name: "Current mortgage statement", rule: { [PURPOSE]: ["Refinance", "Equity Take Out", "Switch/Transfer", "Renewal"] } },
  { name: "Most recent property tax bill", rule: { [PURPOSE]: ["Refinance", "Equity Take Out", "Switch/Transfer", "Renewal"] } },
  { name: "Condo status certificate", rule: { "subjectProperty/Details/Tenure": ["Condo"] } },
  { name: "Home insurance binder", rule: { [PURPOSE]: ["Purchase", "Refinance"] } },
];

async function seedTemplates(db: Db) {
  for (const org of await db.select({ id: organizations.id }).from(organizations))
    await db.insert(conditionTemplates).values(starterTemplates.map((t) => ({ ...t, organizationId: org.id })));
}

async function seedPeople(db: Db) {
  const hash = await hashPassword(DEV_PASSWORD);
  await db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values({ name: "Sample Mortgage Group" }).returning();
    const offs = await tx.insert(offices).values([{ organizationId: org.id, name: "Toronto Office" }, { organizationId: org.id, name: "Ottawa Office" }]).returning();
    const us = await tx.insert(users).values(seedUsers.map((u) => ({
      organizationId: org.id, officeId: offs[u.office].id, email: u.email, name: u.name, role: u.role, passwordHash: hash,
    }))).returning();
    // Spread the placeholder contacts across the three agents so scoping is visible in the UI.
    const owners = us.filter((u) => u.role === "agent");
    await tx.insert(contacts).values(placeholderContacts.map((c, i) => {
      const owner = owners[i % owners.length];
      return {
        organizationId: org.id, officeId: owner.officeId, ownerId: owner.id, firstName: c.firstName, lastName: c.lastName,
        email: c.email, homePhone: c.homePhone, cellPhone: c.cellPhone, workPhone: c.workPhone, address: c.address, casl: c.casl,
      };
    }));
  });
}

// The made-up workspace values, keyed the way the workspace stores them. Borrower details come from the contact instead.
const sampleFields = Object.fromEntries(sections.filter((s) => s.id !== "borrowers").flatMap((s) => s.groups.filter((g) => !g.blank).flatMap((g) =>
  (g.fields ?? []).flatMap((f) => {
    const v = placeholderDeal.values[f.split("|")[0]];
    const key = fieldKey(s, g, f);
    return v && key !== "closeOut//Closing Date" ? [[key, v]] : []; // the closing date lives in its column
  }))));

// Each dashboard stage's placeholder deals, plus the parked ones, attached round-robin to the seeded contacts.
async function seedDeals(db: Db) {
  const people = await db.select().from(contacts);
  const byLabel = Object.fromEntries(boardStatuses.map(([s, l]) => [l, s]));
  const rows: { status: DealStatus; previous?: DealStatus; amount?: number; purpose?: string; closingDate?: string; conditionsDate?: string; followUpDate?: string; submittedDate?: string }[] = [
    ...Object.entries(placeholderDeals).flatMap(([label, list]) => list.map((d) => ({
      status: byLabel[label], previous: byLabel[label] === "cancelled" ? "new_deal" as const : undefined, amount: d.amount || undefined, purpose: d.purpose,
      closingDate: d.closingDate, conditionsDate: d.conditionsDate, followUpDate: d.followUp, submittedDate: d.submittedDate,
    }))),
    ...placeholderParked.map((p) => ({ status: "parked" as const, previous: "submitted" as const, closingDate: p.closingDate, conditionsDate: p.conditionsDate })),
  ];
  await db.transaction(async (tx) => {
    for (const [i, d] of rows.entries()) {
      const c = people[i % people.length];
      const amount = String(d.amount ?? "");
      const fields: Record<string, string> = d.status === "lead" ? {} : {
        ...sampleFields,
        "mortgageRequest/Mortgage Breakdown/Application Purpose": d.purpose ?? "",
        "mortgageRequest/Mortgage Breakdown/1st Mortgage Total": amount,
        "mortgageRequest/Mortgage Breakdown/Total Mortgage Amount with Premium": amount,
        "closeOut//Mortgage Amount": amount,
      };
      const [deal] = await tx.insert(deals).values({
        organizationId: c.organizationId, officeId: c.officeId, agentId: c.ownerId, status: d.status, previousStatus: d.previous,
        amount: d.amount, purpose: d.purpose, closingDate: d.closingDate, conditionsDate: d.conditionsDate, followUpDate: d.followUpDate, submittedDate: d.submittedDate,
        fields: Object.fromEntries(Object.entries(fields).filter(([, v]) => v)),
      }).returning();
      await tx.insert(dealBorrowers).values({ dealId: deal.id, contactId: c.id, position: 0 });
      await tx.insert(dealStatusHistory).values({ dealId: deal.id, from: null, to: d.status, actorId: c.ownerId });
    }
  });
}
