"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth";
import { Forbidden } from "@/server/access";
import {
  deactivateUser, deleteConsent, deleteOffice, restoreUser, saveConditionTemplate, saveConsent, saveOffice, saveOrganization, saveUser, slaStatuses,
} from "@/server/admin";
import { ValidationError } from "@/server/contacts";
import { getDb } from "@/server/db";
import { createLender, deleteProduct, saveLender, saveProduct, setLenderHidden, type LenderInput } from "@/server/lenders";

type Result = { error?: string; id?: string };

async function run(fn: (db: Awaited<ReturnType<typeof getDb>>, actor: Awaited<ReturnType<typeof requireActor>>) => Promise<string | void>): Promise<Result> {
  try {
    const id = await fn(await getDb(), await requireActor());
    // Admin changes reach deal grids, assignee lists, reminders and reports, so refresh everything.
    revalidatePath("/", "layout");
    return id ? { id } : {};
  } catch (e) {
    if (e instanceof ValidationError || e instanceof Forbidden) return { error: e.message };
    throw e;
  }
}

const strings = (form: FormData) => Object.fromEntries([...form.entries()].filter((e): e is [string, string] => typeof e[1] === "string"));

export async function saveOfficeAction(id: string | null, _prev: Result | null, form: FormData) {
  return run((db, actor) => saveOffice(db, actor, id, strings(form)));
}

export async function deleteOfficeAction(id: string) {
  return run((db, actor) => deleteOffice(db, actor, id));
}

// The user form posts name / email / officeId / role / password plus the whitelisted detail fields.
export async function saveUserAction(id: string | null, _prev: Result | null, form: FormData) {
  const { name, email, officeId, role, password, ...details } = strings(form);
  return run((db, actor) => saveUser(db, actor, id, { name, email, officeId, role, password, details }));
}

// User Matrix: one field at a time.
export async function patchUserAction(id: string, patch: { role?: string; officeId?: string }) {
  return run((db, actor) => saveUser(db, actor, id, patch));
}

export async function deactivateUserAction(id: string, reassignTo: string) {
  return run((db, actor) => deactivateUser(db, actor, id, reassignTo || undefined));
}

export async function restoreUserAction(id: string) {
  return run((db, actor) => restoreUser(db, actor, id));
}

export async function saveOrganizationAction(_prev: Result | null, form: FormData) {
  const f = strings(form);
  return run((db, actor) => saveOrganization(db, actor, {
    name: f.name,
    sla: Object.fromEntries(slaStatuses.map((s) => [s, f[`sla.${s}`]])),
    reminders: { urgent: f["reminders.urgent"], warning: f["reminders.warning"], notice: f["reminders.notice"] },
    features: form.getAll("features"),
  }));
}

export type ConsentInput = { title: string; content: string; acceptance: boolean; acceptanceText: string; signature: boolean; pageBreak: boolean; active: boolean };

export async function saveConsentAction(officeId: string, id: string | null, c: ConsentInput) {
  return run((db, actor) => saveConsent(db, actor, officeId, id, c));
}

export async function deleteConsentAction(id: string) {
  return run((db, actor) => deleteConsent(db, actor, id));
}

export async function saveConditionAction(id: string | null, c: { name: string; rule: Record<string, string[]>; active: boolean }) {
  return run((db, actor) => saveConditionTemplate(db, actor, id, c));
}

export async function createLenderAction(l: { name: string; type: string }) {
  return run((db, actor) => createLender(db, actor, l));
}

export async function saveLenderAction(id: string, l: LenderInput) {
  return run((db, actor) => saveLender(db, actor, id, l));
}

export async function setLenderHiddenAction(id: string, hidden: boolean) {
  return run((db, actor) => setLenderHidden(db, actor, id, hidden));
}

export async function saveProductAction(lenderId: string, id: string | null, p: Record<string, string>) {
  return run((db, actor) => saveProduct(db, actor, lenderId, id, p));
}

export async function deleteProductAction(lenderId: string, id: string) {
  return run((db, actor) => deleteProduct(db, actor, lenderId, id));
}
