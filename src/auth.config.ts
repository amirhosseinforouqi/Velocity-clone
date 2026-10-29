import type { NextAuthConfig } from "next-auth";

const open = ["/login", "/setup", "/portal/login"];

// Edge-safe part of the auth config (no database), shared by the proxy and src/auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [],
  callbacks: {
    // Optimistic check only; every server action and page re-loads the user from the database (src/auth.ts).
    authorized: ({ auth, request: { nextUrl } }) => {
      if (auth?.user || open.includes(nextUrl.pathname)) return true;
      // Clients get the portal sign-in, not the staff one.
      if (nextUrl.pathname === "/portal" || nextUrl.pathname.startsWith("/portal/")) return Response.redirect(new URL("/portal/login", nextUrl));
      return false;
    },
    jwt: ({ token, user }) => {
      if (user) token.kind = user.kind;
      return token;
    },
    session: ({ session, token }) => {
      if (token.sub) session.user.id = token.sub;
      session.user.kind = token.kind;
      return session;
    },
  },
} satisfies NextAuthConfig;
