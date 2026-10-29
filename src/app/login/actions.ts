"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

export async function login(form: FormData) {
  const next = String(form.get("next") ?? "");
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      // Only same-site paths, so the login page can't be used as an open redirect.
      redirectTo: next.startsWith("/") && !next.startsWith("//") ? next : "/",
    });
  } catch (e) {
    // Only a rejected login gets the "incorrect" message; a DB or config failure must surface as an error.
    if (e instanceof AuthError && e.type === "CredentialsSignin") redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
    throw e;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
