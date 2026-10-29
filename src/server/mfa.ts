// Staff TOTP MFA (RFC 6238: SHA-1, 6 digits, 30 s), compatible with any authenticator app.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32(buf: Buffer) {
  let bits = "", out = "";
  for (const b of buf) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function unbase32(s: string) {
  const bits = [...s.toUpperCase()].map((c) => B32.indexOf(c).toString(2).padStart(5, "0")).join("");
  return Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
}

export function totp(secret: string, at = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac("sha1", unbase32(secret)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

// Accepts the previous and next step too, for clock drift.
export function checkTotp(secret: string, code: string, at = Date.now()) {
  const c = code.replace(/\s/g, "");
  return /^\d{6}$/.test(c) && [-1, 0, 1].some((d) => timingSafeEqual(Buffer.from(totp(secret, at + d * 30000)), Buffer.from(c)));
}

export const newTotpSecret = () => base32(randomBytes(20));
export const otpauthUri = (secret: string, email: string) => `otpauth://totp/Keyway:${encodeURIComponent(email)}?secret=${secret}&issuer=Keyway`;

// The secret at rest: AES-256-GCM with a key derived from AUTH_SECRET.
const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`mfa:${s}`).digest();
};
export function sealSecret(secret: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(secret, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}
export function openSecret(sealed: string) {
  const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}
