import { getDb } from "@/server/db";
import { invitationInfo } from "@/server/portal-client";
import { AuthCard } from "../auth-card";
import { AcceptForm } from "./form";

export const metadata = { title: "Accept invitation · Keyway", referrer: "no-referrer" };

export default async function Accept({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const info = await invitationInfo(await getDb(), token);
  if (!info) {
    return (
      <AuthCard title="This invitation link isn't valid">
        <p className="text-sm text-slate-600">It may have expired, been replaced by a newer invitation, or already been used. Ask your mortgage team to send a new one, or <a href="/portal/login" className="font-medium text-[#3d81be] hover:underline">sign in</a> if you already have an account.</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={`Hi ${info.firstName}, ${info.firm} invited you to follow your application online.`}>
      <AcceptForm token={token} email={info.email} hasAccount={info.hasAccount} />
    </AuthCard>
  );
}
