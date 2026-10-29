import { placeholderWebhooks } from "@/components/platform/placeholder-data";
import { AppWebhookTransactions } from "@/components/platform/support";

export const dynamicParams = false;

export function generateStaticParams() {
  return placeholderWebhooks.map((w) => ({ key: w.key }));
}

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <AppWebhookTransactions webhookKey={key} />;
}
