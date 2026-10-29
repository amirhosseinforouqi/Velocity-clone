import { auth, requireActor, requireClient } from "@/auth";
import { getDb } from "@/server/db";
import { auditDownload, downloadable, staffFile } from "@/server/portal";
import { auditClientDownload, clientFile } from "@/server/portal-client";
import { downloadUrl, getFile } from "@/server/storage";

// Portal documents and message attachments, for staff (deal in scope) or a client (their own requests and conversations).
// Quarantined or purged files are refused. Every download is audited. Supabase: redirect to a 60-second signed URL.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await getDb();
  let f, log: () => Promise<void>;
  if ((await auth())?.user?.kind === "client") {
    const found = await clientFile(db, await requireClient(), id);
    if (!found) return new Response("Not found", { status: 404 });
    f = found.file;
    log = () => auditClientDownload(db, found.client, found.file);
  } else {
    const actor = await requireActor();
    f = await staffFile(db, actor, id);
    if (!f) return new Response("Not found", { status: 404 });
    const file = f;
    log = () => auditDownload(db, actor, file);
  }
  const refused = downloadable(f);
  if (refused) return new Response(refused, { status: f.purgedAt ? 410 : 409 });
  await log();
  const url = await downloadUrl(f.id, f.fileName);
  if (url) return Response.redirect(url, 302);
  return new Response(new Uint8Array(await getFile(f.id)), {
    headers: {
      "Content-Type": f.contentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
