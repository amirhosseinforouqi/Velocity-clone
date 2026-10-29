import { and, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { contacts, deals, users, type role } from "./schema.ts";

export type Role = (typeof role.enumValues)[number];
export type Actor = { id: string; organizationId: string; officeId: string; role: Role };

export class Forbidden extends Error {}

type Scoped = { organizationId: PgColumn; officeId: PgColumn; deletedAt: PgColumn };

// Who sees which rows, as a WHERE clause. Every read and write goes through it, so no query fetches rows the actor can't see.
// org_admin: whole organization. office_admin / assistant: their office. agent: rows they own.
// ponytail: assistants see their whole office; narrow to the agents they assist once that link exists.
function scope(actor: Actor, t: Scoped, owner: PgColumn): SQL {
  const where = [eq(t.organizationId, actor.organizationId), isNull(t.deletedAt)];
  if (actor.role === "office_admin" || actor.role === "assistant") where.push(eq(t.officeId, actor.officeId));
  if (actor.role === "agent") where.push(eq(owner, actor.id));
  return and(...where)!;
}

export const contactScope = (actor: Actor) => scope(actor, contacts, contacts.ownerId);
export const dealScope = (actor: Actor) => scope(actor, deals, deals.agentId);

// The users who can see a deal (the same rules turned around), so a deal task is only ever assigned to someone who can open it.
export const dealViewers = (deal: { organizationId: string; officeId: string; agentId: string }) =>
  and(
    eq(users.organizationId, deal.organizationId),
    isNull(users.deactivatedAt),
    or(eq(users.id, deal.agentId), eq(users.role, "org_admin"), and(inArray(users.role, ["office_admin", "assistant"]), eq(users.officeId, deal.officeId))),
  )!;
