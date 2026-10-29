import { defineConfig } from "drizzle-kit";

// Only used by `drizzle-kit generate`; the app applies migrations itself on startup (src/server/db.ts).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/schema.ts",
  out: "./drizzle",
});
