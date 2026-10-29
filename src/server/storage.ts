import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// File bytes, keyed by a uuid. Private: nothing is served directly, only through the checked download routes.
// With SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY: a private Supabase Storage bucket (server-side only; the service key never
// reaches the browser). Without them: local disk outside public/, for development and tests.
const BUCKET = process.env.SUPABASE_BUCKET ?? "client-documents";
let sb: SupabaseClient | undefined;
export const supabaseStorage = () =>
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? (sb ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })).storage.from(BUCKET)
    : null;

const dir = () => process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".data", "uploads");
const key = (id: string) => {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid storage key");
  return id;
};
// The ignore comments keep the build from tracing (and shipping) the project, uploads included, into the server output.
const file = (id: string) => path.join(/*turbopackIgnore: true*/ dir(), key(id));

export async function putFile(id: string, bytes: Uint8Array, contentType = "application/octet-stream") {
  const s = supabaseStorage();
  if (s) {
    const { error } = await s.upload(key(id), bytes, { contentType, upsert: false }); // never overwrite
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return;
  }
  await mkdir(/*turbopackIgnore: true*/ dir(), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ file(id), bytes, { flag: "wx" });
}

export async function getFile(id: string) {
  const s = supabaseStorage();
  if (!s) return readFile(/*turbopackIgnore: true*/ file(id));
  const { data, error } = await s.download(key(id));
  if (error || !data) throw new Error(`Storage download failed: ${error?.message ?? "no data"}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function removeFile(id: string) {
  const s = supabaseStorage();
  if (s) await s.remove([key(id)]);
  else await rm(/*turbopackIgnore: true*/ file(id), { force: true });
}

// Where the browser PUTs the bytes, so large files never pass through a serverless function body.
// Supabase: its signed upload URL (valid 2 hours, one object). Local: our own HMAC-signed route, valid 15 minutes.
const sign = (id: string, exp: number) => createHmac("sha256", `upload:${process.env.AUTH_SECRET ?? "dev"}`).update(`${id}.${exp}`).digest("base64url");

export async function uploadUrl(id: string) {
  const s = supabaseStorage();
  if (s) {
    const { data, error } = await s.createSignedUploadUrl(key(id));
    if (error || !data) throw new Error(`Storage upload URL failed: ${error?.message ?? "no data"}`);
    return data.signedUrl;
  }
  const exp = Date.now() + 15 * 60 * 1000;
  return `/api/uploads/${key(id)}?exp=${exp}&sig=${sign(id, exp)}`;
}

export function checkLocalUpload(id: string, exp: string | null, sig: string | null, now = Date.now()) {
  if (!exp || !sig || Number(exp) < now) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(id, Number(exp)));
  return a.length === b.length && timingSafeEqual(a, b);
}

// A 60-second signed download URL (Supabase), or null when the caller should stream getFile() itself.
export async function downloadUrl(id: string, fileName: string) {
  const s = supabaseStorage();
  if (!s) return null;
  const { data, error } = await s.createSignedUrl(key(id), 60, { download: fileName });
  if (error || !data) throw new Error(`Storage download URL failed: ${error?.message ?? "no data"}`);
  return data.signedUrl;
}

// Malware scanning. MALWARE_SCAN_URL receives the raw bytes (POST, optional bearer MALWARE_SCAN_TOKEN) and answers
// {"infected": boolean}. Without a scanner, or when it fails, the file is not_scanned: quarantined until staff release it.
export async function scanBytes(bytes: Uint8Array): Promise<"clean" | "infected" | "not_scanned"> {
  const url = process.env.MALWARE_SCAN_URL;
  if (!url) return "not_scanned";
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", ...(process.env.MALWARE_SCAN_TOKEN ? { Authorization: `Bearer ${process.env.MALWARE_SCAN_TOKEN}` } : {}) },
      body: bytes as BodyInit,
      signal: AbortSignal.timeout(20000),
    });
    const body = (await r.json()) as { infected?: unknown };
    if (!r.ok || typeof body.infected !== "boolean") return "not_scanned";
    return body.infected ? "infected" : "clean";
  } catch {
    return "not_scanned";
  }
}
