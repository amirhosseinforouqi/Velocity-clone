import { clientSetup } from "../actions";
import { AuthCard, submit } from "../auth-card";

export const metadata = { title: "Set up your portal · Keyway" };

// Where the one-time link in the welcome email lands. Nothing happens until the client presses the button
// (so an email scanner that only opens the link can't use it up); then they choose their own password.
export default async function PortalSetup({ searchParams }: { searchParams: Promise<{ i?: string; t?: string; error?: string }> }) {
  const { i, t, error } = await searchParams;
  return (
    <AuthCard title="Welcome! Set up your secure client portal account.">
      {error || !i || !t ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">This setup link has expired or was already used. If you have already chosen a password, sign in below. Otherwise ask your mortgage team to send a new invitation.</p>
      ) : (
        <form action={clientSetup}>
          <input type="hidden" name="i" value={i} />
          <input type="hidden" name="t" value={t} />
          <p className="mb-4 text-sm text-slate-600">On the next page you will choose your own password. Your username is your email address.</p>
          <button className={submit}>Set up my account</button>
        </form>
      )}
      <p className="mt-6 text-center text-xs text-slate-500"><a href="/portal/login" className="font-medium text-[#3d81be] hover:underline">Already set up? Sign in</a></p>
    </AuthCard>
  );
}
