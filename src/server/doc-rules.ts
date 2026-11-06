// Document rules for a new client, synced from mortgageclientplatform (server/seed.js DOCUMENT_TYPES / DOCUMENT_RULES):
// the service + employment status pick the default checklist; staff adjust it per client in the Client Experience wizard.
// No database or server imports, so the wizard computes the same list in the browser.
// ponytail: rules live in code; move them to a table with an admin editor when a firm needs its own.
import type { ChecklistItem } from "./schema.ts";

export const services = ["Purchase", "Refinance", "Business Loan"] as const;
export const employments = ["Employee", "Self-Employed"] as const;
export type Service = (typeof services)[number];
export type Employment = (typeof employments)[number];

// Tax documents are for the last two completed years; the property tax bill is this year's.
const y = new Date().getFullYear();
const years = `${y - 2} & ${y - 1}`;
const doc = (name: string, category: string, description: string): ChecklistItem => ({ name, category, description });

// The order here is the order the client sees.
export const documentCatalog = {
  equifax: doc("Equifax Credit Report", "Credit", "Full report downloaded from Equifax Canada."),
  id: doc("Two Pieces of Government ID", "Identity", "Passport, driver's licence, or PR card. Health cards are not accepted."),
  jobLetter: doc("Recent Job Letter", "Income / Tax", "Signed and dated, stating your position, salary or hourly rate, and start date."),
  payStubs: doc("Three Recent Pay Stubs", "Income / Tax", "Your three most recent pay stubs."),
  t4: doc(`T4 Slips (${years})`, "Income / Tax", `Your T4 slips for both ${y - 2} and ${y - 1}.`),
  t1: doc(`T1 General (${years})`, "Income / Tax", `Your complete T1 General return for both ${y - 2} and ${y - 1}.`),
  noa: doc(`Notice of Assessment (${years})`, "Income / Tax", `Your CRA Notice of Assessment for both ${y - 2} and ${y - 1}.`),
  bank: doc("Bank Statements — Last 3 Months", "Banking & Assets", "Your last three months of bank statements."),
  assets: doc("Breakdown of Assets", "Banking & Assets", "Vehicles: year, make, model and estimated market value. Investments: balance details for TFSA, RRSP, savings and other liquid accounts."),
  businessBank: doc("Business Bank Statements — Last 12 Months", "Banking & Assets", "Your last twelve months of business bank statements."),
  personalBank: doc("Personal Bank Statements — Last 6 Months", "Banking & Assets", "Your last six months of personal bank statements."),
  t2: doc(`T2 Corporate Income Tax Returns (${years})`, "Corporate", `Your corporation's T2 returns for both ${y - 2} and ${y - 1}.`),
  corporateNoa: doc(`Corporate Notice of Assessment (${years})`, "Corporate", `The CRA Notice of Assessment issued to your corporation for both ${y - 2} and ${y - 1}.`),
  incorporation: doc("Certificate of Incorporation", "Corporate", "The certificate of incorporation for your business."),
  articles: doc("Articles of Incorporation", "Corporate", "Articles of incorporation for your business."),
  financials: doc("Business Financial Statements", "Corporate", "Business financial statements for the last 2 years."),
  mortgageStatement: doc("Current Mortgage Statement", "Property", "Your most recent statement for the mortgage being refinanced."),
  propertyTax: doc(`Final Property Tax Bill ${y}`, "Property", `The final (not interim) property tax bill for ${y}.`),
  // In the catalog for adding by hand; no rule pulls them in.
  purchaseAgreement: doc("Purchase Agreement", "Property", "The fully signed Agreement of Purchase and Sale."),
  mls: doc("MLS Listing", "Property", "The MLS listing for the property."),
  homeInsurance: doc("Home Insurance", "Property", "Proof of home insurance."),
  downPayment: doc("Down Payment Verification", "Banking & Assets", "90-day history of the account(s) holding your down payment."),
  gift: doc("Gift Letter", "Banking & Assets", "A signed gift letter if part of your down payment is a gift."),
  voidCheque: doc("Void Cheque / PAD Form", "Banking & Assets", "A void cheque or pre-authorized debit form."),
} satisfies Record<string, ChecklistItem>;

type Key = keyof typeof documentCatalog;
const rules: { service?: Service; employment?: Employment; docs: Key[] }[] = [
  { docs: ["equifax", "id"] },
  { employment: "Employee", docs: ["jobLetter", "payStubs", "t4", "t1", "noa", "bank"] },
  { employment: "Self-Employed", docs: ["assets", "businessBank", "personalBank", "t1", "noa", "t2", "corporateNoa", "incorporation"] },
  { service: "Refinance", docs: ["mortgageStatement", "propertyTax"] },
  { service: "Business Loan", docs: ["articles", "financials"] },
];

export const defaultDocuments = (service: Service, employment: Employment): ChecklistItem[] =>
  [...new Set(rules.filter((r) => (r.service ?? service) === service && (r.employment ?? employment) === employment).flatMap((r) => r.docs))]
    .map((k) => documentCatalog[k]);
