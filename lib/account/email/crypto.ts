import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
function key() {
  const secret = process.env.EMAIL_PROTECTION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Email verification is unavailable until EMAIL_PROTECTION_SECRET is configured");
  return createHash("sha256").update(secret).digest();
}
export function protectedKey(value: string) { return createHmac("sha256", key()).update(value).digest("hex"); }
export function numericCode() { return String(randomInt(0, 1000000)).padStart(6, "0"); }
export function attemptToken() { return randomBytes(32).toString("hex"); }
export function matchesKey(actual: string, expected: string) { return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected)); }
export function seal(value: unknown) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function unseal<T>(value: string): T {
  const bytes = Buffer.from(value, "base64url"), decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
}
