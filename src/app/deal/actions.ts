"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth";
import { Forbidden } from "@/server/access";
import { saveAmlAssessment, setCompliance } from "@/server/compliance";
import { addCondition, removeDocument, setConditionStatus, uploadDocument } from "@/server/conditions";
import { createContact, setCasl, ValidationError } from "@/server/contacts";
import { getDb } from "@/server/db";
import type { DealStatus } from "@/server/deal-status";
import { createDeal, deleteDeal, moveDeal, newDealValues, restoreDeal, saveDeal } from "@/server/deals";
import { bulkTasks, createTask, dealReminders, myDay, removeTask, today, updateTask } from "@/server/tasks";
import { lenderChoices } from "@/server/lenders";
import { validateDeal, type Problem } from "@/server/validate";

type Result = { error?: string; id?: string };

async function run(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const id = await fn();
    for (const p of ["/", "/dashboard", "/deal", "/deals", "/contacts", "/my-day", "/calendar", "/compliance", "/reports", "/admin/deleted"]) revalidatePath(p, "layout");
    return id ? { id } : {};
  } catch (e) {
    if (e instanceof ValidationError || e instanceof Forbidden) return { error: e.message };
    throw e;
  }
}

const formObject = (form: FormData) => Object.fromEntries(form.entries());

// Add Lead / Add Application: a new contact plus its first deal. Returns the deal id.
export async function createContactDealAction(status: "lead" | "new_deal", form: FormData) {
  return run(async () => {
    const db = await getDb();
    const actor = await requireActor();
    const input = formObject(form);
    newDealValues({ ...input, status }); // reject bad deal fields before the contact is created
    // ponytail: contact and deal are two transactions; if the deal insert fails the contact stays, which is still a valid contact.
    const contact = await createContact(db, actor, input);
    if (form.get("casl") === "on") await setCasl(db, actor, [contact.id], true);
    return (await createDeal(db, actor, contact.id, { ...input, status })).id;
  });
}

// Add Application's Lender list: the lenders the current user may submit to (they become the deal's agent).
export async function myLenderChoicesAction() {
  const actor = await requireActor();
  return lenderChoices(await getDb(), actor.organizationId, actor.id);
}

export async function quickApplicationAction(contactId: string) {
  return run(async () => (await createDeal(await getDb(), await requireActor(), contactId, { status: "new_deal" })).id);
}

// The Save + Validate button submits intent=validate: the deal is saved first, then the saved values are checked.
export async function saveDealAction(id: string, _prev: unknown, form: FormData): Promise<Result & { problems?: Problem[] }> {
  let saved: Awaited<ReturnType<typeof saveDeal>> | undefined;
  const r = await run(async () => void (saved = await saveDeal(await getDb(), await requireActor(), id, formObject(form))));
  if (!saved || form.get("intent") !== "validate") return r;
  return { ...r, problems: validateDeal(saved, await lenderChoices(await getDb(), saved.organizationId, saved.agentId)) };
}

export async function moveDealAction(id: string, to: DealStatus) {
  return run(async () => void (await moveDeal(await getDb(), await requireActor(), id, to)));
}

export async function deleteDealAction(id: string) {
  return run(async () => void (await deleteDeal(await getDb(), await requireActor(), id)));
}

export async function restoreDealAction(id: string) {
  return run(async () => void (await restoreDeal(await getDb(), await requireActor(), id)));
}

export async function addConditionAction(dealId: string, input: { templateId?: string; name?: string }) {
  return run(async () => void (await addCondition(await getDb(), await requireActor(), dealId, input)));
}

export async function setConditionStatusAction(id: string, status: string) {
  return run(async () => void (await setConditionStatus(await getDb(), await requireActor(), id, status)));
}

export async function uploadDocumentAction(conditionId: string, form: FormData) {
  return run(async () => {
    const file = form.get("file");
    if (!(file instanceof File)) throw new ValidationError("Choose a file to upload");
    await uploadDocument(await getDb(), await requireActor(), conditionId, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  });
}

export async function removeDocumentAction(id: string) {
  return run(async () => void (await removeDocument(await getDb(), await requireActor(), id)));
}

export async function createTaskAction(input: Record<string, unknown>) {
  return run(async () => (await createTask(await getDb(), await requireActor(), input)).id);
}

export async function updateTaskAction(id: string, input: Record<string, unknown>) {
  return run(async () => void (await updateTask(await getDb(), await requireActor(), id, input)));
}

export async function removeTaskAction(id: string) {
  return run(async () => void (await removeTask(await getDb(), await requireActor(), id)));
}

export async function bulkTasksAction(ids: string[], op: string) {
  return run(async () => void (await bulkTasks(await getDb(), await requireActor(), ids, op)));
}

// Top bar badges: today's open tasks (with overdue) and deal reminders, trimmed to what the dropdowns show.
export async function topBarAction() {
  const [db, actor, now] = [await getDb(), await requireActor(), today()];
  const [tasks, reminders] = await Promise.all([myDay(db, actor, now, now), dealReminders(db, actor, now)]);
  return {
    tasks: tasks.filter((t) => !t.done).map((t) => ({ id: t.id, title: t.title, dealNumber: t.dealNumber })),
    reminders: reminders.map((r) => ({ id: r.id, level: r.level, firstName: r.firstName, lastName: r.lastName, closingDate: r.closingDate })),
  };
}

// Compliance review (status, note, package lock) and a borrower's AML assessment.
export async function setComplianceAction(dealId: string, input: { status: string; note: string; locked: boolean }) {
  return run(async () => void (await setCompliance(await getDb(), await requireActor(), dealId, input)));
}

export async function saveAmlAction(dealId: string, contactId: string, input: Record<string, string>) {
  return run(async () => void (await saveAmlAssessment(await getDb(), await requireActor(), dealId, contactId, input)));
}
