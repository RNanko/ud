import "server-only";
import { Resend } from "resend";
import { accountSql } from "../store";
import { launchPolicy } from "../config";
import { protectedKey, seal, unseal } from "./crypto";
import { deliverable } from "./policy";
import type { MailContent } from "./templates";
export function resendClient() {
  if (!process.env.RESEND_API_KEY) throw new Error("Email delivery is unavailable until Resend is configured");
  return new Resend(process.env.RESEND_API_KEY);
}
export async function enqueueMail(id: string, kind: string, mail: MailContent, expires = new Date(Date.now() + 23 * 3600000)) {
  resendClient();
  const existing = await accountSql`SELECT 1 FROM b1_email_outbox WHERE id=${id}`;
  if (existing[0]) return true;
  if (!await deliverable(mail.to)) return false;
  const policy=launchPolicy(),limit=["security","recovery"].includes(kind)?policy.emailsPerDay:Math.max(1,policy.emailsPerDay-policy.criticalEmailReserve);
  // A deduplicated outbox acceptance consumes global capacity only once. Exhaustion
  // rolls back the entire statement, so no accepted mail can sit outside its budget.
  await accountSql`WITH fresh AS (
    INSERT INTO b1_email_outbox(id,recipient_key,scope,kind,payload,expires_at) VALUES (${id},${protectedKey(mail.to.toLowerCase())},${process.env.EMAIL_SUPPRESSION_SCOPE || "b1-way-team"},${kind},${seal(mail)},${expires.toISOString()}) ON CONFLICT(id) DO NOTHING RETURNING id
  ), capacity AS (
    INSERT INTO b1_rate_buckets(key,count,started_at,expires_at) SELECT 'email-global',1,now(),now()+interval '24 hours' FROM fresh
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN b1_rate_buckets.expires_at<=now() THEN 1 ELSE b1_rate_buckets.count+1 END,
      started_at=CASE WHEN b1_rate_buckets.expires_at<=now() THEN now() ELSE b1_rate_buckets.started_at END,
      expires_at=CASE WHEN b1_rate_buckets.expires_at<=now() THEN now()+interval '24 hours' ELSE b1_rate_buckets.expires_at END
    WHERE b1_rate_buckets.expires_at<=now() OR b1_rate_buckets.count<${limit} RETURNING key
  ) SELECT 1/(CASE WHEN EXISTS(SELECT 1 FROM fresh) AND NOT EXISTS(SELECT 1 FROM capacity) THEN 0 ELSE 1 END) AS accepted`;

  return true;
}
export async function processMailQueue(limit = 20) {
  const client = resendClient();
  await accountSql`UPDATE b1_email_outbox SET status=CASE WHEN expires_at<=now() THEN 'expired' ELSE 'failed' END,payload='',lease_until=NULL WHERE status IN ('pending','retry') AND (expires_at<=now() OR attempts>=5) AND (lease_until IS NULL OR lease_until<=now())`;
  const rows = await accountSql`UPDATE b1_email_outbox SET lease_until=now()+interval '5 minutes',attempts=attempts+1
   WHERE id IN (SELECT id FROM b1_email_outbox WHERE status IN ('pending','retry') AND next_at<=now() AND expires_at>now() AND attempts<5 AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_at FOR UPDATE SKIP LOCKED LIMIT ${limit}) RETURNING *`;
  const outcomes: { id: string; state: string }[] = [];
  for (const row of rows) {
    const mail = unseal<MailContent>(row.payload);
    const optional = mail.context;
    const validReminder = !optional || (await (await import('../notifications')).dueNotifications(optional.owner)).some(notice => notice.key === optional.key) && (await (await import('../store')).accountSettings(optional.owner)).notifications.email;
    if (!validReminder || !await deliverable(mail.to)) {
      await accountSql`UPDATE b1_email_outbox SET status='suppressed',payload='',lease_until=NULL WHERE id=${row.id}`;
      outcomes.push({ id: row.id, state: "suppressed" }); continue;
    }
    try {
      const result = await client.emails.send({ to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, from: process.env.RESEND_FROM_EMAIL || "B1-Way <support@b1-way.pl>", replyTo: process.env.RESEND_REPLY_TO_EMAIL || "support@b1-way.pl" }, { idempotencyKey: row.id });
      if (result.error) {
        const rejected = ["validation_error", "invalid_access", "missing_api_key", "invalid_api_key"].includes(result.error.name);
        await accountSql`UPDATE b1_email_outbox SET status=${rejected ? "rejected" : "retry"},outcome=${rejected ? "known-rejected" : "provider-transient"},lease_until=NULL,next_at=now()+${Math.min(3600, 60 * 2 ** row.attempts)}*interval '1 second' WHERE id=${row.id}`;
        if (rejected && row.kind.startsWith("code:")) {
          const [, attempt, version] = row.kind.split(":");
          await accountSql`UPDATE b1_email_ledgers l SET sends=GREATEST(0,sends-1),blocked_until=NULL,last_at=NULL FROM b1_email_attempts a WHERE a.id=${attempt} AND a.version=${Number(version)} AND l.active_attempt=a.id AND l.purpose=a.purpose AND l.recipient_key=${row.recipient_key}`;
        }
        outcomes.push({ id: row.id, state: rejected ? "rejected" : "retry" }); continue;
      }
      await accountSql`UPDATE b1_email_outbox SET status='sent',provider_id=${result.data!.id},payload='',lease_until=NULL,outcome='accepted' WHERE id=${row.id}`;
      outcomes.push({ id: row.id, state: "sent" });
    } catch {
      // Ambiguous outcome retains the SAME encrypted content, code and idempotency key.
      await accountSql`UPDATE b1_email_outbox SET status='retry',outcome='ambiguous',lease_until=NULL,next_at=now()+interval '2 minutes' WHERE id=${row.id}`;
      outcomes.push({ id: row.id, state: "retry" });
    }
  }
  return outcomes;
}
