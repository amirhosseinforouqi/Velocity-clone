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

// OSFI minimum qualifying rate: the greater of contract + 2% and this floor. ponytail: hard-coded; move to admin settings when it changes.
export const MQR_FLOOR = 5.25;
const perYear: Record<string, number> = { Annually: 1, Monthly: 12, "Semi-Monthly": 24, "Bi-Weekly": 26, Weekly: 52 };
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
  const n = years * 12;
  if (ratePct === 0) return principal / n;
  const k = compoundsPerYear[compounding] ?? 2;
  const i = (1 + ratePct / 100 / k) ** (k / 12) - 1;
  return (principal * i) / (1 - (1 + i) ** -n);
}

export function dealMetrics(f: Fields) {
  const mortgage = sum(keys.mortgages.map((k) => num(f[k]))) ?? num(f[keys.withPremium]);
  const price = first(f, keys.purchasePrice);
  const appraisal = num(f[keys.appraisal]);
  // Lenders lend on the lower of price and appraisal; the estimate only stands in when neither exists.
  const known = [price, appraisal].filter((n): n is number => !!n && n > 0);
  const value = known.length ? Math.min(...known) : num(f[keys.estimated]);

  const contract = first(f, keys.rate);
  const qualifyingRate = num(f[keys.qualifyingRate]) ?? (contract === null ? null : Math.max(contract + 2, MQR_FLOOR));
  const years = num(f[keys.qualifyingAmortization]) ?? num(f[keys.amortization]);
  const principal = num(f[keys.withPremium]) ?? mortgage; // insured loans qualify on the amount including the premium
  const payment = num(f[keys.qualifyingPayment]) ??
    (principal && qualifyingRate !== null && years ? monthlyPayment(principal, qualifyingRate, years, f[keys.qualifyingCompounding] || f[keys.compounding] || undefined) : null);

  const income = sum(incomeKeys.map((k) => num(f[k])));
  const monthlyIncome = income === null ? null : (income * (perYear[f[keys.incomePeriod] ?? ""] ?? 1)) / 12;
  const taxes = (num(f[keys.taxes]) ?? 0) / 12;
  const heat = num(f[keys.heat]) ?? 0;
  const condo = (num(f[keys.condo]) ?? 0) * (f[keys.condoFull] === "Yes" ? 1 : 0.5);
  // ponytail: other debts are only other-property payments and expenses; add a liabilities table (cards, loans) for full TDS.
  const other = (num(f[keys.otherPayments]) ?? 0) + (num(f[keys.otherExpenses]) ?? 0);

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
