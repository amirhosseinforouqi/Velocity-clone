import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { mkdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import * as schema from "./schema.ts";

// Local and tests: PGlite (real Postgres compiled to WASM, in-process). Migrations run on open.
export async function openDb(dataDir?: string) {
  if (dataDir) mkdirSync(dataDir, { recursive: true }); // PGlite only creates the last path segment
  const db = drizzle({ client: new PGlite(dataDir), schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

export type Db = Awaited<ReturnType<typeof openDb>>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// Hosted (Supabase Postgres): DATABASE_URL. Migrations are applied by `npm run db:migrate`, never on a serverless cold start.
// prepare: false because Supabase's transaction pooler doesn't support prepared statements.
// ponytail: typed as the PGlite database; the query builder is identical, only raw db.execute() results differ (none in app code).
function openHosted(url: string) {
  return drizzlePg({ client: postgres(url, { prepare: false, max: 5 }), schema }) as unknown as Db;
}

// DATABASE_URL, or the POSTGRES_URL the Supabase integration adds on Vercel (transaction pooler, IPv4).
// The integration's extra "supa" query param isn't a Postgres setting, so it's dropped.
export function databaseUrl() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!raw) return undefined;
  const url = new URL(raw);
  url.searchParams.delete("supa");
  return url.toString();
}

const g = globalThis as unknown as { keywayDb?: Promise<Db> };

// One instance per server process; kept on globalThis so dev hot reload doesn't open a second one.
// A failed open is forgotten so the next request retries instead of failing until restart.
export function getDb() {
  const url = databaseUrl();
  if (url) return (g.keywayDb ??= Promise.resolve(openHosted(url)));
  if (process.env.NODE_ENV === "production" && process.env.VERCEL) throw new Error("DATABASE_URL is required on Vercel");
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
