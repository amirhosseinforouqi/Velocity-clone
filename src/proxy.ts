import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Redirects signed-out visitors to /login. Real authorization happens server-side in requireActor().
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
