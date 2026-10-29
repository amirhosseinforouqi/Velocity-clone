// Conditions, smart rules and documents against an in-memory Postgres, with uploads in a temp folder: `npm test`.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import type { Actor } from "./access.ts";
import { addCondition, dealChecklist, matchesRule, MAX_UPLOAD, openDocument, removeDocument, setConditionStatus, uploadDocument } from "./conditions.ts";
import { listContacts } from "./contacts.ts";
import { createDeal, moveDeal, saveDeal } from "./deals.ts";
import { openDb, type Db } from "./db.ts";
import { auditLog, users } from "./schema.ts";
import { seedIfEmpty } from "./seed.ts";

let db: Db;
let uploads: string;
const as: Record<string, Actor> = {};
const EMPLOYMENT = "borrowers/Employment/Employment Type";
const PURPOSE = "mortgageRequest/Mortgage Breakdown/Application Purpose";
const pdf = new TextEncoder().encode("%PDF-1.4\n% synthetic test file\n%%EOF\n");
const names = async (actor: Actor, dealId: string) => (await dealChecklist(db, actor, dealId)).conditions.map((c) => c.name).sort();

before(async () => {
  uploads = await mkdtemp(path.join(tmpdir(), "keyway-uploads-"));
  process.env.UPLOAD_DIR = uploads;
  db = await openDb();
  await seedIfEmpty(db);
  for (const u of await db.select().from(users)) as[u.email.split("@")[0]] = u;
});
after(() => rm(uploads, { recursive: true, force: true }));

async function newApplication(actor = as.agent) {
  const [contact] = await listContacts(db, actor);
  return createDeal(db, actor, contact.id, { status: "new_deal" });
}

test("a rule is an AND of accepted values; an empty rule always matches", () => {
  assert.ok(matchesRule({}, {}));
  assert.ok(matchesRule({ a: ["x", "y"], b: ["z"] }, { a: "y", b: "z" }));
  assert.ok(!matchesRule({ a: ["x"], b: ["z"] }, { a: "x" }));
});

test("smart rules add matching conditions on save, never twice, and never bring back a waived one", async () => {
  const deal = await newApplication();
  assert.deepEqual(await names(as.agent, deal.id), ["Government photo ID for each applicant", "Void cheque or pre-authorized debit form"]);

  await saveDeal(db, as.agent, deal.id, { [PURPOSE]: "Purchase", [EMPLOYMENT]: "Self-Employed" });
  const list = await names(as.agent, deal.id);
  for (const n of ["Agreement of purchase and sale", "T1 Generals and Notices of Assessment, last 2 years", "Home insurance binder"]) assert.ok(list.includes(n), n);
  assert.ok(!list.includes("Letter of employment"));

  const { conditions } = await dealChecklist(db, as.agent, deal.id);
  await setConditionStatus(db, as.agent, conditions.find((c) => c.name.startsWith("Agreement"))!.id, "waived");
  await saveDeal(db, as.agent, deal.id, { [PURPOSE]: "Purchase", [EMPLOYMENT]: "Self-Employed" });
  assert.deepEqual(await names(as.agent, deal.id), list, "no duplicates, waived stays waived");
});

test("leads get no checklist until they become applications", async () => {
  const [contact] = await listContacts(db, as.agent);
  const lead = await createDeal(db, as.agent, contact.id, { status: "lead" });
  await saveDeal(db, as.agent, lead.id, { [PURPOSE]: "Refinance" });
  assert.deepEqual(await names(as.agent, lead.id), []);
  await moveDeal(db, as.agent, lead.id, "new_deal");
  assert.ok((await names(as.agent, lead.id)).includes("Current mortgage statement"));
});

test("custom and library conditions can be added once; bad statuses are rejected", async () => {
  const deal = await newApplication();
  const { library } = await dealChecklist(db, as.agent, deal.id);
  const pick = library.find((t) => t.name === "Condo status certificate")!;
  await addCondition(db, as.agent, deal.id, { templateId: pick.id });
  await assert.rejects(addCondition(db, as.agent, deal.id, { templateId: pick.id }), /already/);
  await addCondition(db, as.agent, deal.id, { name: "  Gift letter  " });
  assert.ok((await names(as.agent, deal.id)).includes("Gift letter"));
  await assert.rejects(addCondition(db, as.agent, deal.id, { name: " " }));
  const [c] = (await dealChecklist(db, as.agent, deal.id)).conditions;
  await assert.rejects(setConditionStatus(db, as.agent, c.id, "approved"));
});

test("another agent can't see, add to, change, upload to, download or remove from a deal", async () => {
  const deal = await newApplication();
  const [c] = (await dealChecklist(db, as.agent, deal.id)).conditions;
  const doc = await uploadDocument(db, as.agent, c.id, { name: "id.pdf", bytes: pdf });
  for (const other of [as.agent2, as["ottawa.agent"]]) {
    await assert.rejects(dealChecklist(db, other, deal.id));
    await assert.rejects(addCondition(db, other, deal.id, { name: "X" }));
    await assert.rejects(setConditionStatus(db, other, c.id, "met"));
    await assert.rejects(uploadDocument(db, other, c.id, { name: "x.pdf", bytes: pdf }));
    assert.equal(await openDocument(db, other, doc.id), null);
    await assert.rejects(removeDocument(db, other, doc.id));
  }
  assert.ok(await openDocument(db, as["office.admin"], doc.id), "the office admin can");
});

test("uploads are type- and size-checked, mark the condition received, and download and remove with an audit trail", async () => {
  const deal = await newApplication();
  const [c] = (await dealChecklist(db, as.agent, deal.id)).conditions;
  const reject = (name: string, bytes: Uint8Array, msg: RegExp) => assert.rejects(uploadDocument(db, as.agent, c.id, { name, bytes }), msg);
  await reject("fake.pdf", new TextEncoder().encode("MZ not a pdf"), /PDF, JPEG and PNG/);
  await reject("empty.pdf", new Uint8Array(), /empty/);
  const big = new Uint8Array(MAX_UPLOAD + 1);
  big.set(pdf);
  await reject("big.pdf", big, /10 MB/);

  const doc = await uploadDocument(db, as.agent, c.id, { name: '../"id"\n.pdf', bytes: pdf });
  assert.equal(doc.fileName, "..__id__.pdf");
  assert.equal(doc.contentType, "application/pdf");
  let list = (await dealChecklist(db, as.agent, deal.id)).conditions.find((x) => x.id === c.id)!;
  assert.equal(list.status, "received");
  assert.equal(list.documents.length, 1);

  const opened = await openDocument(db, as.agent, doc.id);
  assert.deepEqual(new Uint8Array(opened!.bytes), pdf);
  await removeDocument(db, as.agent, doc.id);
  assert.equal(await openDocument(db, as.agent, doc.id), null);
  list = (await dealChecklist(db, as.agent, deal.id)).conditions.find((x) => x.id === c.id)!;
  assert.equal(list.documents.length, 0);
  const actions = (await db.select().from(auditLog).where(and(eq(auditLog.entity, "document"), eq(auditLog.entityId, doc.id)))).map((a) => a.action).sort();
  assert.deepEqual(actions, ["download", "remove", "upload"]);
});
