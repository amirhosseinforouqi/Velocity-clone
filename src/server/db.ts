import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema.ts";

// ponytail: PGlite (real Postgres compiled to WASM, in-process) because no Postgres server is installed here.
// For a hosted Postgres, swap this file to drizzle-orm/node-postgres with DATABASE_URL; the schema and queries stay the same.
export async function openDb(dataDir?: string) {
  if (dataDir) mkdirSync(dataDir, { recursive: true }); // PGlite only creates the last path segment
  const db = drizzle({ client: new PGlite(dataDir), schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

export type Db = Awaited<ReturnType<typeof openDb>>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const g = globalThis as unknown as { keywayDb?: Promise<Db> };

// One instance per server process; kept on globalThis so dev hot reload doesn't open a second one.
// A failed open is forgotten so the next request retries instead of failing until restart.
export function getDb() {
  g.keywayDb ??= openDb(process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite"))
    .then(async (db) => {
      if (process.env.NODE_ENV !== "production") await (await import("./seed.ts")).seedIfEmpty(db);
      return db;
    })
    .catch((e) => {
      g.keywayDb = undefined;
      throw e;
    });
  return g.keywayDb;
}
