// Offices, users, deactivation, organization settings, consents, the condition library and logs against an in-memory Postgres: `npm test`.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { eq } from "drizzle-orm";
import { Forbidden, type Actor } from "./access.ts";
import {
  deactivateUser, deleteConsent, deleteOffice, getOrganization, getUser, listAudit, listConditionTemplates, listConsents, listOffices, listUsers,
  restoreUser, saveConditionTemplate, saveConsent, saveOffice, saveOrganization, saveUser,
} from "./admin.ts";
import { createContact, ValidationError } from "./contacts.ts";
import { createDeal, listDeals } from "./deals.ts";
import { openDb, type Db } from "./db.ts";
import { slaDays } from "./reports.ts";
import { auditLog, deals, tasks, users } from "./schema.ts";
import { DEV_PASSWORD, seedIfEmpty } from "./seed.ts";
import { createTask, dealReminders, reminderLevel } from "./tasks.ts";
import { getActor, verifyLogin } from "./users.ts";

let db: Db;
const as: Record<string, Actor> = {};
const PW = "a-long-test-password";
const PURPOSE = "mortgageRequest/Mortgage Breakdown/Application Purpose";

before(async () => {
  db = await openDb();
  await seedIfEmpty(db);
  for (const u of await db.select().from(users)) as[u.email.split("@")[0]] = u;
});

const newUser = (email: string, actor = as.admin, extra = {}) =>
  saveUser(db, actor, null, { name: "Test Person", email, officeId: as.agent.officeId, role: "agent", password: PW, ...extra });

test("only admins reach admin data, and an office admin only their own office", async () => {
  await assert.rejects(listOffices(db, as.agent), Forbidden);
  await assert.rejects(listUsers(db, as.assistant), Forbidden);
  assert.equal((await listOffices(db, as.admin)).length, 2);
  assert.deepEqual((await listOffices(db, as["office.admin"])).map((o) => o.id), [as.agent.officeId]);

  const oa = as["office.admin"];
  assert.ok((await listUsers(db, oa)).every((u) => u.officeId === oa.officeId && u.role !== "org_admin"));
  assert.equal(await getUser(db, oa, as.admin.id), null, "office admin can't open an org admin");
  assert.equal(await getUser(db, oa, as["ottawa.agent"].id), null, "or someone in another office");
  await assert.rejects(saveOffice(db, oa, null, { name: "New Office" }), Forbidden);
  await assert.rejects(saveOffice(db, oa, as["ottawa.agent"].officeId, { name: "Mine now" }), Forbidden);
  await assert.rejects(newUser("grant@keyway.test", oa, { role: "org_admin" }), Forbidden);
  await assert.rejects(newUser("elsewhere@keyway.test", oa, { officeId: as["ottawa.agent"].officeId }), ValidationError);
  assert.ok(await newUser("hired.by.office@keyway.test", oa));
});

test("users: validation, partial updates, and no password hash in the audit log", async () => {
  await assert.rejects(newUser("short@keyway.test", as.admin, { password: "too-short" }), /12 characters/);
  await assert.rejects(newUser("AGENT@keyway.test"), /already has this email/);
  await assert.rejects(saveUser(db, as.admin, as.admin.id, { role: "agent" }), /your own role/);

  const id = await newUser("partial@keyway.test", as.admin, { details: { "Job Title": "Associate", Bogus: "dropped" } });
  assert.deepEqual((await getUser(db, as.admin, id))!.details, { "Job Title": "Associate" });
  await saveUser(db, as.admin, id, { name: "Renamed Person" });
  const u = (await getUser(db, as.admin, id))!;
  assert.equal(u.name, "Renamed Person");
  assert.equal(u.email, "partial@keyway.test");
  assert.deepEqual(u.details, { "Job Title": "Associate" }, "details stay when not sent");
  assert.ok(await verifyLogin(db, "partial@keyway.test", PW));

  const logged = JSON.stringify(await db.select().from(auditLog).where(eq(auditLog.entityId, id)));
  assert.ok(!logged.includes("passwordHash") && !logged.includes("scrypt") && logged.includes('"password":"changed"'));
});

test("deactivating a user locks them out and shows their deals under No Agent until reassigned", async () => {
  const leaving = (await getActor(db, await newUser("leaving@keyway.test")))!;
  const contact = await createContact(db, leaving, { firstName: "Test", lastName: "Borrower" });
  const deal = await createDeal(db, leaving, contact.id, { status: "new_deal" });
  await createTask(db, leaving, { type: "phone", title: "Follow up", dueDate: "2026-03-10", dealId: deal.id });

  await assert.rejects(deactivateUser(db, as.admin, as.admin.id), /yourself/);
  await assert.rejects(deactivateUser(db, as.admin, leaving.id, as["ottawa.agent"].id), /same office/);
  await deactivateUser(db, as.admin, leaving.id);
  assert.equal(await getActor(db, leaving.id), null);
  assert.equal(await verifyLogin(db, "leaving@keyway.test", PW), null);
  const row = (await listDeals(db, as.admin)).find((d) => d.id === deal.id)!;
  assert.equal(row.agentActive, false);

  await restoreUser(db, as.admin, leaving.id);
  assert.ok(await getActor(db, leaving.id));
  await deactivateUser(db, as.admin, leaving.id, as.agent.id);
  const [moved] = await db.select().from(deals).where(eq(deals.id, deal.id));
  assert.equal(moved.agentId, as.agent.id);
  assert.ok((await db.select().from(tasks).where(eq(tasks.dealId, deal.id))).every((t) => t.assigneeId === as.agent.id));
  assert.equal((await listDeals(db, as.admin)).find((d) => d.id === deal.id)!.agentActive, true);
});

test("organization settings drive reminder thresholds and SLA targets", async () => {
  const base = { name: "Keyway Mortgages", sla: { approved: 7, accepted: 7, waiting_to_close: 30 }, features: ["Enable eSign", "Not a flag"] };
  await assert.rejects(saveOrganization(db, as["office.admin"], { ...base, reminders: { urgent: 1, warning: 2, notice: 3 } }), Forbidden);
  await assert.rejects(saveOrganization(db, as.admin, { ...base, reminders: { urgent: 7, warning: 7, notice: 14 } }), /must go up/);
  await assert.rejects(saveOrganization(db, as.admin, { ...base, sla: { ...base.sla, approved: 1.5 }, reminders: { urgent: 1, warning: 2, notice: 3 } }), /whole number/);

  await saveOrganization(db, as.admin, { ...base, sla: { ...base.sla, approved: 3 }, reminders: { urgent: 1, warning: 3, notice: 5 } });
  const { settings } = await getOrganization(db, as.admin.organizationId);
  assert.deepEqual(settings.features, ["Enable eSign"]);
  assert.equal(reminderLevel(["2026-03-12"], "2026-03-10", settings.reminders), "Warning");
  assert.equal(reminderLevel(["2026-03-16"], "2026-03-10", settings.reminders), null);
  assert.deepEqual((await slaDays(db, as.admin.organizationId))[0], ["approved", 3]);
  assert.ok(Array.isArray(await dealReminders(db, as.agent)));
});

test("consent templates belong to an office; offices with people can't be deleted", async () => {
  const oa = as["office.admin"], ottawa = as["ottawa.agent"].officeId;
  await assert.rejects(saveConsent(db, oa, oa.officeId, null, { title: "", content: "x" }), /Consent Title/);
  await assert.rejects(saveConsent(db, oa, ottawa, null, { title: "T", content: "C" }), Forbidden);
  const id = await saveConsent(db, oa, oa.officeId, null, { title: "Privacy", content: "We collect...", signature: true });
  await saveConsent(db, oa, oa.officeId, id, { title: "Privacy notice", content: "We collect...", active: false });
  const [c] = (await listConsents(db, oa, oa.officeId)).filter((x) => x.id === id);
  assert.equal(c.title, "Privacy notice");
  assert.equal(c.active, false);
  assert.equal(c.signature, false);
  assert.deepEqual(await listConsents(db, oa, ottawa), []);
  await deleteConsent(db, oa, id);
  assert.ok(!(await listConsents(db, oa, oa.officeId)).some((x) => x.id === id));

  await assert.rejects(deleteOffice(db, as.admin, oa.officeId), /still has/);
  const empty = await saveOffice(db, as.admin, null, { name: "Pop-up Office", City: "Kingston", Junk: "dropped" });
  assert.deepEqual((await listOffices(db, as.admin)).find((o) => o.id === empty)!.details, { City: "Kingston" });
  await saveConsent(db, as.admin, empty, null, { title: "T", content: "C" });
  await deleteOffice(db, as.admin, empty);
  assert.ok(!(await listOffices(db, as.admin)).some((o) => o.id === empty));
});

test("condition library: organization admins only, rule keys must be real fields", async () => {
  await assert.rejects(listConditionTemplates(db, as["office.admin"]), Forbidden);
  await assert.rejects(saveConditionTemplate(db, as.admin, null, { name: "X", rule: { "made/up": ["a"] }, active: true }), /Unknown field/);
  const id = await saveConditionTemplate(db, as.admin, null, { name: "Gift letter", rule: { [PURPOSE]: ["Purchase", "Purchase", ""] }, active: true });
  const t = (await listConditionTemplates(db, as.admin)).find((x) => x.id === id)!;
  assert.deepEqual(t.rule, { [PURPOSE]: ["Purchase"] });
  await saveConditionTemplate(db, as.admin, id, { name: "Gift letter", rule: {}, active: false });
  assert.equal((await listConditionTemplates(db, as.admin)).find((x) => x.id === id)!.active, false);
});

test("logs: organization admins only, filtered by entity, paged", async () => {
  await assert.rejects(listAudit(db, as["office.admin"], {}), Forbidden);
  const all = await listAudit(db, as.admin, {});
  assert.ok(all.total > 0 && all.rows.length <= 25 && all.entities.includes("user"));
  const usersOnly = await listAudit(db, as.admin, { entity: "user", page: 1 });
  assert.ok(usersOnly.rows.every((r) => r.entity === "user"));
  assert.equal((await listAudit(db, as.admin, { page: 999 })).rows.length, 0);
  assert.ok(DEV_PASSWORD && !JSON.stringify(all.rows).includes(DEV_PASSWORD));
});
