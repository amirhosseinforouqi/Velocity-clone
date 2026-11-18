import type { NextAuthConfig } from "next-auth";

const open = ["/login", "/setup", "/portal/login", "/portal/setup"];

// Edge-safe part of the auth config (no database), shared by the proxy and src/auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [],
  callbacks: {
    // Optimistic check only; every server action and page re-loads the user from the database (src/auth.ts).
    authorized: ({ auth, request: { nextUrl } }) => {
      const portal = nextUrl.pathname === "/portal" || nextUrl.pathname.startsWith("/portal/");
      // A signed-in client never gets a staff page, including the few that load no server data and so skip requireActor().
      if (auth?.user?.kind === "client" && !portal && !open.includes(nextUrl.pathname)) return Response.redirect(new URL("/portal", nextUrl));
      if (auth?.user || open.includes(nextUrl.pathname)) return true;
      // Clients get the portal sign-in, not the staff one.
      if (portal) return Response.redirect(new URL("/portal/login", nextUrl));
      return false;
    },
    jwt: ({ token, user }) => {
      if (user) { token.kind = user.kind; token.role = user.role; }
      return token;
    },
    session: ({ session, token }) => {
      if (token.sub) session.user.id = token.sub;
      session.user.kind = token.kind;
      // Only used to hide menus; the server re-loads the real role on every request.
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
