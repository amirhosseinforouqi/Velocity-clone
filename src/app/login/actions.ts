"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { MfaRequired, signIn, signOut } from "@/auth";

export async function login(form: FormData) {
  const next = String(form.get("next") ?? "");
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      code: form.get("code") ?? "",
      // Only same-site paths, so the login page can't be used as an open redirect.
      redirectTo: next.startsWith("/") && !next.startsWith("//") ? next : "/",
    });
  } catch (e) {
    // Only a rejected login gets the "incorrect" message; a DB or config failure must surface as an error.
    // No email in the URL: the code step asks for the password again alongside the code.
    const n = `next=${encodeURIComponent(next)}`;
    if (e instanceof MfaRequired) redirect(`/login?mfa=1&${n}`);
    if (e instanceof AuthError && e.type === "CredentialsSignin") redirect(`/login?${form.get("code") ? "mfa=1&" : ""}error=1&${n}`);
    throw e;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
