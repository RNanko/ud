import { PublicError } from "../errors";
import "server-only";
import { accountSql } from "../store";
import { launchPolicy } from "../config";
import { attemptToken, numericCode, protectedKey, seal } from "./crypto";
import { emailAddress, deliverable, requestBudget, takeQuota } from "./policy";
import { verificationMail } from "./templates";
import { resendClient } from "./delivery";
export type ChallengePurpose = "signup" | "email-change" | "verify-account";
const generic = "If this address can receive verification, your latest code will arrive shortly. You can also sign in, recover your account, change email, or contact support.";
export async function createChallenge(input: string, purpose: ChallengePurpose, requestHeaders: Headers, owner?: { id: string; email: string }) {
  const email = emailAddress.parse(input), token = attemptToken(), id = crypto.randomUUID(), code = numericCode(), policy = launchPolicy();
  resendClient();
  if (!await requestBudget(email, purpose, requestHeaders) || !await deliverable(email)) return { token, message: generic, seconds: policy.resendSeconds };
  if (purpose === "signup") {
    const users = await accountSql`SELECT id FROM "user" WHERE lower(email)=${email}`;
    if (users[0]) return { token, message: generic, seconds: policy.resendSeconds };
  }
  const recipient = protectedKey(email), digest = protectedKey(`${id}:1:${email}:${purpose}:${code}`), expires = new Date(Date.now() + policy.otpMinutes * 60000).toISOString();
  const maximum = purpose === "signup" ? policy.signupSends : policy.emailChangeSendsPerDay;
  // Reservation, recipient ownership and durable email acceptance are one database statement.
  const globalLimit=purpose === "signup" ? Math.max(1,policy.emailsPerDay-policy.criticalEmailReserve) : policy.emailsPerDay;
  const rows = await accountSql`WITH capacity AS (
   INSERT INTO b1_email_ledgers(recipient_key,purpose,sends,first_at,last_at,active_attempt) VALUES (${recipient},${purpose},1,now(),now(),${id})
   ON CONFLICT(recipient_key,purpose) DO UPDATE SET sends=CASE WHEN b1_email_ledgers.first_at<now()-interval '24 hours' AND (b1_email_ledgers.blocked_until IS NULL OR b1_email_ledgers.blocked_until<=now()) THEN 1 ELSE b1_email_ledgers.sends+1 END,
    first_at=CASE WHEN b1_email_ledgers.first_at<now()-interval '24 hours' THEN now() ELSE b1_email_ledgers.first_at END,last_at=now(),active_attempt=${id},
    blocked_until=CASE WHEN b1_email_ledgers.sends+1>=${maximum} AND b1_email_ledgers.first_at>=now()-interval '24 hours' THEN now()+interval '24 hours' ELSE NULL END
   WHERE (b1_email_ledgers.last_at IS NULL OR b1_email_ledgers.last_at<now()-${policy.resendSeconds}*interval '1 second')
    AND (b1_email_ledgers.blocked_until IS NULL OR b1_email_ledgers.blocked_until<=now())
    AND (b1_email_ledgers.sends<${maximum} OR b1_email_ledgers.first_at<now()-interval '24 hours')
    AND NOT EXISTS (SELECT 1 FROM b1_email_attempts a WHERE a.id=b1_email_ledgers.active_attempt AND a.expires_at>now() AND a.consumed_at IS NULL)
   RETURNING recipient_key
  ), attempt AS (
   INSERT INTO b1_email_attempts(id,token_hash,email,purpose,owner_id,old_email,code_digest,expires_at,user_id)
   SELECT ${id},${protectedKey(token)},${email},${purpose},${owner?.id ?? null},${owner?.email ?? null},${digest},${expires},${crypto.randomUUID()} FROM capacity RETURNING id
  ), outbox AS (INSERT INTO b1_email_outbox(id,recipient_key,scope,kind,payload,expires_at)
   SELECT ${`code/${id}/1`},${recipient},${process.env.EMAIL_SUPPRESSION_SCOPE || "b1-way-team"},${`code:${id}:1`},${seal(verificationMail(email, code))},${expires} FROM attempt RETURNING id), global_capacity AS (
   INSERT INTO b1_rate_buckets(key,count,started_at,expires_at) SELECT 'email-global',1,now(),now()+interval '24 hours' FROM outbox
   ON CONFLICT(key) DO UPDATE SET count=CASE WHEN b1_rate_buckets.expires_at<=now() THEN 1 ELSE b1_rate_buckets.count+1 END,
   started_at=CASE WHEN b1_rate_buckets.expires_at<=now() THEN now() ELSE b1_rate_buckets.started_at END,
   expires_at=CASE WHEN b1_rate_buckets.expires_at<=now() THEN now()+interval '24 hours' ELSE b1_rate_buckets.expires_at END
   WHERE b1_rate_buckets.expires_at<=now() OR b1_rate_buckets.count<${globalLimit} RETURNING key
  ) SELECT id,1/(CASE WHEN EXISTS(SELECT 1 FROM global_capacity) THEN 1 ELSE 0 END) AS accepted FROM outbox`.catch((error:unknown)=>{if(error&&typeof error==="object"&&"code"in error&&error.code==="22012")return [];throw error;});
  return { token, message: generic, seconds: policy.resendSeconds, accepted: !!rows[0] };
}
export async function challengeState(token: string) {
  const rows = await accountSql`SELECT a.id,a.email,a.purpose,a.owner_id,a.old_email,a.user_id,a.version,a.code_digest,a.verified_at,a.expires_at,a.consumed_at,
   GREATEST(0,ceil(extract(epoch from l.last_at+interval '60 seconds'-now()))) AS wait_seconds,
   l.blocked_until,l.sends FROM b1_email_attempts a LEFT JOIN b1_email_ledgers l ON l.active_attempt=a.id AND l.purpose=a.purpose WHERE a.token_hash=${protectedKey(token)}`;
  return rows[0] ?? null;
}
export async function resendChallenge(token: string) {
  const state = await challengeState(token), policy = launchPolicy();
  if (!state || state.consumed_at || state.verified_at) return { message: generic, seconds: 60 };
  if (!await deliverable(state.email)) return { message: generic, seconds: 60 };
  if(Number(state.wait_seconds)>0||state.blocked_until&&Date.parse(state.blocked_until)>Date.now())return {message:generic,seconds:Number(state.wait_seconds),blockedUntil:state.blocked_until};
  const globalLimit=state.purpose === "signup" ? Math.max(1,policy.emailsPerDay-policy.criticalEmailReserve) : policy.emailsPerDay;
  const code = numericCode(), version = state.version + 1, expires = new Date(Date.now() + policy.otpMinutes * 60000).toISOString(), recipient = protectedKey(state.email);
  const rows = await accountSql`WITH capacity AS (
   UPDATE b1_email_ledgers SET sends=sends+1,last_at=now(),blocked_until=CASE WHEN purpose='signup' AND sends+1>=${policy.signupSends} THEN now()+interval '24 hours' ELSE blocked_until END
   WHERE active_attempt=${state.id} AND recipient_key=${recipient} AND purpose=${state.purpose}
    AND sends<${state.purpose === "signup" ? policy.signupSends : policy.emailChangeSendsPerDay} AND (last_at IS NULL OR last_at<now()-${policy.resendSeconds}*interval '1 second')
    AND (blocked_until IS NULL OR blocked_until<=now()) AND EXISTS(SELECT 1 FROM b1_email_attempts a WHERE a.id=${state.id} AND a.version=${state.version} AND a.verified_at IS NULL AND a.consumed_at IS NULL FOR UPDATE) AND sends=${state.sends} RETURNING recipient_key
  ), rotated AS (
   UPDATE b1_email_attempts SET code_digest=${protectedKey(`${state.id}:${version}:${state.email}:${state.purpose}:${code}`)},version=${version},wrong_attempts=0,expires_at=${expires}
   WHERE id=${state.id} AND version=${state.version} AND verified_at IS NULL AND consumed_at IS NULL AND EXISTS(SELECT 1 FROM capacity) RETURNING id
  ), outbox AS (INSERT INTO b1_email_outbox(id,recipient_key,scope,kind,payload,expires_at)
   SELECT ${`code/${state.id}/${version}`},${recipient},${process.env.EMAIL_SUPPRESSION_SCOPE || "b1-way-team"},${`code:${state.id}:${version}`},${seal(verificationMail(state.email, code))},${expires} FROM rotated RETURNING id), global_capacity AS (
   INSERT INTO b1_rate_buckets(key,count,started_at,expires_at) SELECT 'email-global',1,now(),now()+interval '24 hours' FROM outbox
   ON CONFLICT(key) DO UPDATE SET count=CASE WHEN b1_rate_buckets.expires_at<=now() THEN 1 ELSE b1_rate_buckets.count+1 END,
   started_at=CASE WHEN b1_rate_buckets.expires_at<=now() THEN now() ELSE b1_rate_buckets.started_at END,
   expires_at=CASE WHEN b1_rate_buckets.expires_at<=now() THEN now()+interval '24 hours' ELSE b1_rate_buckets.expires_at END
   WHERE b1_rate_buckets.expires_at<=now() OR b1_rate_buckets.count<${globalLimit} RETURNING key
  ) SELECT id,1/(CASE WHEN EXISTS(SELECT 1 FROM global_capacity) THEN 1 ELSE 0 END) AS accepted FROM outbox`.catch((error:unknown)=>{if(error&&typeof error==="object"&&"code"in error&&error.code==="22012")return [];throw error;});
  return { message: rows[0] ? "Use the latest message. A new code was queued." : generic, seconds: Number((await challengeState(token))?.wait_seconds ?? 60), blockedUntil: (await challengeState(token))?.blocked_until ?? null };
}
export async function verifyChallenge(token: string, code: string) {
  if (!/^\d{6}$/.test(code)) throw new PublicError("Enter the six-digit code, including leading zeros");
  const state = await challengeState(token);
  if (state?.verified_at && !state.consumed_at && Date.parse(state.expires_at)>Date.now() && protectedKey(`${state.id}:${state.version}:${state.email}:${state.purpose}:${code}`)===state.code_digest) return true;
  if (!state || !await takeQuota(`guess:${state.purpose}:${protectedKey(state.email)}`, launchPolicy().attemptsPerDay, 86400)) throw new PublicError("Code could not be verified. Request a new code when available, or contact support.");
  const digest = protectedKey(`${state.id}:${state.version}:${state.email}:${state.purpose}:${code}`);
  const rows = await accountSql`UPDATE b1_email_attempts SET verified_at=CASE WHEN code_digest=${digest} THEN now() ELSE verified_at END,
   wrong_attempts=wrong_attempts+CASE WHEN code_digest=${digest} THEN 0 ELSE 1 END
   WHERE id=${state.id} AND token_hash=${protectedKey(token)} AND version=${state.version} AND expires_at>now()
    AND wrong_attempts<${launchPolicy().attemptsPerCode} AND consumed_at IS NULL AND verified_at IS NULL RETURNING verified_at`;
  if (!rows[0]?.verified_at) throw new PublicError("Code is incorrect, expired, or no longer available. Use the latest message.");
  return true;
}
export async function consumeChallenge(token: string, purpose: ChallengePurpose, owner?: string) {
  const rows = await accountSql`UPDATE b1_email_attempts SET consumed_at=now() WHERE token_hash=${protectedKey(token)} AND purpose=${purpose}
   AND verified_at IS NOT NULL AND expires_at>now() AND consumed_at IS NULL AND (owner_id IS NULL OR owner_id=${owner ?? null}) RETURNING *`;
  if (!rows[0]) throw new PublicError("Verify this email again before completing the request");
  return rows[0];
}
