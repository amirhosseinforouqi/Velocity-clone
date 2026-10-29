"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth";
import { Forbidden } from "@/server/access";
import { ValidationError } from "@/server/contacts";
import { getDb } from "@/server/db";
import { resetTemplate, saveChecklist, savePortalSettings, saveStage, saveTemplate } from "@/server/portal-admin";

type Result = { error?: string; id?: string };

async function run(fn: (db: Awaited<ReturnType<typeof getDb>>, actor: Awaited<ReturnType<typeof requireActor>>) => Promise<unknown>): Promise<Result> {
  try {
    const r = await fn(await getDb(), await requireActor());
    revalidatePath("/", "layout");
    return typeof r === "string" ? { id: r } : {};
  } catch (e) {
    if (e instanceof ValidationError || e instanceof Forbidden) return { error: e.message };
    throw e;
  }
}

export async function saveTemplateAction(kind: string, input: { subject: string; body: string }) {
  return run((db, actor) => saveTemplate(db, actor, kind, input));
}
export async function resetTemplateAction(kind: string) {
  return run((db, actor) => resetTemplate(db, actor, kind));
}
export async function saveChecklistAction(id: string | null, input: { name: string; active: boolean; items: { name: string; category: string; description: string }[] }) {
  return run((db, actor) => saveChecklist(db, actor, id, input));
}
export async function saveStageAction(id: string | null, input: { label: string; clientDescription: string; nextAction: string; position: number; active: boolean }) {
  return run((db, actor) => saveStage(db, actor, id, input));
}
export async function savePortalSettingsAction(input: { inviteExpiryDays: string; retentionDays: string; requireStaffMfa: boolean }) {
  return run((db, actor) => savePortalSettings(db, actor, input));
}
