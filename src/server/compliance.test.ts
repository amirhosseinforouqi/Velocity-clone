// Compliance status, package lock, AML assessments, the dashboard and the AML reports, against an in-memory Postgres: `npm test`.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { amlRisk } from "../components/platform/aml-fields.ts";
import type { Actor } from "./access.ts";
import { complianceDashboard, dealCompliance, saveAmlAssessment, setCompliance } from "./compliance.ts";
import { addCondition, dealChecklist, removeDocument, setConditionStatus, uploadDocument } from "./conditions.ts";
import { listContacts } from "./contacts.ts";
import { createDeal } from "./deals.ts";
import { openDb, type Db } from "./db.ts";
import { runReport } from "./reports.ts";
import { users } from "./schema.ts";
import { seedIfEmpty } from "./seed.ts";

let db: Db;
let uploads: string;
const as: Record<string, Actor> = {};
const pdf = new TextEncoder().encode("%PDF-1.4\n% synthetic test file\n%%EOF\n");
const lowRisk = { id: "Dual-process method", pep: "No", thirdParty: "No", funds: "Savings or income", income: "Yes", residency: "Canadian citizen or permanent resident", behaviour: "No" };
const screened = { screening: "clear", screeningList: "Synthetic test list", screenedOn: "2026-10-01" };

before(async () => {
  uploads = await mkdtemp(path.join(tmpdir(), "keyway-uploads-"));
  process.env.UPLOAD_DIR = uploads;
  db = await openDb();
  await seedIfEmpty(db);
  for (const u of await db.select().from(users)) as[u.email.split("@")[0]] = u;
});
after(() => rm(uploads, { recursive: true, force: true }));

async function newApplication() {
  const [contact] = await listContacts(db, as.agent);
  const deal = await createDeal(db, as.agent, contact.id, { status: "new_deal" });
  return { deal, contactId: contact.id };
}

test("AML risk is the highest any answer raises; a possible sanction match is always high", () => {
  assert.equal(amlRisk(lowRisk, "clear"), "low");
  assert.equal(amlRisk({ ...lowRisk, funds: "Gift from family" }, "clear"), "medium");
  assert.equal(amlRisk({ ...lowRisk, funds: "Gift from family", pep: "Yes" }, "clear"), "high");
  assert.equal(amlRisk(lowRisk, "possible_match"), "high");
});

test("only reviewers set compliance; compliant needs every borrower assessed and screened; a lock needs compliant", async () => {
  const { deal, contactId } = await newApplication();
  const admin = as["office.admin"];
  await assert.rejects(setCompliance(db, as.agent, deal.id, { status: "compliant", note: "", locked: false }), /admin/);
  await assert.rejects(setCompliance(db, admin, deal.id, { status: "non_compliant", note: " ", locked: false }), /Note/);
  await assert.rejects(setCompliance(db, admin, deal.id, { status: "in_progress", note: "", locked: true }), /compliant/);
  await assert.rejects(setCompliance(db, admin, deal.id, { status: "compliant", note: "", locked: false }), /AML/);

  await assert.rejects(saveAmlAssessment(db, as.agent, deal.id, contactId, { ...lowRisk, pep: "Maybe", ...screened }), /politically/);
  await assert.rejects(saveAmlAssessment(db, as.agent, deal.id, contactId, { ...lowRisk, screening: "clear", screeningList: "", screenedOn: "" }), /Lists/);
  await saveAmlAssessment(db, as.agent, deal.id, contactId, { ...lowRisk, screening: "not_screened" });
  await assert.rejects(setCompliance(db, admin, deal.id, { status: "compliant", note: "", locked: false }), /screening/);
  assert.equal(await saveAmlAssessment(db, as.agent, deal.id, contactId, { ...lowRisk, ...screened }), "low");

  await setCompliance(db, admin, deal.id, { status: "compliant", note: "Checked", locked: false });
  const c = await dealCompliance(db, as.agent, deal.id);
  assert.equal(c.status, "compliant");
  assert.equal(c.canReview, false);
  assert.equal(c.borrowers[0].assessment?.risk, "low");

  await assert.rejects(dealCompliance(db, as.agent2, deal.id), /not found/);
  await assert.rejects(saveAmlAssessment(db, as.agent2, deal.id, contactId, { ...lowRisk, ...screened }), /not found/);
});

test("changing an assessment on a compliant deal puts it back to In progress", async () => {
  const { deal, contactId } = await newApplication();
  await saveAmlAssessment(db, as.agent, deal.id, contactId, { ...lowRisk, ...screened });
  await setCompliance(db, as.admin, deal.id, { status: "compliant", note: "", locked: false });
  assert.equal(await saveAmlAssessment(db, as.agent, deal.id, contactId, { ...lowRisk, funds: "Gift from family", ...screened }), "medium");
  const c = await dealCompliance(db, as.agent, deal.id);
  assert.equal(c.status, "in_progress");
  assert.match(c.reviews[0].note, /changed after/);
});

test("a locked package freezes conditions, documents and AML answers until a reviewer unlocks it", async () => {
  const { deal, contactId } = await newApplication();
  const [cond] = (await dealChecklist(db, as.agent, deal.id)).conditions;
  const doc = await uploadDocument(db, as.agent, cond.id, { name: "id.pdf", bytes: pdf });
  await saveAmlAssessment(db, as.agent, deal.id, contactId, { ...lowRisk, ...screened });
  await setCompliance(db, as.admin, deal.id, { status: "compliant", note: "", locked: true });
  assert.equal((await dealChecklist(db, as.agent, deal.id)).locked, true);

  await assert.rejects(addCondition(db, as.agent, deal.id, { name: "Gift letter" }), /locked/);
  await assert.rejects(setConditionStatus(db, as.agent, cond.id, "met"), /locked/);
  await assert.rejects(uploadDocument(db, as.agent, cond.id, { name: "x.pdf", bytes: pdf }), /locked/);
  await assert.rejects(removeDocument(db, as.agent, doc.id), /locked/);
  await assert.rejects(saveAmlAssessment(db, as.agent, deal.id, contactId, { ...lowRisk, ...screened }), /locked/);

  await setCompliance(db, as.admin, deal.id, { status: "in_progress", note: "Reopened", locked: false });
  await setConditionStatus(db, as.agent, cond.id, "met");
  assert.deepEqual((await dealCompliance(db, as.admin, deal.id)).reviews.map((r) => r.locked), [false, true]);
});

test("the dashboard is for reviewers, scoped to their deals, and searches agent, borrower and loan code", async () => {
  const { deal } = await newApplication();
  await assert.rejects(complianceDashboard(db, as.agent, {}), /admin/);
  const all = await complianceDashboard(db, as.admin, {});
  assert.ok(all.some((r) => r.id === deal.id));
  const office = await complianceDashboard(db, as["office.admin"], {});
  assert.ok(office.length < all.length, "an office admin sees only their office");

  const byCode = await complianceDashboard(db, as.admin, { q: `KW-${deal.number}` });
  assert.deepEqual(byCode.map((r) => r.id), [deal.id]);
  const row = all.find((r) => r.id === deal.id)!;
  assert.ok((await complianceDashboard(db, as.admin, { q: row.agent })).every((r) => r.agent === row.agent));
  assert.ok((await complianceDashboard(db, as.admin, { q: row.borrower! })).some((r) => r.id === deal.id));
  assert.ok((await complianceDashboard(db, as.admin, { compliance: "compliant" })).every((r) => r.compliance === "compliant"));
  assert.ok((await complianceDashboard(db, as.admin, { q: "100%_\\" })).length === 0, "LIKE wildcards are escaped");
});

test("borrower risk and sanction screening reports list every borrower, assessed or not", async () => {
  const { deal, contactId } = await newApplication();
  const code = (r: unknown[]) => (r[0] as { href: string }).href;
  let risk = (await runReport(db, as.agent, "borrower-risk", new URLSearchParams()))!;
  assert.equal(risk.rows.find((r) => code(r) === `/deal/${deal.id}`)?.[2], "Not assessed");
  await saveAmlAssessment(db, as.agent, deal.id, contactId, { ...lowRisk, pep: "Yes", ...screened });
  risk = (await runReport(db, as.agent, "borrower-risk", new URLSearchParams()))!;
  assert.equal(risk.rows.find((r) => code(r) === `/deal/${deal.id}`)?.[2], "High");
  const screening = (await runReport(db, as.agent, "sanction-screening", new URLSearchParams()))!;
  assert.deepEqual(screening.rows.find((r) => code(r) === `/deal/${deal.id}`)?.slice(2, 5), ["No match", "Synthetic test list", "2026-10-01"]);
  const other = (await runReport(db, as.agent2, "borrower-risk", new URLSearchParams()))!;
  assert.ok(!other.rows.some((r) => code(r) === `/deal/${deal.id}`), "another agent doesn't see it");
});
