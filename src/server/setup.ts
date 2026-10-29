// First run on an empty hosted database: creates the firm, its first office and the first org admin.
// Guarded by SETUP_CODE from the deployment's env so a stranger can't claim a fresh deployment, and closed once an organization exists.
import { createHash, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { ValidationError } from "./contacts.ts";
import type { Db } from "./db.ts";
import { hashPassword } from "./password.ts";
import { offices, organizations, users } from "./schema.ts";
import { seedTemplates } from "./seed.ts";

export async function needsSetup(db: Db) {
  return !(await db.select({ id: organizations.id }).from(organizations).limit(1)).length;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export async function createFirstAdmin(db: Db, input: { code: string; firm: string; name: string; email: string; password: string }, expected = process.env.SETUP_CODE) {
  if (!expected || !timingSafeEqual(digest(input.code.trim()), digest(expected))) throw new ValidationError("That setup code isn't right.");
  const firm = input.firm.trim(), name = input.name.trim(), email = input.email.trim().toLowerCase();
  if (!firm || !name) throw new ValidationError("Enter the firm name and your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("Enter a valid email address.");
  if (input.password.length < 12 || input.password.length > 200) throw new ValidationError("Password must be at least 12 characters.");
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    // Two submits at once can't both create a firm.
    await tx.execute(sql`select pg_advisory_xact_lock(7311)`);
    if ((await tx.select({ id: organizations.id }).from(organizations).limit(1)).length) throw new ValidationError("This workspace is already set up. Sign in instead.");
    const [org] = await tx.insert(organizations).values({ name: firm }).returning();
    const [office] = await tx.insert(offices).values({ organizationId: org.id, name: "Main Office" }).returning();
    await tx.insert(users).values({ organizationId: org.id, officeId: office.id, email, name, role: "org_admin", passwordHash });
  });
  await seedTemplates(db);
}
