import { KeyRound } from "lucide-react";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { needsSetup } from "@/server/setup";
import { SetupForm } from "./form";

export const metadata = { title: "Set up · Keyway" };

export default async function Setup() {
  if (!(await needsSetup(await getDb()))) redirect("/login");
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex items-center gap-2 text-2xl font-semibold text-slate-800">
          <KeyRound className="size-7 text-[#3d81be]" /> Keyway
        </div>
        <h1 className="mb-4 text-sm text-slate-500">Set up your firm&apos;s workspace</h1>
        {process.env.SETUP_CODE ? <SetupForm /> : <p className="text-sm text-slate-600">Setup isn&apos;t enabled on this deployment. Add a SETUP_CODE environment variable and redeploy.</p>}
      </div>
    </main>
  );
}
