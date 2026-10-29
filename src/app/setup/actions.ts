"use server";

import { redirect } from "next/navigation";
import { ValidationError } from "@/server/contacts";
import { getDb } from "@/server/db";
import { createFirstAdmin } from "@/server/setup";

export async function setupAction(_: unknown, form: FormData) {
  const get = (k: string) => String(form.get(k) ?? "");
  if (get("password") !== get("confirm")) return { error: "The two passwords don't match." };
  try {
    await createFirstAdmin(await getDb(), { code: get("code"), firm: get("firm"), name: get("name"), email: get("email"), password: get("password") });
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message };
    throw e;
  }
  redirect("/login?setup=1");
}
