import type { Actor } from "./access.ts";
import type { Tx } from "./db.ts";
import { auditLog } from "./schema.ts";

export function audit(tx: Tx, actor: Actor, entity: string, entityId: string, action: string, before: unknown, after: unknown) {
  return tx.insert(auditLog).values({ organizationId: actor.organizationId, actorId: actor.id, entity, entityId, action, before, after });
}

// A portal client's action. Never pass document contents, message bodies or secrets in before / after.
export function auditClient(tx: Tx, client: { id: string; organizationId: string }, entity: string, entityId: string, action: string, after: unknown = null) {
  return tx.insert(auditLog).values({ organizationId: client.organizationId, actorClientId: client.id, entity, entityId, action, before: null, after });
}
