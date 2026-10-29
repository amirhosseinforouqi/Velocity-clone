import { requireActor } from "@/auth";
import { openDocument } from "@/server/conditions";
import { getDb } from "@/server/db";

// The only way a document leaves storage: signed in, deal in scope, audited, and always as a download.
// ponytail: streams through the app. With S3 this becomes a redirect to a short-lived signed URL after the same check.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const found = await openDocument(await getDb(), await requireActor(), id);
  if (!found) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(found.bytes), {
    headers: {
      "Content-Type": found.doc.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(found.doc.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
