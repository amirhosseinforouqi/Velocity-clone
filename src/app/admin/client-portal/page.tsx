import { AppPortalSettings } from "@/components/platform/portal-admin";
import { emailConfigured } from "@/server/email";
import { portalSettings } from "@/server/portal-admin";
import { supabaseStorage } from "@/server/storage";
import { adminPage } from "../guard";

// Only whether each integration is configured; never the values.
export default async function Page() {
  const { db, actor } = await adminPage(true);
  const env = process.env;
  const status: [string, boolean, string][] = [
    ["Email (Resend)", emailConfigured(), "RESEND_API_KEY and EMAIL_FROM. Without them invitations are recorded as not sent."],
    ["Delivery tracking", !!env.RESEND_WEBHOOK_SECRET, "RESEND_WEBHOOK_SECRET, for bounces and delivery failures."],
    ["Private file storage (Supabase)", !!supabaseStorage(), "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Without them files are kept on this server's disk (development only)."],
    ["Malware scanning", !!env.MALWARE_SCAN_URL, "MALWARE_SCAN_URL. Without it uploads stay quarantined until staff release them."],
    ["Retention job", !!env.CRON_SECRET, "CRON_SECRET, for the daily cleanup of closed deals."],
  ];
  return <AppPortalSettings settings={await portalSettings(db, actor)} status={status} />;
}
