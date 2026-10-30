// Runs against a fresh in-memory Postgres (PGlite) with the real migrations: `npm test`.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { eq } from "drizzle-orm";
import { Forbidden, type Actor } from "./access.ts";
import { fieldKey, sections } from "../components/platform/deal-sections.ts";
import { archiveContact, createContact, getContact, listContacts, setCasl, updateContact, ValidationError } from "./contacts.ts";
import { allowedMoves, boardStatuses } from "./deal-status.ts";
import { createDeal, dealCode, dealHistory, deleteDeal, findDealByCode, getDeal, listDeals, listDeletedDeals, moveDeal, restoreDeal, saveDeal } from "./deals.ts";
import { openDb, type Db } from "./db.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { auditLog, contactConsents, organizations, users } from "./schema.ts";
import { DEV_PASSWORD, seedIfEmpty } from "./seed.ts";
import { verifyLogin } from "./users.ts";

let db: Db;
const as: Record<string, Actor> = {};

before(async () => {
  db = await openDb();
  await seedIfEmpty(db);
  for (const u of await db.select().from(users)) as[u.email.split("@")[0]] = u;
});

const ownerOf = async (actor: Actor) => (await listContacts(db, actor)).map((c) => c.ownerId);

test("agents see only their own contacts", async () => {
  const owners = await ownerOf(as.agent);
  assert.ok(owners.length > 0);
  assert.ok(owners.every((o) => o === as.agent.id));
});

test("office admin sees their office only; org admin sees everything", async () => {
  const office = await listContacts(db, as["office.admin"]);
  assert.ok(office.every((c) => c.officeId === as["office.admin"].officeId));
  const all = await listContacts(db, as.admin);
  assert.equal(all.length, 9);
  assert.ok(all.length > office.length, "Ottawa contacts must be hidden from the Toronto office admin");
});

test("another office's contact can't be read, updated or archived by id", async () => {
  const [ottawa] = await listContacts(db, as["ottawa.agent"]);
  assert.equal(await getContact(db, as.agent, ottawa.id), null);
  assert.equal(await getContact(db, as["office.admin"], ottawa.id), null);
  await assert.rejects(updateContact(db, as.agent, ottawa.id, { firstName: "X", lastName: "Y" }));
  await assert.rejects(archiveContact(db, as["office.admin"], ottawa.id));
  await assert.rejects(setCasl(db, as.agent, [ottawa.id], true));
});

test("another organization is invisible even to an org admin", async () => {
  const [org] = await db.insert(organizations).values({ name: "Other Org" }).returning();
  const outsider: Actor = { ...as.admin, organizationId: org.id };
  assert.equal((await listContacts(db, outsider)).length, 0);
});

test("create validates input and writes an audit row in the same change", async () => {
  await assert.rejects(createContact(db, as.agent, { firstName: " ", lastName: "Doe" }), /required/);
  await assert.rejects(createContact(db, as.agent, { firstName: "Test", lastName: "Doe", email: "not-an-email" }), /Email/);
  const c = await createContact(db, as.agent, { firstName: " Test ", lastName: "Doe", email: "", unknownField: "ignored" });
  assert.equal(c.firstName, "Test");
  assert.equal(c.email, null);
  assert.equal(c.ownerId, as.agent.id);
  const rows = await db.select().from(auditLog).where(eq(auditLog.entityId, c.id));
  assert.deepEqual(rows.map((r) => r.action), ["create"]);
});

test("update keeps fields that weren't sent", async () => {
  const c = await createContact(db, as.agent, { firstName: "Keep", lastName: "Address", address: "1 Sample St" });
  const u = await updateContact(db, as.agent, c.id, { firstName: "Kept", lastName: "Address" });
  assert.equal(u.address, "1 Sample St");
  assert.equal(u.firstName, "Kept");
});

test("CASL changes are logged; unchanged ones are not", async () => {
  const c = await createContact(db, as.agent, { firstName: "Casl", lastName: "Test" });
  await setCasl(db, as.agent, [c.id], true);
  await setCasl(db, as.agent, [c.id], true);
  await setCasl(db, as.agent, [c.id], false);
  const log = await db.select().from(contactConsents).where(eq(contactConsents.contactId, c.id));
  assert.deepEqual(log.map((l) => l.optedIn), [true, false]);
});

test("archive is a soft delete, audited, and assistants can't do it", async () => {
  const c = await createContact(db, as.agent, { firstName: "Soft", lastName: "Delete" });
  await assert.rejects(archiveContact(db, as.assistant, c.id), /Assistants/);
  await archiveContact(db, as.agent, c.id);
  assert.equal(await getContact(db, as.agent, c.id), null);
  assert.ok(!(await listContacts(db, as.admin)).some((x) => x.id === c.id));
  const actions = (await db.select().from(auditLog).where(eq(auditLog.entityId, c.id))).map((r) => r.action);
  assert.ok(actions.includes("archive"));
});

test("passwords hash and verify; login rejects bad passwords and locks after repeated failures", async () => {
  const h = await hashPassword("correct horse");
  assert.ok(await verifyPassword("correct horse", h));
  assert.ok(!(await verifyPassword("wrong", h)));
  assert.ok(await verifyLogin(db, "AGENT@keyway.test ", DEV_PASSWORD));
  assert.equal(await verifyLogin(db, "nobody@keyway.test", DEV_PASSWORD), null);
  for (let i = 0; i < 5; i++) assert.equal(await verifyLogin(db, "agent2@keyway.test", "wrong"), null);
  assert.equal(await verifyLogin(db, "agent2@keyway.test", DEV_PASSWORD), null, "locked out after 5 failures");
});

// ---- Deals ----

const newDeal = async (actor: Actor, status: "lead" | "new_deal" = "new_deal") => {
  const [c] = await listContacts(db, actor);
  return createDeal(db, actor, c.id, { status, amount: "$450,000", closingDate: "2027-01-15", lender: "Sample Bank" });
};

test("seeded deals exist for every board status and respect agent and office scope", async () => {
  const all = await listDeals(db, as.admin);
  // Every board column except Accepted (empty in the placeholder data) has seeded deals.
  assert.deepEqual(boardStatuses.map(([s]) => s).filter((s) => !all.some((d) => d.status === s)), ["accepted"]);
  assert.ok(all.some((d) => d.status === "parked"));
  const mine = await listDeals(db, as.agent);
  assert.ok(mine.length > 0 && mine.length < all.length);
  const [me] = await db.select().from(users).where(eq(users.id, as.agent.id));
  assert.ok(mine.every((d) => d.agent === me.name));
  const office = await listDeals(db, as["office.admin"]);
  assert.ok(office.length < all.length, "Ottawa deals hidden from the Toronto office admin");
});

test("another office's deal can't be read, found by code, saved or moved", async () => {
  const [ottawa] = await listDeals(db, as["ottawa.agent"]);
  assert.equal(await getDeal(db, as.agent, ottawa.id), null);
  assert.equal(await getDeal(db, as.agent, "not-a-uuid"), null);
  assert.equal(await findDealByCode(db, as["office.admin"], dealCode(ottawa.number)), null);
  assert.equal(await findDealByCode(db, as["ottawa.agent"], dealCode(ottawa.number)), ottawa.id);
  await assert.rejects(saveDeal(db, as.agent, ottawa.id, {}), Forbidden);
  await assert.rejects(moveDeal(db, as["office.admin"], ottawa.id, "parked"), Forbidden);
});

test("create validates, links the borrower, and writes history and audit", async () => {
  const [c] = await listContacts(db, as.agent);
  await assert.rejects(createDeal(db, as.agent, c.id, { status: "funded" }), ValidationError);
  await assert.rejects(createDeal(db, as.agent, c.id, { status: "lead", closingDate: "2027-13-45" }), /Closing date/);
  await assert.rejects(createDeal(db, as.agent, c.id, { status: "lead", amount: "-5" }), /amount/);
  const [ottawaContact] = await listContacts(db, as["ottawa.agent"]);
  await assert.rejects(createDeal(db, as.agent, ottawaContact.id, { status: "lead" }), Forbidden);
  const d = await newDeal(as.agent);
  assert.equal(d.amount, 450000);
  assert.equal(d.agentId, as.agent.id);
  assert.equal(d.fields["closeOut//Lender"], "Sample Bank");
  const full = await getDeal(db, as.agent, d.id);
  assert.equal(full?.borrowers[0].id, c.id);
  assert.deepEqual((await dealHistory(db, d.id)).map((h) => [h.from, h.to]), [[null, "new_deal"]]);
  assert.deepEqual((await db.select().from(auditLog).where(eq(auditLog.entityId, d.id))).map((r) => r.action), ["create", "smart_conditions"], "the checklist is audited with the create");
});

test("status moves follow the rules; park and cancel reinstate to the previous status", async () => {
  const d = await newDeal(as.agent);
  await assert.rejects(moveDeal(db, as.agent, d.id, "funded"), /can't move/);
  const s = await moveDeal(db, as.agent, d.id, "submitted");
  assert.equal(s.submittedDate, new Date().toISOString().slice(0, 10));
  const p = await moveDeal(db, as.agent, d.id, "parked");
  assert.equal(p.previousStatus, "submitted");
  await assert.rejects(moveDeal(db, as.agent, d.id, "approved"), /can't move/, "a parked deal only reinstates");
  const r = await moveDeal(db, as.agent, d.id, "submitted");
  assert.equal(r.previousStatus, null);
  await assert.rejects(moveDeal(db, as.assistant, d.id, "cancelled"), /Assistants/);
  await moveDeal(db, as.agent, d.id, "cancelled");
  assert.equal((await moveDeal(db, as.agent, d.id, "submitted")).status, "submitted");
  assert.deepEqual((await dealHistory(db, d.id)).map((h) => h.to), ["new_deal", "submitted", "parked", "submitted", "cancelled", "submitted"]);
  const audits = (await db.select().from(auditLog).where(eq(auditLog.entityId, d.id))).map((r) => r.action);
  assert.equal(audits.filter((a) => a === "status").length, 5);
  assert.deepEqual(allowedMoves("complete", null), []);
});

test("save keeps only workspace fields, syncs amount and purpose, and audits the diff", async () => {
  const d = await newDeal(as.agent);
  const purpose = "mortgageRequest/Mortgage Breakdown/Application Purpose";
  const total = "mortgageRequest/Mortgage Breakdown/Total Mortgage Amount with Premium";
  const s = await saveDeal(db, as.agent, d.id, { [purpose]: "Refinance", [total]: "512,000", "evil/key": "x", agentId: as.admin.id, conditionsDate: "2027-01-01" });
  assert.equal(s.purpose, "Refinance");
  assert.equal(s.amount, 512000);
  assert.equal(s.agentId, as.agent.id);
  assert.equal(s.conditionsDate, "2027-01-01");
  assert.equal(s.fields["evil/key"], undefined);
  const cleared = await saveDeal(db, as.agent, d.id, { [total]: "" });
  assert.equal(cleared.amount, 450000, "falls back to the 1st mortgage total");
  await assert.rejects(saveDeal(db, as.agent, d.id, { closingDate: "soon" }), /date/);
  const [upd] = (await db.select().from(auditLog).where(eq(auditLog.entityId, d.id))).filter((r) => r.action === "update");
  assert.deepEqual(Object.keys(upd.after as object).sort(), [purpose, total, "conditionsDate"].sort());
});

test("workspace field keys are unique per field", () => {
  const all = sections.flatMap((s) => s.groups.flatMap((g) => (g.fields ?? []).map((f) => fieldKey(s, g, f))));
  const dupes = all.filter((k, i) => all.indexOf(k) !== i);
  assert.deepEqual(dupes, []);
});

test("deleting a deal hides it but keeps it; only admins in scope can see and restore it", async () => {
  const d = await newDeal(as.agent);
  await assert.rejects(deleteDeal(db, as.assistant, d.id), /Assistants/);
  await assert.rejects(deleteDeal(db, as["ottawa.agent"], d.id), Forbidden);
  await deleteDeal(db, as.agent, d.id);
  assert.equal(await getDeal(db, as.agent, d.id), null);
  assert.ok(!(await listDeals(db, as.admin)).some((x) => x.id === d.id));
  await assert.rejects(listDeletedDeals(db, as.agent), Forbidden);
  assert.ok((await listDeletedDeals(db, as.admin)).some((x) => x.id === d.id));
  assert.ok((await listDeletedDeals(db, as["office.admin"])).some((x) => x.id === d.id));
  const ottawa = await newDeal(as["ottawa.agent"]);
  await deleteDeal(db, as["ottawa.agent"], ottawa.id);
  assert.ok(!(await listDeletedDeals(db, as["office.admin"])).some((x) => x.id === ottawa.id), "office admins see their own office only");
  await assert.rejects(restoreDeal(db, as["office.admin"], ottawa.id), Forbidden);
  await assert.rejects(restoreDeal(db, as.agent, d.id), Forbidden);
  await restoreDeal(db, as.admin, d.id);
  assert.equal((await getDeal(db, as.agent, d.id))?.id, d.id);
  await assert.rejects(restoreDeal(db, as.admin, d.id), Forbidden, "a live deal can't be restored");
  const actions = (await db.select().from(auditLog).where(eq(auditLog.entityId, d.id))).map((r) => r.action);
  assert.ok(actions.includes("delete") && actions.includes("restore"));
});
