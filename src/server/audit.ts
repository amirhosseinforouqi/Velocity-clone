import type { Actor } from "./access.ts";
import type { Tx } from "./db.ts";
import { auditLog } from "./schema.ts";

export function audit(tx: Tx, actor: Actor, entity: string, entityId: string, action: string, before: unknown, after: unknown) {
  return tx.insert(auditLog).values({ organizationId: actor.organizationId, actorId: actor.id, entity, entityId, action, before, after });
}
