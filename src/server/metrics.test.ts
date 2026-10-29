import assert from "node:assert/strict";
import { test } from "node:test";
import { dealMetrics, monthlyPayment, num } from "./metrics.ts";
import { validateDeal, validSin } from "./validate.ts";

const near = (a: number | null, b: number, msg?: string) => assert.ok(a !== null && Math.abs(a - b) < 0.01, `${msg ?? ""} ${a} != ${b}`);

test("payments match published amortization figures", () => {
  near(monthlyPayment(400_000, 5, 25), 2326.42, "semi-annual");
  near(monthlyPayment(100_000, 6, 25, "Monthly"), 644.3, "monthly");
  near(monthlyPayment(120_000, 0, 10), 1000, "zero rate");
  assert.deepEqual([num("$4,200"), num("4.79%"), num("25 Years"), num(""), num("abc")], [4200, 4.79, 25, null, null]);
});

// A complete synthetic purchase: $500k price, $400k mortgage, $120k salary, qualifying payment entered.
const deal: Record<string, string> = {
  "mortgageRequest/Mortgage Breakdown/Application Purpose": "Purchase",
  "mortgageRequest/Mortgage Breakdown/Down Payment": "$100,000",
  "mortgageRequest/Mortgage Breakdown/1st Mortgage Total": "$400,000",
  "subjectProperty/Details/Purchase Price": "$500,000",
  "subjectProperty/Details/Appraisal Value": "$520,000",
  "subjectProperty/Details/Annual Taxes": "$3,600",
  "subjectProperty/Details/Heating Cost": "$100",
  "subjectProperty/Details/Condo Fees": "$400",
  "mortgageRequest/Rates and Payments/Net Rate": "4.5%",
  "mortgageRequest/Rates and Payments/Amortization": "25 Years",
  "mortgageRequest/Qualifying Details/Qualifying Payment": "$2,700",
  "assetsProperties/Property Totals/Payments": "$600",
  "borrowers/Employment/T4": "$120,000",
  "borrowers/Employment/Income Period": "Annually",
  "subjectProperty/Address/Street #": "1", "subjectProperty/Address/Street Name": "Sample", "subjectProperty/Address/City": "Sampletown",
  "subjectProperty/Address/Province": "Ontario", "subjectProperty/Address/Postal Code": "K1A 0B1",
};

test("GDS, TDS and LTV use the lower of price and appraisal and half the condo fees", () => {
  const m = dealMetrics(deal);
  // housing = 2700 + 300 tax + 100 heat + 200 condo = 3300 on 10,000/month
  near(m.gds, 33);
  near(m.tds, 39);
  near(m.ltv, 80);
  near(dealMetrics({ ...deal, "subjectProperty/Details/Calculate Condo Fees @100%": "Yes" }).gds, 35);
  assert.equal(dealMetrics({}).gds, null);
  assert.equal(dealMetrics({}).ltv, null);
});

test("without a qualifying payment, it qualifies at the greater of contract + 2% and the floor", () => {
  const rest = { ...deal, "mortgageRequest/Qualifying Details/Qualifying Payment": "" };
  const m = dealMetrics(rest);
  assert.equal(m.parts.qualifyingRate, 6.5);
  near(m.parts.payment, monthlyPayment(400_000, 6.5, 25));
  assert.equal(dealMetrics({ ...rest, "mortgageRequest/Rates and Payments/Net Rate": "2.5%" }).parts.qualifyingRate, 5.25);
  // Monthly income figures are annualised before the ratio.
  near(dealMetrics({ ...deal, "borrowers/Employment/T4": "$10,000", "borrowers/Employment/Income Period": "Monthly" }).gds, 33);
});

test("validation: a complete deal passes; gaps, bad formats and ratio breaches are reported", () => {
  const ok = { status: "new_deal" as const, closingDate: "2026-12-01", fields: deal };
  assert.deepEqual(validateDeal(ok), []);
  assert.ok(validSin("046 454 286") && !validSin("123456789"));

  const keysOf = (fields: Record<string, string>, extra = {}) => validateDeal({ ...ok, ...extra, fields }).map((p) => p.key);
  const empty = keysOf({}, { closingDate: null });
  for (const k of ["mortgageRequest/Mortgage Breakdown/Application Purpose", "subjectProperty/Address/Postal Code", "closingDate", "borrowers/Employment/T4"])
    assert.ok(empty.includes(k), k);
  assert.deepEqual(keysOf({}, { status: "lead" }), [], "leads skip the required fields");

  const bad = keysOf({ ...deal, "subjectProperty/Address/Postal Code": "D1A 1A1", "borrowers/Applicant/SIN": "123456789", "mortgageRequest/Rates and Payments/Net Rate": "45%", "borrowers/Applicant/DOB": "2999-01-01" });
  assert.deepEqual(bad.sort(), ["borrowers/Applicant/DOB", "borrowers/Applicant/SIN", "mortgageRequest/Rates and Payments/Net Rate", "subjectProperty/Address/Postal Code"]);

  assert.deepEqual(keysOf({ ...deal, "mortgageRequest/Mortgage Breakdown/1st Mortgage Total": "$450,000" }), ["mortgageRequest/Mortgage Breakdown/Insurer"], "over 80% needs an insurer");
  const high = validateDeal({ ...ok, fields: { ...deal, "borrowers/Employment/T4": "$80,000" } }).map((p) => p.message).join(" ");
  assert.match(high, /GDS is 49\.50%/);
  assert.match(high, /TDS is 58\.50%/);
});

test("a lender's own limits replace the defaults; unknown lenders and products are flagged", () => {
  const ok = { status: "new_deal" as const, closingDate: "2026-12-01", fields: deal };
  const choice = { name: "Sample Bank", group: "Prime Lenders", products: ["5 Year Fixed"], limits: {} };
  const problems = (lender: string, product: string, limits = {}) =>
    validateDeal({ ...ok, fields: { ...deal, "closeOut//Lender": lender, "closeOut//Product": product } }, [{ ...choice, limits }]).map((p) => p.message).join(" | ");
  assert.equal(problems("Sample Bank", "5 Year Fixed"), "");
  assert.match(problems("Removed Lender", ""), /not an active lender/);
  assert.match(problems("Sample Bank", "HELOC"), /not a product of Sample Bank/);
  assert.match(problems("Sample Bank", "", { gds: 32, tds: 38 }), /GDS is 33\.00%, over the 32% limit.*TDS is 39\.00%, over the 38% limit/);
  assert.match(problems("Sample Bank", "", { ltv: 75 }), /LTV is 80\.00%, over the 75% maximum/);
  assert.equal(problems("Sample Bank", "", { gds: 45, tds: 50 }), "", "looser limits pass too");
});
