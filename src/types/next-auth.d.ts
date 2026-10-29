import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    kind?: "staff" | "client";
  }
  interface Session {
    user: { kind?: "staff" | "client" } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    kind?: "staff" | "client";
  }
}
