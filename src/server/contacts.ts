import { and, asc, eq, ilike } from "drizzle-orm";
import { contactScope, Forbidden, type Actor } from "./access.ts";
import { audit } from "./audit.ts";
import type { Db } from "./db.ts";
import { contactConsents, contacts } from "./schema.ts";

export type ContactRow = typeof contacts.$inferSelect;
export type ContactInput = Pick<ContactRow, "firstName" | "lastName"> & Partial<Pick<ContactRow, "email" | "homePhone" | "cellPhone" | "workPhone" | "address">>;

export class ValidationError extends Error {}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fields = ["firstName", "lastName", "email", "homePhone", "cellPhone", "workPhone", "address"] as const;

// Keeps only known fields that were sent (so a form without an address doesn't wipe it), trims them,
// turns blanks into null, and enforces the rules at the trust boundary.
export function cleanContact(input: Record<string, unknown>): ContactInput {
  const out: Record<string, string | null> = {};
  for (const f of fields) {
    if (!(f in input)) continue;
    const v = typeof input[f] === "string" ? (input[f] as string).trim() : "";
    if (v.length > 200) throw new ValidationError(`${f} is too long`);
    out[f] = v || null;
  }
  if (!out.firstName || !out.lastName) throw new ValidationError("First and last name are required");
  if (out.email && !EMAIL.test(out.email)) throw new ValidationError("Email address is not valid");
  return out as ContactInput;
}

// ponytail: returns every visible contact and the page filters client-side; add server search + pagination past a few thousand rows.
export function listContacts(db: Db, actor: Actor) {
  return db.select().from(contacts).where(contactScope(actor)).orderBy(asc(contacts.lastName), asc(contacts.firstName));
}

// Name-prefix matches shown while adding a contact, so the user can open the existing one instead.
export async function findDuplicates(db: Db, actor: Actor, first: string, last: string) {
  const like = (s: string) => s.trim().replace(/[\\%_]/g, "\\$&") + "%";
  if (!first.trim() && !last.trim()) return [];
  const rows = await db.select().from(contacts)
    .where(and(contactScope(actor), first.trim() ? ilike(contacts.firstName, like(first)) : undefined, last.trim() ? ilike(contacts.lastName, like(last)) : undefined))
    .limit(5);
  return rows.map(contactView);
}

// The only contact fields sent to the browser; tenant ids and timestamps stay on the server.
export function contactView(r: ContactRow) {
  return {
    id: r.id, firstName: r.firstName, lastName: r.lastName, casl: r.casl, email: r.email ?? undefined, homePhone: r.homePhone ?? undefined,
    cellPhone: r.cellPhone ?? undefined, workPhone: r.workPhone ?? undefined, address: r.address ?? undefined,
  };
}

// Returns null both when the row doesn't exist and when the actor can't see it, so ids can't be probed.
export async function getContact(db: Db, actor: Actor, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(contacts).where(and(eq(contacts.id, id), contactScope(actor)));
  return row ?? null;
}

async function mustGet(db: Db, actor: Actor, id: string) {
  const row = await getContact(db, actor, id);
  if (!row) throw new Forbidden("Contact not found");
  return row;
}

export async function createContact(db: Db, actor: Actor, input: Record<string, unknown>) {
  const data = cleanContact(input);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(contacts).values({ ...data, organizationId: actor.organizationId, officeId: actor.officeId, ownerId: actor.id }).returning();
    await audit(tx, actor, "contact", row.id, "create", null, row);
    return row;
  });
}

export async function updateContact(db: Db, actor: Actor, id: string, input: Record<string, unknown>) {
  const before = await mustGet(db, actor, id);
  const data = cleanContact(input);
  return db.transaction(async (tx) => {
    const [row] = await tx.update(contacts).set({ ...data, updatedAt: new Date() }).where(eq(contacts.id, id)).returning();
    await audit(tx, actor, "contact", id, "update", before, row);
    return row;
  });
}

export async function setCasl(db: Db, actor: Actor, ids: string[], optedIn: boolean) {
  const rows = await Promise.all(ids.map((id) => mustGet(db, actor, id)));
  await db.transaction(async (tx) => {
    for (const before of rows.filter((r) => r.casl !== optedIn)) {
      await tx.update(contacts).set({ casl: optedIn, updatedAt: new Date() }).where(eq(contacts.id, before.id));
      await tx.insert(contactConsents).values({ contactId: before.id, optedIn, actorId: actor.id });
      await audit(tx, actor, "contact", before.id, optedIn ? "casl_opt_in" : "casl_opt_out", { casl: before.casl }, { casl: optedIn });
    }
  });
}

// Contacts are never hard-deleted; this hides the row and keeps it for the audit trail.
export async function archiveContact(db: Db, actor: Actor, id: string) {
  if (actor.role === "assistant") throw new Forbidden("Assistants can't archive contacts");
  const before = await mustGet(db, actor, id);
  await db.transaction(async (tx) => {
    await tx.update(contacts).set({ deletedAt: new Date() }).where(eq(contacts.id, id));
    await audit(tx, actor, "contact", id, "archive", before, null);
  });
}
