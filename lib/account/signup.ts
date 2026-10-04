import "server-only";
import { accountSql } from "./store";
import { PublicError } from "./errors";

export async function assertVerifiedSignupProof(owner: string, email: string) {
  const rows = await accountSql`SELECT 1 FROM b1_email_attempts WHERE user_id=${owner} AND lower(email)=${email.toLowerCase()}
    AND purpose='signup' AND owner_id IS NULL AND verified_at IS NOT NULL AND consumed_at IS NOT NULL AND expires_at>now()`;
  if (!rows[0]) throw new PublicError("Verify your email before creating an account");
}
export async function signupFinalized(owner: string) {
  const rows = await accountSql`SELECT 1 FROM "user" u JOIN account a ON a.user_id=u.id
    WHERE u.id=${owner} AND u.email_verified=true AND a.provider_id='credential' AND a.password IS NOT NULL`;
  return !!rows[0];
}
