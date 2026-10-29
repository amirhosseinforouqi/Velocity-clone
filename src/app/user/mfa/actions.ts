"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/auth";
import { ValidationError } from "@/server/contacts";
import { getDb } from "@/server/db";
import { disableMfa, enableMfa } from "@/server/users";

type Result = { error?: string; ok?: boolean };

export async function mfaAction(_prev: Result | null, form: FormData): Promise<Result> {
  const actor = await requireActor({ allowWithoutMfa: true });
  const code = String(form.get("code") ?? "");
  try {
    if (form.get("sealed")) await enableMfa(await getDb(), actor, String(form.get("sealed")), code);
    else await disableMfa(await getDb(), actor, code);
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message };
    throw e;
  }
  revalidatePath("/user/mfa");
  return { ok: true };
}
