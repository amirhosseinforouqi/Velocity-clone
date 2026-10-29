// Lenders, products and the choices deals get, against an in-memory Postgres: `npm test`.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { Forbidden, type Actor } from "./access.ts";
import { openDb, type Db } from "./db.ts";
import { createLender, deleteProduct, getLender, lenderChoices, listLenders, saveLender, saveProduct, setLenderHidden } from "./lenders.ts";
import { auditLog, users } from "./schema.ts";
import { seedIfEmpty } from "./seed.ts";

let db: Db;
const as: Record<string, Actor> = {};

before(async () => {
  db = await openDb();
  await seedIfEmpty(db);
  for (const u of await db.select().from(users)) as[u.email.split("@")[0]] = u;
});

const names = async (agent = as.agent) => (await lenderChoices(db, agent.organizationId, agent.id)).map((l) => l.name);
const form = (l: Awaited<ReturnType<typeof getLender>> & object, extra = {}) => ({ ...l, ...l.fees, ...l.limits, ...extra });

test("organization admins only; removed (hidden) lenders aren't offered on deals", async () => {
  await assert.rejects(listLenders(db, as["office.admin"]), Forbidden);
  await assert.rejects(createLender(db, as.agent, { name: "X", type: "Bank" }), Forbidden);
  assert.equal((await listLenders(db, as.admin)).length, 4);
  assert.deepEqual(await names(), ["Demo Credit Union", "Example Trust", "Sample Bank"]);

  await assert.rejects(createLender(db, as.admin, { name: "sample bank", type: "Bank" }), /already has this name/);
  await assert.rejects(createLender(db, as.admin, { name: "New Lender", type: "Bogus" }), /lender type/);
  const id = await createLender(db, as.admin, { name: "New Lender", type: "Monoline" });
  assert.ok((await names()).includes("New Lender"));
  await setLenderHidden(db, as.admin, id, true);
  assert.ok(!(await names()).includes("New Lender"));
  assert.equal((await db.select().from(auditLog).where(and(eq(auditLog.entityId, id), eq(auditLog.action, "hide")))).length, 1);
});

test("saving a lender: underwriters, limits, fees and submission agents", async () => {
  const id = (await listLenders(db, as.admin)).find((l) => l.name === "Sample Bank")!.id;
  const l = (await getLender(db, as.admin, id))!;
  await assert.rejects(saveLender(db, as.admin, id, form(l, { defaultUnderwriter: "Nobody" })), /default underwriter/);
  await assert.rejects(saveLender(db, as.admin, id, form(l, { vb: "0.2505" })), /Volume Bonus \(%\)/);
  await assert.rejects(saveLender(db, as.admin, id, form(l, { vbDays: "1.5" })), /whole number/);
  await assert.rejects(saveLender(db, as.admin, id, form(l, { allAgents: false, agentIds: [] })), /at least one/);
  await assert.rejects(saveLender(db, as.admin, id, form(l, { allAgents: false, agentIds: ["not-a-user"] })), /active users/);

  await saveLender(db, as.admin, id, form(l, { underwriters: ["Desk A", "Desk A", "Desk B"], defaultUnderwriter: "Desk B", vb: "0.25", gds: "35", tds: "", allAgents: false, agentIds: [as.agent2.id] }));
  const saved = (await getLender(db, as.admin, id))!;
  assert.deepEqual(saved.underwriters, ["Desk A", "Desk B"]);
  assert.deepEqual(saved.limits, { gds: 35 });
  assert.equal(saved.fees.vb, 0.25);
  assert.ok(!(await names(as.agent)).includes("Sample Bank"), "not offered to other agents");
  const forAgent2 = (await lenderChoices(db, as.agent2.organizationId, as.agent2.id)).find((c) => c.name === "Sample Bank")!;
  assert.deepEqual(forAgent2.limits, { gds: 35 });
});

test("products: unique per lender, deleted outright, offered under their lender", async () => {
  const id = (await listLenders(db, as.admin)).find((l) => l.name === "Example Trust")!.id;
  await assert.rejects(saveProduct(db, as.admin, id, null, { name: "1 year fixed", term: "1" }), /already has a product/);
  await assert.rejects(saveProduct(db, as.admin, id, null, { name: "Long", term: "41" }), /Term/);
  const p = await saveProduct(db, as.admin, id, null, { name: "Open HELOC", term: "0", ff: "0.5", ffDays: "30" });
  const choice = async () => (await lenderChoices(db, as.agent.organizationId, as.agent.id)).find((c) => c.name === "Example Trust")!;
  assert.ok((await choice()).products.includes("Open HELOC"));
  assert.equal((await getLender(db, as.admin, id))!.products.find((x) => x.id === p)!.fees.ff, 0.5);
  await deleteProduct(db, as.admin, id, p);
  assert.ok(!(await choice()).products.includes("Open HELOC"));
  await assert.rejects(saveProduct(db, as["office.admin"], id, null, { name: "X", term: "1" }), Forbidden);
});
