import type { ReactNode } from "react";
import { requireClient } from "@/auth";
import { PortalShell } from "@/components/platform/client-portal";
import { getDb } from "@/server/db";
import { clientNotifications, clientUnread } from "@/server/portal-client";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const [db, account] = [await getDb(), await requireClient()];
  return <PortalShell name={account.email} unread={await clientUnread(db, account)} notes={await clientNotifications(db, account)}>{children}</PortalShell>;
}
