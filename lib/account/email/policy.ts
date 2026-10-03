import "server-only";
import z from "zod";
import { accountSql } from "../store";
import { appOrigin, launchPolicy } from "../config";
import { protectedKey } from "./crypto";
export const emailAddress = z.string().trim().max(254).email().transform(value => value.toLowerCase());
export async function takeQuota(key: string, limit: number, seconds: number) {
  const rows = await accountSql`INSERT INTO b1_rate_buckets(key,count,started_at,expires_at) VALUES (${key},1,now(),now()+${seconds}*interval '1 second')
   ON CONFLICT(key) DO UPDATE SET count=CASE WHEN b1_rate_buckets.expires_at<=now() THEN 1 ELSE b1_rate_buckets.count+1 END,
   started_at=CASE WHEN b1_rate_buckets.expires_at<=now() THEN now() ELSE b1_rate_buckets.started_at END,
   expires_at=CASE WHEN b1_rate_buckets.expires_at<=now() THEN now()+${seconds}*interval '1 second' ELSE b1_rate_buckets.expires_at END
   WHERE b1_rate_buckets.expires_at<=now() OR b1_rate_buckets.count<${limit} RETURNING count`;
  return !!rows[0];
}
export async function validateBot(token: string, action: string, requestHeaders: Headers) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) throw new Error("Email requests are unavailable until bot protection is configured");
  if (!token || token.length > 2048) throw new Error("Complete the verification check");
  const origin = requestHeaders.get("origin");
  if (origin && origin !== appOrigin()) throw new Error("Request origin is not allowed");
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: new URLSearchParams({ secret, response: token, idempotency_key: crypto.randomUUID() }), signal: AbortSignal.timeout(8000) });
  const result = await response.json();
  if (!response.ok || result.success !== true || result.action !== action || result.hostname !== new URL(appOrigin()).hostname) throw new Error("Verification check expired. Please retry.");
}
export async function requestBudget(email: string, purpose: string, requestHeaders: Headers) {
  const policy = launchPolicy();
  // Only deploy behind the documented trusted proxy; do not trust arbitrary client IP headers.
  const ip = process.env.TRUST_PROXY_IP === "true" ? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" : "untrusted-source";
  const source = protectedKey(`source:${ip}`);
  if (!await takeQuota(`request:${purpose}:${source}`, policy.sourceRequestsPerHour, 3600)) return false;
  // A recipient-specific marker counts a new destination only once in a daily source budget.
  const recipient = protectedKey(email);
  const marker = `distinct-marker:${source}:${recipient}`, budget = `distinct:${source}`;
  const rows = await accountSql`WITH seen AS (SELECT 1 FROM b1_rate_buckets WHERE key=${marker} AND expires_at>now()),
   capacity AS (INSERT INTO b1_rate_buckets(key,count,started_at,expires_at)
    SELECT ${budget},1,now(),now()+interval '24 hours' WHERE NOT EXISTS(SELECT 1 FROM seen)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN b1_rate_buckets.expires_at<=now() THEN 1 ELSE b1_rate_buckets.count+1 END,
    expires_at=CASE WHEN b1_rate_buckets.expires_at<=now() THEN now()+interval '24 hours' ELSE b1_rate_buckets.expires_at END
    WHERE b1_rate_buckets.expires_at<=now() OR b1_rate_buckets.count<${policy.recipientsPerSourcePerDay} RETURNING 1),
   accepted AS (INSERT INTO b1_rate_buckets(key,count,started_at,expires_at)
    SELECT ${marker},1,now(),now()+interval '24 hours' FROM capacity
    ON CONFLICT(key) DO UPDATE SET count=1,expires_at=excluded.expires_at RETURNING 1)
   SELECT 1 FROM seen UNION ALL SELECT 1 FROM accepted`;
  return !!rows[0];
}
export async function deliverable(email: string) {
  const scope = process.env.EMAIL_SUPPRESSION_SCOPE || "b1-way-team";
  const rows = await accountSql`SELECT 1 FROM b1_email_suppressions WHERE scope=${scope} AND recipient_key=${protectedKey(email.toLowerCase())}`;
  return !rows[0];
}
