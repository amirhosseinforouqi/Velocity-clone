import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { authConfig } from "./auth.config";
import { getDb } from "@/server/db";
import { getActor, verifyLogin } from "@/server/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (c) => verifyLogin(await getDb(), String(c.email ?? ""), String(c.password ?? "")),
    }),
  ],
});

// The signed-in user, freshly loaded so a changed role or removed user takes effect at once. Redirects to /login otherwise.
export async function requireActor() {
  const id = (await auth())?.user?.id;
  const actor = id ? await getActor(await getDb(), id) : null;
  if (!actor) redirect("/login");
  return actor;
}
