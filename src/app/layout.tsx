import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Keyway",
  description: "Keyway mortgage broker platform (placeholder name)",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html lang="en" className={`${openSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Keyed by user: the provider keeps its first session, so without this the menu is stale right after sign-in. */}
        <SessionProvider key={session?.user?.id ?? "anon"} session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
