import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Document bytes, keyed by document id. Private: nothing here is served directly, only through the checked download route.
// ponytail: local disk (outside public/, unencrypted). S3 / R2 with server-side encryption is pending until a bucket exists;
// swapping means reimplementing these two functions.
const dir = () => process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".data", "uploads");

function file(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid storage key");
  // The ignore comments keep the build from tracing (and shipping) the project, uploads included, into the server output.
  return path.join(/*turbopackIgnore: true*/ dir(), id);
}

export async function putFile(id: string, bytes: Uint8Array) {
  await mkdir(/*turbopackIgnore: true*/ dir(), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ file(id), bytes, { flag: "wx" }); // never overwrite
}

export const getFile = (id: string) => readFile(/*turbopackIgnore: true*/ file(id));
