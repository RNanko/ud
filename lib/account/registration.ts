import "server-only";
import { qaMailEnabled } from './email/qa-configuration';
// Configuration readiness is separate from document publication and purchase readiness.
// This function reports field names only to private tools; customers receive a boolean.
export function registrationConfigurationIssues(env: Record<string, string | undefined> = process.env) {
  let isolatedMail = false;
  try { isolatedMail = qaMailEnabled(env); } catch { return ['ISOLATED_MAIL_CONFIGURATION']; }
  const required = ["DATABASE_URL", "BETTER_AUTH_SECRET", "EMAIL_PROTECTION_SECRET", ...(!isolatedMail ? ["RESEND_API_KEY"] : [])];
  return required.filter(name => !env[name]?.trim() || (["BETTER_AUTH_SECRET", "EMAIL_PROTECTION_SECRET"].includes(name) && env[name]!.length < 32));
}
