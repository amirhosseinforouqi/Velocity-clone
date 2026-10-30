import { AppWebhookTransactions } from "@/components/platform/support";

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <AppWebhookTransactions webhookKey={key} />;
}
