import "server-only";
import { accountSql } from "./store";
import { PublicError } from "./errors";
import { launchPolicy, PERSONAL_PRODUCT } from "./config";
import { currentAuthTransaction } from "../db/auth-drizzle";
import { sql } from "drizzle-orm";

// Called only during verified signup completion, before creating the session.
// Anchor to identity creation so retries never extend or restart a trial.
export async function initializeSignupTrial(owner: string) {
  const rows = await accountSql`INSERT INTO b1_memberships(user_id,product,enrolled_at,trial_started_at,trial_ends_at,status)
    SELECT u.id,${PERSONAL_PRODUCT},u.created_at,u.created_at,u.created_at+${launchPolicy().trialDays}*interval '1 day','trial'
    FROM "user" u WHERE u.id=${owner} AND u.email_verified=true
      AND EXISTS(SELECT 1 FROM account a WHERE a.user_id=u.id AND a.provider_id='credential' AND a.password IS NOT NULL)
      AND NOT EXISTS(SELECT 1 FROM b1_deletions d WHERE d.user_id=u.id AND d.product=${PERSONAL_PRODUCT})
    ON CONFLICT(user_id,product) DO UPDATE SET
      enrolled_at=COALESCE(b1_memberships.enrolled_at,EXCLUDED.enrolled_at),
      trial_started_at=EXCLUDED.trial_started_at,trial_ends_at=EXCLUDED.trial_ends_at,status='trial'
    WHERE b1_memberships.trial_started_at IS NULL AND b1_memberships.paid_confirmed=false
    RETURNING trial_ends_at`;
  if (rows[0]) return;
  const existing = await accountSql`SELECT 1 FROM b1_memberships m JOIN "user" u ON u.id=m.user_id
    WHERE m.user_id=${owner} AND m.product=${PERSONAL_PRODUCT} AND u.email_verified=true
      AND EXISTS(SELECT 1 FROM account a WHERE a.user_id=u.id AND a.provider_id='credential' AND a.password IS NOT NULL)
      AND (m.trial_started_at IS NOT NULL OR m.paid_confirmed=true)
      AND NOT EXISTS(SELECT 1 FROM b1_deletions d WHERE d.user_id=u.id AND d.product=${PERSONAL_PRODUCT})`;
  if (!existing[0]) throw new PublicError("Your account could not be finalized. Please confirm the code again.");
}

export async function assertVerifiedSignupProof(owner: string, email: string) {
  const transaction=currentAuthTransaction();
  const rows = transaction ? (await transaction.execute(sql`SELECT 1 FROM b1_email_attempts WHERE user_id=${owner} AND lower(email)=${email.toLowerCase()}
    AND purpose='signup' AND owner_id IS NULL AND verified_at IS NOT NULL AND consumed_at IS NOT NULL AND expires_at>clock_timestamp()`)).rows : await accountSql`SELECT 1 FROM b1_email_attempts WHERE user_id=${owner} AND lower(email)=${email.toLowerCase()}
    AND purpose='signup' AND owner_id IS NULL AND verified_at IS NOT NULL AND consumed_at IS NOT NULL AND expires_at>now()`;
  if (!rows[0]) throw new PublicError("Verify your email before creating an account");
}
export async function signupFinalized(owner: string,email?:string) {
  const transaction=currentAuthTransaction();
  const rows = transaction ? (await transaction.execute(sql`SELECT 1 FROM "user" u JOIN account a ON a.user_id=u.id
    WHERE u.id=${owner} AND (${email??null}::text IS NULL OR lower(u.email)=${email?.toLowerCase()??null})
      AND u.email_verified=true AND a.provider_id='credential' AND a.password IS NOT NULL`)).rows : await accountSql`SELECT 1 FROM "user" u JOIN account a ON a.user_id=u.id
    WHERE u.id=${owner} AND (${email??null}::text IS NULL OR lower(u.email)=${email?.toLowerCase()??null})
      AND u.email_verified=true AND a.provider_id='credential' AND a.password IS NOT NULL`;
  return !!rows[0];
}
