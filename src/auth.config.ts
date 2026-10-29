import type { NextAuthConfig } from "next-auth";

// Edge-safe part of the auth config (no database), shared by the proxy and src/auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [],
  callbacks: {
    // Optimistic check only; every server action and page re-loads the user from the database (src/auth.ts).
    authorized: ({ auth, request }) => !!auth?.user || request.nextUrl.pathname === "/login",
    session: ({ session, token }) => {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
