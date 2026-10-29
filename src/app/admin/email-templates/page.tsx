import { AppEmailTemplates } from "@/components/platform/portal-admin";
import { emailConfigured } from "@/server/email";
import { listTemplates } from "@/server/portal-admin";
import { adminPage } from "../guard";

export default async function Page() {
  const { db, actor } = await adminPage(true);
  return <AppEmailTemplates templates={await listTemplates(db, actor)} configured={emailConfigured()} />;
}
