import { requireActor } from "@/auth";
import { ValidationError } from "@/server/contacts";
import { getDb } from "@/server/db";
import { exportReport } from "@/server/reports";

// /reports/<slug>/export?<same query as the page>: the report as CSV. Signed in, scoped, audited.
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  try {
    const out = await exportReport(await getDb(), await requireActor(), slug, new URL(req.url).searchParams);
    if (!out) return new Response("Not found", { status: 404 });
    return new Response(out.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(out.name)}.csv`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof ValidationError) return new Response(e.message, { status: 400 });
    throw e;
  }
}
