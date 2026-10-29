// Save + Validate rules. The reference's rule list wasn't visible, so these are our own: what a lender
// submission needs, field formats, and the insured-mortgage ratio limits. Advisory only; nothing is blocked yet.
import { sections } from "../components/platform/deal-sections.ts";
import type { DealStatus } from "./deal-status.ts";
import type { LenderChoice } from "./lenders.ts";
import { dealMetrics, incomeKeys, keys, num, type Fields } from "./metrics.ts";

export type Problem = { key: string; message: string };

// Default ratio limits for insured mortgages (CMHC-style). A lender's own limits replace them.
export const LIMITS = { gds: 39, tds: 44, ltv: 95, uninsuredLtv: 80 };
export const LENDER = "closeOut//Lender";
export const PRODUCT = "closeOut//Product";

export const lenderFor = (fields: Fields, lenders: LenderChoice[]) => lenders.find((l) => l.name === fields[LENDER]);
// A lender's max LTV caps the insured and uninsured thresholds too.
export function limitsFor(lender?: LenderChoice) {
  const l = { ...LIMITS, ...lender?.limits };
  return { ...l, uninsuredLtv: Math.min(l.uninsuredLtv, l.ltv) };
}

const label = (key: string) => key.split("/").pop()!;
const sectionTitle = (key: string) => sections.find((s) => s.id === key.split("/")[0])?.title ?? "";
const sp = "subjectProperty/Address/";
const required = [
  "mortgageRequest/Mortgage Breakdown/Application Purpose",
  ...["Street #", "Street Name", "City", "Province", "Postal Code"].map((l) => sp + l),
  keys.mortgages[0],
  keys.amortization,
];
const numeric = [...keys.mortgages, keys.withPremium, ...keys.purchasePrice, keys.appraisal, keys.estimated, keys.taxes, keys.heat, keys.condo, keys.otherPayments, keys.otherExpenses, keys.qualifyingPayment, ...incomeKeys, "mortgageRequest/Mortgage Breakdown/Down Payment"];
const rates = [...keys.rate, keys.qualifyingRate];
const pastDates = ["borrowers/Applicant/DOB", "borrowers/Residency/Arrival Date"];

// SIN: nine digits passing the Luhn check.
export function validSin(v: string) {
  const d = v.replace(/[\s-]/g, "");
  if (!/^\d{9}$/.test(d)) return false;
  const total = [...d].reduce((s, c, i) => { const n = Number(c) * (i % 2 ? 2 : 1); return s + (n > 9 ? n - 9 : n); }, 0);
  return total % 10 === 0;
}

// `lenders` are the deal agent's choices; leave it out to skip the lender checks.
export function validateDeal(deal: { status: DealStatus; closingDate: string | null; fields: Fields }, lenders?: LenderChoice[], today = new Date().toISOString().slice(0, 10)) {
  const f = deal.fields;
  const out: Problem[] = [];
  const add = (key: string, message: string) => out.push({ key, message: `${sectionTitle(key)} › ${label(key)}: ${message}` });
  const blank = (k: string) => !(f[k] ?? "").trim();

  // Leads are still being qualified; only the format checks apply to them.
  if (deal.status !== "lead") {
    for (const k of required) if (blank(k)) add(k, "required");
    if (keys.rate.every(blank)) add(keys.rate[0], "a net or interest rate is required");
    if ([...keys.purchasePrice, keys.appraisal, keys.estimated].every(blank)) add(keys.purchasePrice[0], "a purchase price, appraisal or estimated value is required");
    if (incomeKeys.every(blank)) add(incomeKeys[0], "at least one income amount is required");
    if (!deal.closingDate) out.push({ key: "closingDate", message: "Closing date: required" });
    if (/purchase/i.test(f["mortgageRequest/Mortgage Breakdown/Application Purpose"] ?? "") && blank("mortgageRequest/Mortgage Breakdown/Down Payment"))
      add("mortgageRequest/Mortgage Breakdown/Down Payment", "required for a purchase");
  }

  for (const k of numeric) if (!blank(k) && (num(f[k]) === null || num(f[k])! < 0)) add(k, "must be a positive number");
  for (const k of rates) if (!blank(k)) { const n = num(f[k]); if (n === null || n < 0 || n > 25) add(k, "must be a rate between 0% and 25%"); }
  const postal = f[sp + "Postal Code"];
  if (postal && !/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(postal.trim())) add(sp + "Postal Code", "not a valid Canadian postal code");
  if (f["borrowers/Applicant/SIN"] && !validSin(f["borrowers/Applicant/SIN"])) add("borrowers/Applicant/SIN", "not a valid SIN");
  for (const k of pastDates) if (!blank(k) && f[k]! > today) add(k, "can't be in the future");
  const built = f["subjectProperty/Details/Year Built"];
  if (built && !(Number(built) >= 1800 && Number(built) <= Number(today.slice(0, 4)) + 2)) add("subjectProperty/Details/Year Built", "not a valid year");

  const lender = lenders && lenderFor(f, lenders);
  if (lenders && !blank(LENDER) && !lender) add(LENDER, "not an active lender this deal's agent can submit to");
  if (lender && !blank(PRODUCT) && !lender.products.includes(f[PRODUCT]!)) add(PRODUCT, `not a product of ${lender.name}`);
  const LIMITS = limitsFor(lender);
  const m = dealMetrics(f);
  const insurer = "mortgageRequest/Mortgage Breakdown/Insurer";
  if (m.ltv !== null && m.ltv > LIMITS.ltv) add(keys.mortgages[0], `LTV is ${m.ltv.toFixed(2)}%, over the ${LIMITS.ltv}% maximum`);
  else if (m.ltv !== null && m.ltv > LIMITS.uninsuredLtv && blank(insurer)) add(insurer, `LTV is over ${LIMITS.uninsuredLtv}%, so mortgage insurance is required`);
  if (m.gds !== null && m.gds > LIMITS.gds) add(keys.qualifyingRate, `GDS is ${m.gds.toFixed(2)}%, over the ${LIMITS.gds}% limit`);
  if (m.tds !== null && m.tds > LIMITS.tds) add(keys.qualifyingRate, `TDS is ${m.tds.toFixed(2)}%, over the ${LIMITS.tds}% limit`);
  return out;
}
