import "server-only";
// Configuration readiness is separate from document publication and purchase readiness.
// This function reports field names only to private tools; customers receive a boolean.
export function registrationConfigurationIssues(env: Record<string, string | undefined> = process.env) {
  const required = ["DATABASE_URL", "BETTER_AUTH_SECRET", "RESEND_API_KEY", "EMAIL_PROTECTION_SECRET"];
  return required.filter(name => !env[name]?.trim() || (["BETTER_AUTH_SECRET", "EMAIL_PROTECTION_SECRET"].includes(name) && env[name]!.length < 32));
}
