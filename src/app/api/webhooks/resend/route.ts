import { getDb } from "@/server/db";
import { applyWebhookEvent, verifyWebhook } from "@/server/email";

// Resend delivery events (delivered, bounced, complained, failed) update the delivery shown next to each invitation.
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("Not configured", { status: 503 });
  const body = await req.text();
  if (!verifyWebhook(secret, req.headers, body)) return new Response("Bad signature", { status: 401 });
  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  await applyWebhookEvent(await getDb(), event);
  return new Response(null, { status: 204 });
}
