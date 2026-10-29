import { clientLogin } from "../actions";
import { AuthCard, field, submit } from "../auth-card";

export const metadata = { title: "Client sign in · Keyway" };

export default async function PortalLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthCard title="Sign in to see your application">
      <form action={clientLogin}>
        {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Email or password is incorrect.</p>}
        <label className="mb-4 block text-sm font-medium text-slate-700">Email<input name="email" type="email" autoComplete="username" required className={field} /></label>
        <label className="mb-4 block text-sm font-medium text-slate-700">Password<input name="password" type="password" autoComplete="current-password" required className={field} /></label>
        <button className={submit}>Sign in</button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">New here? Sign in with your email and the temporary password from your welcome email. Forgot your password, or the temporary one expired? Ask your mortgage team to send a new welcome email.</p>
      <p className="mt-2 text-center text-xs text-slate-500"><a href="/login" className="font-medium text-[#3d81be] hover:underline">Staff sign in</a></p>
    </AuthCard>
  );
}
