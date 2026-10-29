// Browser side of an upload: ask the server for a signed URL, PUT the bytes straight to storage, then ask the server to
// check them (real type, size, malware scan). The server re-checks everything; these checks only save a round trip.
export const ACCEPT = "application/pdf,image/jpeg,image/png";
const TYPES = ACCEPT.split(",");
const MAX = 10 * 1024 * 1024;

type R<T> = { error?: string; data?: T };
export type Uploaded = { id: string; fileName: string; scan: string };

export async function uploadFile(
  file: File,
  start: (input: { fileName: string; size: number; contentType: string }) => Promise<R<{ fileId: string; url: string }>>,
  finish: (fileId: string) => Promise<R<Uploaded>>,
): Promise<R<Uploaded>> {
  if (!TYPES.includes(file.type)) return { error: `${file.name}: only PDF, JPEG and PNG files can be uploaded` };
  if (file.size > MAX) return { error: `${file.name}: files can be up to 10 MB` };
  if (!file.size) return { error: `${file.name}: the file is empty` };
  const s = await start({ fileName: file.name, size: file.size, contentType: file.type });
  if (s.error || !s.data) return { error: s.error ?? "Upload failed" };
  try {
    const r = await fetch(s.data.url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    if (!r.ok) return { error: `${file.name}: upload failed (${r.status}). Please try again.` };
  } catch {
    return { error: `${file.name}: upload failed. Check your connection and try again.` };
  }
  return finish(s.data.fileId);
}

export const fileSize = (n: number | null) => (n == null ? "" : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
export const when = (d: Date | string | null) => (d ? new Date(d).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : "");
export const statusText: Record<string, string> = {
  requested: "Requested", uploaded: "Uploaded", under_review: "Under review", accepted: "Accepted", replacement_required: "Replacement required",
};
export const statusTone: Record<string, string> = {
  requested: "bg-[#f0ad4e]", uploaded: "bg-[#5bc0de]", under_review: "bg-[#428bca]", accepted: "bg-[#5cb85c]", replacement_required: "bg-[#d9534f]",
};
export const scanText: Record<string, string> = {
  pending: "Uploading", clean: "Scanned", not_scanned: "Quarantined", released: "Released", infected: "Blocked",
};
