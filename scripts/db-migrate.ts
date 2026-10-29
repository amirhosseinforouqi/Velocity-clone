// Applies drizzle/ migrations to the hosted database, then makes sure the private storage bucket exists:
//   DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:migrate
// On Vercel, `vercel-build` runs this before `next build` with the Supabase integration's POSTGRES_URL. Safe to re-run; it never deletes data.
import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { databaseUrl } from "../src/server/db.ts";

const url = databaseUrl();
if (!url) throw new Error("Set DATABASE_URL (or POSTGRES_URL)");
const client = postgres(url, { max: 1, prepare: false });
await migrate(drizzle({ client }), { migrationsFolder: "drizzle" });
console.log("Migrations applied");
await client.end();

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET = "client-documents" } = process.env;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  const storage = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).storage;
  const { data } = await storage.getBucket(SUPABASE_BUCKET);
  const options = { public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"] };
  const { error } = data ? await storage.updateBucket(SUPABASE_BUCKET, options) : await storage.createBucket(SUPABASE_BUCKET, options);
  if (error) throw error;
  console.log(`Private bucket "${SUPABASE_BUCKET}" ready`);
} else console.log("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set: skipped the storage bucket");
