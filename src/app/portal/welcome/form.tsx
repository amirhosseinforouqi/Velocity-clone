"use client";

import { useActionState } from "react";
import { setPasswordAction } from "../actions";
import { field, submit } from "../auth-card";

export function WelcomeForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(setPasswordAction, null);
  return (
    <form action={action}>
      {state?.error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <label className="mb-4 block text-sm font-medium text-slate-700">Email<input value={email} readOnly autoComplete="username" className={`${field} bg-slate-50`} /></label>
      <label className="mb-4 block text-sm font-medium text-slate-700">New password<input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={200} required className={field} /></label>
      <label className="mb-4 block text-sm font-medium text-slate-700">Confirm new password<input name="confirm" type="password" autoComplete="new-password" minLength={10} maxLength={200} required className={field} /></label>
      <p className="mb-2 text-xs text-slate-500">At least 10 characters, different from the temporary password in your welcome email.</p>
      <button disabled={pending} className={submit}>{pending ? "Saving..." : "Save and continue"}</button>
    </form>
  );
}
