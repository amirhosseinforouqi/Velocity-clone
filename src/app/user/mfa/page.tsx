import { AppMfa } from "@/components/platform/portal-admin";
import { requireActor } from "@/auth";
import { startMfa } from "@/server/users";

export default async function Page() {
  const actor = await requireActor({ allowWithoutMfa: true });
  return <AppMfa enabled={actor.mfaEnabled} required={actor.mfaRequired} setup={actor.mfaEnabled ? null : startMfa(actor)} />;
}
