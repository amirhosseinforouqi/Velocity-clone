import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { authConfig } from "./auth.config";
import { getDb } from "@/server/db";
import { getClientAccount, verifyClientLogin } from "@/server/portal-client";
import { getActor, verifyLogin } from "@/server/users";

// Password was right but an authenticator code is needed; the login page then asks for it.
export class MfaRequired extends CredentialsSignin {
  code = "mfa";
}

// Two kinds of session in one app: staff (sub = users.id) and portal clients (sub = their account id).
// Each require* helper checks the kind, so a client session can never reach a staff page or action, or the reverse.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "credentials",
      credentials: { email: {}, password: {}, code: {} },
      authorize: async (c) => {
        const r = await verifyLogin(await getDb(), String(c.email ?? ""), String(c.password ?? ""), String(c.code ?? "").replace(/\s/g, ""));
        if (r === "mfa") throw new MfaRequired();
        return r;
      },
    }),
    Credentials({
      id: "client",
      credentials: { email: {}, password: {} },
      authorize: async (c) => verifyClientLogin(await getDb(), String(c.email ?? ""), String(c.password ?? "")),
    }),
  ],
});

// The signed-in staff user, freshly loaded so a changed role or removed user takes effect at once. Redirects to /login otherwise.
// Staff in a firm that requires MFA are sent to set it up before anything else (except the setup page itself).
export async function requireActor({ allowWithoutMfa = false } = {}) {
  const user = (await auth())?.user;
  const actor = user?.id && user.kind !== "client" ? await getActor(await getDb(), user.id) : null;
  if (!actor) redirect(user?.kind === "client" ? "/portal" : "/login");
  if (actor.mfaRequired && !actor.mfaEnabled && !allowWithoutMfa) redirect("/user/mfa");
  return actor;
}

export async function requireClient() {
  const user = (await auth())?.user;
  const account = user?.id && user.kind === "client" ? await getClientAccount(await getDb(), user.id) : null;
  if (!account) redirect(user?.kind === "staff" ? "/" : "/portal/login");
  return account;
}
