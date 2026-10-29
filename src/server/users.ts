import { and, eq, isNull } from "drizzle-orm";
import type { Actor } from "./access.ts";
import type { Db } from "./db.ts";
import { audit } from "./audit.ts";
import { ValidationError } from "./contacts.ts";
import { checkTotp, newTotpSecret, openSecret, otpauthUri, sealSecret } from "./mfa.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { organizations, users } from "./schema.ts";

const failures = new Map<string, { count: number; until: number }>();
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
let dummyHash: Promise<string> | undefined;

// Lockout per key ("<email>" for staff, "c:<email>" for portal clients). Shared by both sign-ins.
// ponytail: lockout counter lives in process memory; move it to the database or Redis when running more than one instance.
export const locked = (key: string, now = Date.now()) => {
  const f = failures.get(key);
  return !!f && f.count >= MAX_FAILURES && f.until > now;
};
export function recordFailure(key: string, now = Date.now()) {
  const f = failures.get(key);
  failures.set(key, { count: f && f.until > now ? f.count + 1 : 1, until: now + LOCK_MS });
}
export const clearFailures = (key: string) => failures.delete(key);
// Hash even for unknown emails so response time doesn't reveal which accounts exist.
export const checkPassword = async (password: string, hash: string | null | undefined) => verifyPassword(password, hash ?? (await (dummyHash ??= hashPassword("unused"))));

// null = wrong email / password / code (or locked); "mfa" = password right, an authenticator code is needed.
// A wrong code counts as a failure, so codes can't be guessed past the lockout either.
export async function verifyLogin(db: Db, rawEmail: string, password: string, code = "") {
  const email = rawEmail.trim().toLowerCase();
  if (locked(email)) return null;
  const [user] = await db.select().from(users).where(and(eq(users.email, email), isNull(users.deactivatedAt)));
  if (!user || !(await checkPassword(password, user.passwordHash))) {
    recordFailure(email);
    return null;
  }
  if (user.mfaEnabledAt && user.totpSecret) {
    if (!code) return "mfa" as const;
    if (!checkTotp(openSecret(user.totpSecret), code)) {
      recordFailure(email);
      return null;
    }
  }
  clearFailures(email);
  return { id: user.id, name: user.name, email: user.email, kind: "staff" as const };
}

export async function getActor(db: Db, id: string): Promise<(Actor & { name: string; email: string; mfaEnabled: boolean; mfaRequired: boolean }) | null> {
  const [u] = await db.select({ id: users.id, organizationId: users.organizationId, officeId: users.officeId, role: users.role, name: users.name, email: users.email, mfaEnabledAt: users.mfaEnabledAt, mfaRequired: organizations.requireStaffMfa })
    .from(users).innerJoin(organizations, eq(organizations.id, users.organizationId)).where(and(eq(users.id, id), isNull(users.deactivatedAt)));
  // A deactivated user's existing session stops working on its next request.
  if (!u) return null;
  const { mfaEnabledAt, ...actor } = u;
  return { ...actor, mfaEnabled: !!mfaEnabledAt };
}

// ---- Staff MFA. Setup is stateless: the new secret travels sealed (AES-GCM) in the form until a code proves the app has it.

export function startMfa(actor: { email: string }) {
  const secret = newTotpSecret();
  return { secret, uri: otpauthUri(secret, actor.email), sealed: sealSecret(secret) };
}

export async function enableMfa(db: Db, actor: Actor, sealed: string, code: string) {
  let secret: string;
  try {
    secret = openSecret(sealed);
  } catch {
    throw new ValidationError("Setup expired. Reload the page and scan the new code.");
  }
  if (!checkTotp(secret, code)) throw new ValidationError("That code didn't match. Check the time on your phone and try again.");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ totpSecret: sealSecret(secret), mfaEnabledAt: new Date() }).where(eq(users.id, actor.id));
    await audit(tx, actor, "user", actor.id, "mfa_enable", null, null);
  });
}

export async function disableMfa(db: Db, actor: Actor & { mfaRequired: boolean }, code: string) {
  if (actor.mfaRequired) throw new ValidationError("Your organization requires two-step verification");
  const [u] = await db.select({ s: users.totpSecret }).from(users).where(eq(users.id, actor.id));
  if (!u?.s || !checkTotp(openSecret(u.s), code)) throw new ValidationError("That code didn't match");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ totpSecret: null, mfaEnabledAt: null }).where(eq(users.id, actor.id));
    await audit(tx, actor, "user", actor.id, "mfa_disable", null, null);
  });
}
