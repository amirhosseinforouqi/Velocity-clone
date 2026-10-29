"use client";

import { useActionState } from "react";
import { field, submit } from "../portal/auth-card";
import { setupAction } from "./actions";

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, null);
  const label = "mb-4 block text-sm font-medium text-slate-700";
  return (
    <form action={action}>
      {state?.error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <label className={label}>Setup code<input name="code" autoComplete="off" required className={field} /></label>
      <label className={label}>Firm name<input name="firm" autoComplete="organization" required className={field} /></label>
      <label className={label}>Your name<input name="name" autoComplete="name" required className={field} /></label>
      <label className={label}>Email<input name="email" type="email" autoComplete="username" required className={field} /></label>
      <label className={label}>Choose a password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={200} required className={field} /></label>
      <label className={label}>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={200} required className={field} /></label>
      <p className="mb-2 text-xs text-slate-500">At least 12 characters. This becomes the firm&apos;s administrator account.</p>
      <button disabled={pending} className={submit}>{pending ? "Setting up..." : "Create workspace"}</button>
    </form>
  );
}
