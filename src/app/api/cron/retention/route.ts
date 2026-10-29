import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/server/db";
import { runRetention } from "@/server/portal-admin";

// Daily (vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const a = Buffer.from(req.headers.get("authorization") ?? ""), b = Buffer.from(`Bearer ${secret}`);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runRetention(await getDb()));
}
