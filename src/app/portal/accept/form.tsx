"use client";

import { useActionState } from "react";
import { acceptAction } from "../actions";
import { field, submit } from "../auth-card";

export function AcceptForm({ token, email, hasAccount }: { token: string; email: string; hasAccount: boolean }) {
  const [state, action, pending] = useActionState(acceptAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      {state?.error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <label className="mb-4 block text-sm font-medium text-slate-700">Email<input value={email} readOnly autoComplete="username" className={`${field} bg-slate-50`} /></label>
      {hasAccount ? (
        <>
          <p className="mb-4 text-sm text-slate-600">You already have a portal account. Enter its password to add this application to it.</p>
          <label className="mb-4 block text-sm font-medium text-slate-700">Password<input name="password" type="password" autoComplete="current-password" required className={field} /></label>
        </>
      ) : (
        <>
          <label className="mb-4 block text-sm font-medium text-slate-700">Choose a password<input name="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={200} required className={field} /></label>
          <label className="mb-4 block text-sm font-medium text-slate-700">Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={10} maxLength={200} required className={field} /></label>
          <p className="mb-2 text-xs text-slate-500">At least 10 characters.</p>
        </>
      )}
      <button disabled={pending} className={submit}>{pending ? "Setting up..." : "Accept and continue"}</button>
    </form>
  );
}
