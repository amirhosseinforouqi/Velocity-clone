import type { ReactNode } from "react";
import { KeyRound } from "lucide-react";

// Same card as the staff sign-in, labelled for clients.
export const field = "mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#3d81be] focus:ring-2 focus:ring-[#3d81be]/20";
export const submit = "mt-2 h-10 w-full rounded-md bg-[#3d81be] text-sm font-semibold text-white hover:bg-[#346fa4] disabled:opacity-60";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-1 flex items-center gap-2 text-2xl font-semibold text-slate-800">
          <KeyRound className="size-7 text-[#3d81be]" /> Keyway
        </div>
        <p className="mb-6 text-xs font-semibold tracking-wide text-[#3d81be] uppercase">Client Portal</p>
        <h1 className="mb-4 text-sm text-slate-500">{title}</h1>
        {children}
      </div>
    </main>
  );
}
