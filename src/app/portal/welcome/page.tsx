import { requireClient } from "@/auth";
import { AuthCard } from "../auth-card";
import { WelcomeForm } from "./form";

export const metadata = { title: "Choose your password · Keyway" };

export default async function Welcome() {
  const account = await requireClient({ temporary: true });
  return (
    <AuthCard title="Welcome! Choose your own password to finish setting up your portal.">
      <WelcomeForm email={account.email} />
    </AuthCard>
  );
}
