import { and, eq, isNull } from "drizzle-orm";
import type { Actor } from "./access.ts";
import type { Db } from "./db.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { users } from "./schema.ts";

const failures = new Map<string, { count: number; until: number }>();
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
let dummyHash: Promise<string> | undefined;

// ponytail: lockout counter lives in process memory; move it to the database or Redis when running more than one instance.
export async function verifyLogin(db: Db, rawEmail: string, password: string) {
  const email = rawEmail.trim().toLowerCase();
  const now = Date.now();
  const f = failures.get(email);
  if (f && f.count >= MAX_FAILURES && f.until > now) return null;

  const [user] = await db.select().from(users).where(and(eq(users.email, email), isNull(users.deactivatedAt)));
  // Hash even for unknown emails so response time doesn't reveal which accounts exist.
  const ok = await verifyPassword(password, user?.passwordHash ?? (await (dummyHash ??= hashPassword("unused"))));
  if (!user || !ok) {
    const count = f && f.until > now ? f.count + 1 : 1;
    failures.set(email, { count, until: now + LOCK_MS });
    return null;
  }
  failures.delete(email);
  return { id: user.id, name: user.name, email: user.email };
}

export async function getActor(db: Db, id: string): Promise<(Actor & { name: string; email: string }) | null> {
  const [u] = await db.select({ id: users.id, organizationId: users.organizationId, officeId: users.officeId, role: users.role, name: users.name, email: users.email })
    .from(users).where(and(eq(users.id, id), isNull(users.deactivatedAt)));
  // A deactivated user's existing session stops working on its next request.
  return u ?? null;
}
