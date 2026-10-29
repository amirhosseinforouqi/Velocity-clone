"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActor } from "@/auth";
import { Forbidden } from "@/server/access";
import { archiveContact, createContact, findDuplicates, setCasl, updateContact, ValidationError } from "@/server/contacts";
import { getDb } from "@/server/db";

type Result = { error?: string; id?: string };

// Expected failures go back to the form as a message; anything else is a real error and should surface.
async function run(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const id = await fn();
    revalidatePath("/contacts", "layout");
    return id ? { id } : {};
  } catch (e) {
    if (e instanceof ValidationError || e instanceof Forbidden) return { error: e.message };
    throw e;
  }
}

const formObject = (form: FormData) => Object.fromEntries(form.entries());

export async function createContactAction(form: FormData) {
  return run(async () => {
    const db = await getDb();
    const actor = await requireActor();
    const row = await createContact(db, actor, formObject(form));
    if (form.get("casl") === "on") await setCasl(db, actor, [row.id], true);
    return row.id;
  });
}

export async function saveContactAction(id: string, _prev: Result | null, form: FormData) {
  return run(async () => {
    const db = await getDb();
    const actor = await requireActor();
    await updateContact(db, actor, id, formObject(form));
    await setCasl(db, actor, [id], form.get("casl") === "on");
  });
}

export async function setCaslAction(ids: string[], optedIn: boolean) {
  return run(async () => setCasl(await getDb(), await requireActor(), ids, optedIn));
}

export async function archiveContactAction(id: string) {
  const res = await run(async () => archiveContact(await getDb(), await requireActor(), id));
  if (res.error) return res;
  redirect("/contacts");
}

export async function findDuplicatesAction(first: string, last: string) {
  return findDuplicates(await getDb(), await requireActor(), first, last);
}
