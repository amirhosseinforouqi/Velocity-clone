// The hosted (postgres-js) client must serialize Dates in raw sql`` templates: `npm test`. No connection is made.
import assert from "node:assert/strict";
import { test } from "node:test";
import { openHosted } from "./db.ts";

test("hosted db: Date parameters are sent as ISO strings", async () => {
  const client = (openHosted("postgres://user:pass@127.0.0.1:1/none") as unknown as { $client: { options: { serializers: Record<number, (v: unknown) => unknown> }; end(): Promise<void> } }).$client;
  assert.equal(client.options.serializers[1184](new Date(0)), "1970-01-01T00:00:00.000Z");
  assert.equal(client.options.serializers[1114]("2026-01-01 00:00:00"), "2026-01-01 00:00:00");
  await client.end();
});
