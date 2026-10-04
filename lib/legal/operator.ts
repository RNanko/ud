// Pure validation shared by the server repository and the private operator CLI.
// Environment values are never returned by the public capability endpoint.
export type DisclosureState = "provided" | "not-applicable" | "unresolved";
export type FactStatus = "provided" | "missing" | "placeholder" | "trailing-backslash" | "invalid";
const placeholder = /\[(?:REVIEW REQUIRED|UNCONFIRMED|DRAFT)|\b(?:TODO|TBC|TBD)\b|^YOUR(?:\b|_)|^CHANGE[ _-]?ME$|^EXAMPLE\b|^(?:UNKNOWN|UNRESOLVED|REPLACE|ENTER)\b/i;
export function factStatus(value: unknown): FactStatus {
  if (typeof value !== "string" || !value.trim()) return "missing";
  if (/\\\s*$/.test(value)) return "trailing-backslash";
  if (placeholder.test(value.trim())) return "placeholder";
  return "provided";
}
export function disclosureState(value: string, recorded?: string): DisclosureState {
  const decision = recorded?.trim();
  const explicitNone = /^(?:not applicable|n\/?a)(?:\s*[-—:]\s*confirmed)?\.?$/i.test(value.trim());
  if (decision === "not-applicable") return !value.trim() || explicitNone ? "not-applicable" : "unresolved";
  if (decision && decision !== "provided") return "unresolved";
  if (explicitNone) return decision === "provided" ? "unresolved" : "not-applicable";
  return factStatus(value) === "provided" && !/^(?:unknown|unresolved|none)$/i.test(value.trim()) ? "provided" : "unresolved";
}
export function parseExplicitBoolean(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}
export function operatorConfiguration(env: Record<string, string | undefined>) {
  const names = { name: "LEGAL_OPERATOR_NAME", form: "LEGAL_OPERATOR_FORM", country: "LEGAL_OPERATOR_COUNTRY", address: "LEGAL_OPERATOR_ADDRESS", contact: "LEGAL_CONTACT_EMAIL" } as const;
  const facts = Object.fromEntries(Object.entries(names).map(([key, variable]) => {
    const value = env[variable]?.trim() || "";
    let status = factStatus(value);
    if (key === "contact" && status === "provided" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) status = "invalid";
    return [key, { variable, value, status }];
  })) as Record<keyof typeof names, { variable: string; value: string; status: FactStatus }>;
  const registration = disclosureState(env.LEGAL_OPERATOR_REGISTRATION || "", env.LEGAL_OPERATOR_REGISTRATION_STATUS);
  const tax = disclosureState(env.LEGAL_OPERATOR_TAX || "", env.LEGAL_OPERATOR_TAX_STATUS);
  return { facts, registration, tax, configured: Object.values(facts).every(f => f.status === "provided") && registration !== "unresolved" && tax !== "unresolved" };
}
