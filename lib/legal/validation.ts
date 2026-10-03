import z from "zod";
import { createHash } from "node:crypto";
import type { LegalBundle, LegalDocument } from "./types";

export const legalAgreementSchema = z.object({ accepted: z.literal(true), product: z.literal("b1-way-personal"), locale: z.literal("en"), statementVersion: z.string().max(80), termsId: z.string().max(160), privacyId: z.string().max(160) }).strict();
const text = z.string().trim().min(1).max(20000);
export const documentSchema = z.object({
  id: text, product: z.literal("b1-way-personal"), locale: z.literal("en"), kind: z.enum(["terms", "privacy"]), version: z.string().regex(/^[a-zA-Z0-9.-]{1,60}$/), title: text, introduction: text,
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  operator: z.object({ name: text, form: text, country: text, address: text, registration: text, tax: text, contact: z.string().email() }).strict(),
  sections: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), title: text, paragraphs: z.array(text).min(1) }).strict()).min(8),
  offer: z.object({ annualPrices: z.record(z.string(), z.number().int().positive()), trialDays: z.number().int().positive(), currencyPolicy: text }).strict().optional(),
}).strict();
export function canonicalContent(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalContent).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalContent((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function contentHash(document: LegalDocument) { return createHash("sha256").update(canonicalContent(document)).digest("hex"); }
export function validateAgreement(input: unknown, bundle: LegalBundle | null) {
  if (!bundle) throw Error("Registration is unavailable until reviewed Terms and Privacy Policy are published. Existing account support and security remain available.");
  const result = legalAgreementSchema.safeParse(input);
  if (!result.success) throw Error("Please accept the Terms & Conditions to create your account.");
  const value = result.data;
  if (value.termsId !== bundle.terms.id || value.privacyId !== bundle.privacy.id || value.statementVersion !== bundle.statementVersion) throw Error("LEGAL_VERSIONS_CHANGED: Please review the updated documents and agree again. Your email proof is preserved while valid.");
  return value;
}
export const reviewKeys = ["operator", "lawfulBases", "healthData", "processorsTransfers", "retention", "cookies", "marketsConsumerRights", "withdrawalFunction", "durableConfirmation", "existingUsers"] as const;
export const reviewSchema = z.object({ decision: z.literal("approved"), reviewer: text, reviewedAt: z.string().datetime(), changeSummary: text, reacceptance: z.enum(["none", "notified-contractual-review"]), purchaseReady: z.boolean(), checks: z.object(Object.fromEntries(reviewKeys.map(key => [key, z.literal(true)]))).strict() }).strict();
export function assertPublishable(document: LegalDocument) {
  documentSchema.parse(document);
  if (/\[REVIEW REQUIRED|\[UNCONFIRMED|\[DRAFT|TODO|TBC/i.test(JSON.stringify(document))) throw Error("Resolve all draft placeholders before approval/publication");
  if (new Set(document.sections.map(section => section.id)).size !== document.sections.length) throw Error("Section anchors must be unique");
  if (document.id !== `${document.product}:${document.kind}:${document.locale}:${document.version}`) throw Error("Document ID does not match its scope/version");
  for(const date of [document.effectiveDate,document.updatedAt]) if (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) throw Error("Invalid legal date");
}
