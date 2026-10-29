// First-run setup against an empty in-memory Postgres: `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { conditionTemplates, users } from "./schema.ts";
import { ValidationError } from "./contacts.ts";
import { openDb } from "./db.ts";
import { verifyLogin } from "./users.ts";
import { createFirstAdmin, needsSetup } from "./setup.ts";

test("setup: code required, creates the first admin once", async () => {
  const db = await openDb();
  const input = { code: "right-code", firm: "Example Lending", name: "First Admin", email: "Owner@Example.test", password: "a-long-test-password" };
  assert.equal(await needsSetup(db), true);
  await assert.rejects(createFirstAdmin(db, { ...input, code: "wrong" }, "right-code"), ValidationError);
  await assert.rejects(createFirstAdmin(db, input, undefined), ValidationError);
  await assert.rejects(createFirstAdmin(db, { ...input, password: "short" }, "right-code"), ValidationError);
  assert.equal(await needsSetup(db), true);

  await createFirstAdmin(db, input, "right-code");
  assert.equal(await needsSetup(db), false);
  const [admin] = await db.select().from(users);
  assert.equal(admin.email, "owner@example.test");
  assert.equal(admin.role, "org_admin");
  assert.ok(await verifyLogin(db, "owner@example.test", "a-long-test-password", ""));
  assert.ok((await db.select().from(conditionTemplates)).length > 0);

  await assert.rejects(createFirstAdmin(db, { ...input, email: "second@example.test" }, "right-code"), /already set up/);
  assert.equal((await db.select().from(users)).length, 1);
});
