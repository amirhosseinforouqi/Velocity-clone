// GDS / TDS / LTV from a deal's saved workspace fields. The reference's formulas weren't visible, so these are
// the standard Canadian ones: housing costs over gross monthly income, qualifying at the stress-test rate.
export type Fields = Record<string, string | undefined>;

const mr = "mortgageRequest/Mortgage Breakdown/";
const rp = "mortgageRequest/Rates and Payments/";
const qd = "mortgageRequest/Qualifying Details/";
const sp = "subjectProperty/Details/";
const emp = "borrowers/Employment/";
export const incomeKeys = ["T4", "Business Income", "Dividends", "Commission", "Additional Income Amount"].map((l) => emp + l);
export const keys = {
  mortgages: [`${mr}1st Mortgage Total`, `${mr}2nd Mortgage Total`, `${mr}3rd Mortgage Total`],
  withPremium: `${mr}Total Mortgage Amount with Premium`,
  purchasePrice: [`${sp}Purchase Price`, `${mr}Purchase Price`],
  appraisal: `${sp}Appraisal Value`,
  estimated: `${sp}Estimated Value`,
  rate: [`${rp}Net Rate`, `${rp}Interest Rate`],
  amortization: `${rp}Amortization`,
  amortizationMonths: `${rp}Amortization Months`,
  loanAmount: `${rp}Total Loan Amount`,
  frequency: `${rp}Payment Frequency`,
  compounding: `${rp}Compounded Period`,
  qualifyingRate: `${qd}Qualifying Rate`,
  qualifyingAmortization: `${qd}Qualifying Amortization`,
  qualifyingCompounding: `${qd}Qualifying Compounded Period`,
  qualifyingPayment: `${qd}Qualifying Payment`,
  taxes: `${sp}Annual Taxes`,
  heat: `${sp}Heating Cost`,
  condo: `${sp}Condo Fees`,
  condoFull: `${sp}Calculate Condo Fees @100%`,
  otherPayments: "assetsProperties/Property Totals/Payments",
  otherExpenses: "assetsProperties/Property Totals/Expenses",
  incomePeriod: `${emp}Income Period`,
};

// The firm's qualifying defaults (Admin > Organization): qualify at the greater of contract + buffer and the floor (the OSFI
// minimum qualifying rate), and count a card or line of credit with no payment at a percent of its balance.
// ponytail: one set per firm; add per-lender overrides when a lender's rules differ.
export type Qualification = { stressBuffer: number; rateFloor: number; revolvingPct: number };
export const defaultQualification: Qualification = { stressBuffer: 2, rateFloor: 5.25, revolvingPct: 3 };
const perYear: Record<string, number> = { Annually: 1, "Semi-Annually": 2, Quarterly: 4, Monthly: 12, "Semi-Monthly": 24, "Bi-Weekly": 26, Weekly: 52 };
const compoundsPerYear: Record<string, number> = { Monthly: 12, "Semi-Annually": 2, Annually: 1 };

// "$1,234.50", "4.79%", "25 Years" -> number; blank or junk -> null.
export function num(v: string | undefined) {
  const s = (v ?? "").replace(/[$,%\s]|years?$/gi, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const first = (f: Fields, ks: string[]) => ks.map((k) => num(f[k])).find((n) => n !== null) ?? null;
const sum = (ns: (number | null)[]) => (ns.some((n) => n !== null) ? ns.reduce<number>((a, n) => a + (n ?? 0), 0) : null);

// Fixed-rate Canadian mortgages compound semi-annually (Interest Act), hence the default.
export function monthlyPayment(principal: number, ratePct: number, years: number, compounding = "Semi-Annually") {
  return periodicPayment(principal, ratePct, years * 12, 12, compounding);
}

// One payment when there are `payments` a year over `months` of amortization.
export function periodicPayment(principal: number, ratePct: number, months: number, payments: number, compounding = "Semi-Annually") {
  const n = (months / 12) * payments;
  if (ratePct === 0) return principal / n;
  const k = compoundsPerYear[compounding] ?? 2;
  const i = (1 + ratePct / 100 / k) ** (k / payments) - 1;
  return (principal * i) / (1 - (1 + i) ** -n);
}

// The contract payment at the deal's own rate, amortization and payment frequency; null until amount and amortization are known.
// Accelerated frequencies are the monthly payment halved or quartered, the way Canadian lenders define them.
export function contractPayment(f: Fields) {
  const price = first(f, keys.purchasePrice), down = num(f[`${mr}Down Payment`]);
  // Same last fallback as dealMetrics (price less down payment), so the payment shows on early files too.
  const principal = num(f[keys.loanAmount]) ?? num(f[keys.withPremium]) ?? sum(keys.mortgages.map((k) => num(f[k]))) ?? (price && down !== null && down < price ? price - down : null);
  const months = (num(f[keys.amortization]) ?? 0) * 12 + (num(f[keys.amortizationMonths]) ?? 0);
  if (!principal || !months) return null;
  const rate = first(f, keys.rate) ?? 0;
  const freq = f[keys.frequency] || "Monthly";
  const comp = f[keys.compounding] || undefined;
  if (freq === "Accelerated Bi-Weekly") return periodicPayment(principal, rate, months, 12, comp) / 2;
  if (freq === "Accelerated Weekly") return periodicPayment(principal, rate, months, 12, comp) / 4;
  return perYear[freq] ? periodicPayment(principal, rate, months, perYear[freq], comp) : null;
}

// Monthly payments on the listed liabilities. Debts paid off at closing don't count. A card or line of credit with no
// payment entered counts at the firm's percent of its balance.
export function liabilityPayments(f: Fields, revolvingPct = defaultQualification.revolvingPct) {
  let total = 0;
  for (let n = 1; n <= 10; n++) {
    const k = `assetsProperties/Liability ${n}/`;
    if (f[k + "Paid Off at Closing"] === "Yes") continue;
    const revolving = ["Credit Card", "Line of Credit"].includes(f[k + "Liability Type"] ?? "");
    total += num(f[k + "Monthly Payment"]) ?? (revolving ? (num(f[k + "Balance"]) ?? 0) * (revolvingPct / 100) : 0);
  }
  return total;
}

// Totals of what's listed on the file: assets plus other-property value; liability balances plus other-property mortgages.
export function fileTotals(f: Fields) {
  const ap = "assetsProperties/";
  const assets = sum([...Array.from({ length: 8 }, (_, i) => num(f[`${ap}Asset ${i + 1}/Value`])), num(f[`${ap}Property Totals/Property Value`])]);
  const liabilities = sum([...Array.from({ length: 10 }, (_, i) => num(f[`${ap}Liability ${i + 1}/Balance`])), num(f[`${ap}Property Totals/Mortgages`])]);
  return { assets, liabilities, netWorth: assets === null && liabilities === null ? null : (assets ?? 0) - (liabilities ?? 0) };
}

// Read-only fields (the "calc" type), by label: value and where it comes from.
export const calcFields: Record<string, { from: string; value: (f: Fields) => number | null }> = {
  "Calculated Payment": { from: "From amount, rate, amortization and payment frequency", value: contractPayment },
  "Total Assets": { from: "Listed assets plus other-property value", value: (f) => fileTotals(f).assets },
  "Total Liabilities": { from: "Listed liability balances plus other-property mortgages", value: (f) => fileTotals(f).liabilities },
  "Net Worth": { from: "Total assets less total liabilities", value: (f) => fileTotals(f).netWorth },
};

export function dealMetrics(f: Fields, q: Qualification = defaultQualification) {
  const price = first(f, keys.purchasePrice);
  const down = num(f[`${mr}Down Payment`]);
  // Falls back to the loan amount, then to price less down payment, so ratios appear as soon as the basics are in.
  const mortgage = sum(keys.mortgages.map((k) => num(f[k]))) ?? num(f[keys.withPremium]) ?? num(f[keys.loanAmount]) ?? (price && down !== null && down < price ? price - down : null);
  const appraisal = num(f[keys.appraisal]);
  // Lenders lend on the lower of price and appraisal; the estimate only stands in when neither exists.
  const known = [price, appraisal].filter((n): n is number => !!n && n > 0);
  const value = known.length ? Math.min(...known) : num(f[keys.estimated]);

  const contract = first(f, keys.rate);
  const qualifyingRate = num(f[keys.qualifyingRate]) ?? (contract === null ? null : Math.max(contract + q.stressBuffer, q.rateFloor));
  const years = num(f[keys.qualifyingAmortization]) ?? num(f[keys.amortization]);
  const principal = num(f[keys.withPremium]) ?? mortgage; // insured loans qualify on the amount including the premium
  const payment = num(f[keys.qualifyingPayment]) ??
    (principal && qualifyingRate !== null && years ? monthlyPayment(principal, qualifyingRate, years, f[keys.qualifyingCompounding] || f[keys.compounding] || undefined) : null);

  const income = sum(incomeKeys.map((k) => num(f[k])));
  // Every current job and other income counts, co-applicants' included. A lender may count less (e.g. part of rental
  // income); these are working defaults, not any one lender's rules.
  const monthlyIncome = sum([
    income === null ? null : (income * (perYear[f[keys.incomePeriod] ?? ""] ?? 1)) / 12,
    ...[2, 3, 4].map((n) => (f[`borrowers/Employment ${n}/Employment Status`] === "Previous" ? null : num(f[`borrowers/Employment ${n}/Annual Income`]))).map((a) => (a === null ? null : a / 12)),
    ...[1, 2, 3, 4].map((n) => { const a = num(f[`borrowers/Other Income ${n}/Amount`]); return a === null ? null : (a * (perYear[f[`borrowers/Other Income ${n}/Income Period`] ?? ""] ?? 1)) / 12; }),
  ]);
  const taxes = (num(f[keys.taxes]) ?? 0) / 12;
  const heat = num(f[keys.heat]) ?? 0;
  const condo = (num(f[keys.condo]) ?? 0) * (f[keys.condoFull] === "Yes" ? 1 : 0.5);
  const other = (num(f[keys.otherPayments]) ?? 0) + (num(f[keys.otherExpenses]) ?? 0) + liabilityPayments(f, q.revolvingPct);

  const housing = payment === null ? null : payment + taxes + heat + condo;
  const ratio = (top: number | null, bottom: number | null) => (top === null || !bottom ? null : (top / bottom) * 100);
  return {
    gds: ratio(housing, monthlyIncome),
    tds: ratio(housing === null ? null : housing + other, monthlyIncome),
    ltv: ratio(mortgage, value),
    parts: { payment, taxes, heat, condo, other, monthlyIncome, mortgage, value, qualifyingRate },
  };
}

export type Metrics = ReturnType<typeof dealMetrics>;
