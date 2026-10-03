export type LegalKind = "terms" | "privacy";
export type LegalDocument = {
  id: string; product: "b1-way-personal"; locale: "en"; kind: LegalKind; version: string;
  title: string; introduction: string; effectiveDate: string; updatedAt: string;
  operator: { name: string; form: string; country: string; address: string; registration: string; tax: string; contact: string };
  sections: { id: string; title: string; paragraphs: string[] }[];
  offer?: { annualPrices: Record<string, number>; trialDays: number; currencyPolicy: string };
};
export type LegalReference = { id: string; version: string; hash: string; href: string };
export type LegalBundle = {
  product: "b1-way-personal"; locale: "en"; statementVersion: string; statement: string;
  terms: LegalReference; privacy: LegalReference; purchaseReady: boolean;
};
export type LegalAgreement = { accepted: true; product: string; locale: string; statementVersion: string; termsId: string; privacyId: string };
export const agreementStatement = { version: "registration-1", text: "I agree to the Terms & Conditions and acknowledge the Privacy Policy." } as const;
export function agreementFor(bundle: LegalBundle): LegalAgreement {
  return { accepted: true, product: bundle.product, locale: bundle.locale, statementVersion: bundle.statementVersion, termsId: bundle.terms.id, privacyId: bundle.privacy.id };
}
