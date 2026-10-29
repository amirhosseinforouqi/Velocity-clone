import { putFile, checkLocalUpload, supabaseStorage } from "@/server/storage";

const MAX = 10 * 1024 * 1024;

// Local-storage stand-in for Supabase's signed upload URL: the HMAC in the URL is the permission (issued by startUpload
// after the auth and type/size checks). finishUpload then re-checks the actual bytes. Write-once.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const q = new URL(req.url).searchParams;
  if (supabaseStorage() || !checkLocalUpload(id, q.get("exp"), q.get("sig"))) return new Response("Forbidden", { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX) return new Response("Too large", { status: 413 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX) return new Response("Too large", { status: 413 });
  try {
    await putFile(id, bytes);
  } catch {
    return new Response("Already uploaded", { status: 409 });
  }
  return new Response(null, { status: 204 });
}
