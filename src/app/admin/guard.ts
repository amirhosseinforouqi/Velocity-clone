import { notFound } from "next/navigation";
import { requireActor } from "@/auth";
import type { Role } from "@/server/access";
import { isAdmin } from "@/server/admin";
import { getDb } from "@/server/db";

// Admin pages 404 for everyone else; org-only pages also for office admins.
export async function adminPage(orgOnly = false) {
  const actor = await requireActor();
  if (!isAdmin(actor) || (orgOnly && actor.role !== "org_admin")) notFound();
  const roles: Role[] = actor.role === "org_admin" ? ["org_admin", "office_admin", "agent", "assistant"] : ["office_admin", "agent", "assistant"];
  return { db: await getDb(), actor, roles };
}
