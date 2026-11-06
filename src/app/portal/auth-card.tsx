import type { ReactNode } from "react";
import { KeyRound } from "lucide-react";
import { portalFonts } from "./fonts";

// Sign-in and set-password card for clients, in the portal's look.
export const field = "mt-1 h-11 w-full rounded-xl border border-[#d8d2c4] bg-white px-3 text-[15px] text-[#1c2a27] outline-none focus:border-[#1f5c4a] focus:ring-4 focus:ring-[#1f5c4a]/10";
export const submit = "mt-2 h-11 w-full rounded-full bg-[#1f5c4a] text-sm font-semibold text-white transition hover:bg-[#174636] disabled:opacity-60";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className={`${portalFonts} grid min-h-screen place-items-center bg-[#f6f3ec] px-4 py-10 text-[#1c2a27]`}>
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid size-10 place-items-center rounded-full bg-[#1f5c4a] text-white"><KeyRound className="size-5" aria-hidden /></span>
          <span className="font-[family-name:var(--font-display)] text-2xl font-semibold">Keyway</span>
        </div>
        <div className="rounded-2xl border border-[#e4dfd3] bg-white p-8 shadow-[0_1px_2px_rgba(28,42,39,0.04)]">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[#5d6b66] uppercase">Client portal</p>
          <h1 className="mt-2 mb-6 font-[family-name:var(--font-display)] text-2xl leading-snug font-medium">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}
