import { KeyRound } from "lucide-react";
import { login } from "./actions";

export const metadata = { title: "Sign in · Keyway" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; callbackUrl?: string }> }) {
  const sp = await searchParams;
  // The proxy sends a full URL in callbackUrl; keep only its path.
  const cb = sp.callbackUrl ? new URL(sp.callbackUrl, "http://x") : null;
  const next = sp.next ?? (cb ? cb.pathname + cb.search : "/");
  const input = "mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#3d81be] focus:ring-2 focus:ring-[#3d81be]/20";
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <form action={login} className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex items-center gap-2 text-2xl font-semibold text-slate-800">
          <KeyRound className="size-7 text-[#3d81be]" /> Keyway
        </div>
        <h1 className="mb-4 text-sm text-slate-500">Sign in to your account</h1>
        {sp.error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Email or password is incorrect.</p>}
        <input type="hidden" name="next" value={next} />
        <label className="mb-4 block text-sm font-medium text-slate-700">
          Email
          <input name="email" type="email" autoComplete="username" required className={input} />
        </label>
        <label className="mb-6 block text-sm font-medium text-slate-700">
          Password
          <input name="password" type="password" autoComplete="current-password" required className={input} />
        </label>
        <button className="h-10 w-full rounded-md bg-[#3d81be] text-sm font-semibold text-white hover:bg-[#346fa4]">Sign in</button>
      </form>
    </main>
  );
}
