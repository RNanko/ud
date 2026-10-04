import { annualPrices, launchPolicy } from "../account/config";
import { operatorConfiguration } from "./operator";
import { contentHash } from "./validation";
import type { LegalDocument, LegalKind } from "./types";

// Public website copy. Only the named operator fields can enter these documents.
// This is independent of account records, the retired publication registry and billing approval.
export function publicDocuments(env: Record<string, string | undefined>): Record<LegalKind, LegalDocument> | null {
  const config = operatorConfiguration(env);
  if (Object.values(config.facts).some(fact => fact.status !== "provided")) return null;
  const operator = {
    name: config.facts.name.value, form: config.facts.form.value,
    country: config.facts.country.value, address: config.facts.address.value,
    contact: config.facts.contact.value,
    registration: config.registration === "provided" ? env.LEGAL_OPERATOR_REGISTRATION!.trim() : "",
    tax: config.tax === "provided" ? env.LEGAL_OPERATOR_TAX!.trim() : "",
  };
  const identity = `${operator.name}, ${operator.form}, ${operator.address}, ${operator.country}.`;
  const optional = [operator.registration && `Registration: ${operator.registration}.`, operator.tax && `Tax/VAT: ${operator.tax}.`].filter(Boolean).join(" ");
  const base = (kind: LegalKind, title: string, introduction: string): LegalDocument => ({
    id: "", product: "b1-way-personal", locale: "en", kind, version: "2026-10-04",
    title, introduction, effectiveDate: "2026-10-04", updatedAt: "2026-10-04", operator, sections: [],
  });
  const terms = base("terms", "Terms & Conditions — ManForth by B1-Way", "These terms explain ManForth on the web and in the mobile app, your shared account and membership. Please read them together with the Privacy Policy. Your mandatory consumer rights remain unaffected.");
  terms.offer = { annualPrices: { ...annualPrices }, trialDays: launchPolicy().trialDays, currencyPolicy: "Poland: PLN; United Kingdom: GBP; United States: USD; other or unknown regions: EUR. Existing subscriptions retain their recorded currency." };
  terms.sections = [
    { id: "operator", title: "1. Operator and contact", paragraphs: [
      `ManForth is a B1-Way product operated by ${identity}${optional ? ` ${optional}` : ""} Contact: ${operator.contact}.`,
      "These terms cover ManForth. The separate B1-Way language-learning product has its own plans and policies; a ManForth membership does not include that subscription.",
    ] },
    { id: "account", title: "2. Your account", paragraphs: [
      "To create an account, enter your email, password and date of birth, verify your email, and agree to these Terms while acknowledging the Privacy Policy. You can change your display name in Account & Settings. This agreement does not authorize payment or enroll you in marketing.",
      "Keep your credentials secure and your account information accurate. Contact the operator if you suspect unauthorized access. Security, support, billing management, export and deletion controls remain separate from your membership access.",
    ] },
    { id: "service", title: "3. The service and your records", paragraphs: [
      "ManForth provides expense and revenue tracking, manually entered investment positions, tasks, weekly events, workout plans and actual training logs, and Momentum goals, focus records and reviews. Planned targets are separate from confirmed results.",
      "Account synchronization requires an internet connection and a supported browser or mobile app. Device-local display settings can differ between devices. A failed save is not a confirmed server save; uninterrupted availability and complete offline synchronization are not guaranteed.",
      "You retain rights in your content. You grant the permission necessary to store, process, display and export it to provide the service to you. This does not authorize selling or publishing your private records, or using them to train AI.",
    ] },
    { id: "use", title: "4. Responsible use", paragraphs: [
      "Do not access another person's account, interfere with service security, upload unlawful content or bypass ownership checks and reasonable rate limits. Protective measures taken in response to misuse do not remove statutory rights or available consumer remedies.",
    ] },
    { id: "guidance", title: "5. Training, money and progress", paragraphs: [
      "Workout presets and exercise information help with planning and logging. Ask a qualified trainer to check suitability and technique. For injuries or health conditions, obtain advice from an appropriate healthcare professional. ManForth does not diagnose conditions, guarantee physical changes or automatically prescribe heavier weights.",
      "Finance and Investments organize your recorded information and available market quotes. They are not banking, brokerage or personalized investment, tax or legal advice. ManForth does not move money or buy assets for you. Quotes can be delayed or unavailable, and returns are not guaranteed.",
      "Investments use USD. Finance entries retain their recorded currencies. Goals and progress summaries reflect your inputs and chosen rules; they do not independently verify an achievement. These limitations do not exclude liability or remedies that applicable law requires.",
    ] },
    { id: "membership", title: "6. Trial and annual membership", paragraphs: [
      `The no-card trial lasts ${terms.offer.trialDays} days and starts only when an eligible verified user chooses to start it in Account & Settings. Registration does not start a trial or authorize payment. One product trial is available per account.`,
      `Annual membership prices are ${annualPrices.PLN / 100} PLN, ${annualPrices.GBP / 100} GBP, ${annualPrices.USD / 100} USD or ${annualPrices.EUR / 100} EUR. These are fixed regional offers, not exchange-rate conversions. The selected price, currency and payment terms are shown before purchase.`,
      "An annual purchase charges the full amount at purchase and begins paid access after payment confirmation. Annual membership renews unless renewal is canceled. Payment processing is provided by Stripe; visiting a payment success page alone does not confirm a payment.",
      "Cancel renewal in Account & Settings → Membership & billing → Manage payments, receipts & cancellation. Cancellation preserves confirmed paid access until its end date. After expiry, saved records remain readable and security, billing, support, export and deletion controls remain available. Cancellation, withdrawal, remedies and account deletion are different actions.",
    ] },
    { id: "rights", title: "7. Consumer rights and withdrawal", paragraphs: [
      "The product trial does not replace statutory withdrawal rights. Registration does not waive those rights or authorize immediate paid performance. Any separately required choice about early performance belongs to the relevant purchase, rather than the registration checkbox.",
      `Where applicable law provides a right of withdrawal or another remedy, you can contact ${operator.contact} or write to the operator at the address above. Identify the service and transaction concerned so the request can be handled. Mandatory rights under applicable consumer law remain unaffected; no blanket “all sales final” rule applies.`,
    ] },
    { id: "support", title: "8. Support and complaints", paragraphs: [
      `Contact ${operator.contact} about the service, billing, complaints or privacy requests. You do not need an active membership to contact the operator. A mailto link opens your email application; you must send the message there.`,
    ] },
    { id: "changes", title: "9. Changes and account closure", paragraphs: [
      "Material changes to the service, contract or price must respect applicable notice requirements and consumer rights. A return visit does not itself constitute acceptance of changed terms, and reading an internal notification does not authorize a purchase or new data use.",
      "Account deletion requires reauthentication and resolution of pending billing operations. Deleting an account does not automatically create a refund. Data handling is explained in the Privacy Policy.",
    ] },
  ];
  const privacy = base("privacy", "Privacy Policy — ManForth by B1-Way", "This policy explains the personal information used to provide ManForth, the service's current features, and your privacy choices and rights.");
  privacy.sections = [
    { id: "controller", title: "1. Controller and contact", paragraphs: [
      `The controller for ManForth is ${identity}${optional ? ` ${optional}` : ""} Privacy contact: ${operator.contact}.`,
      "This policy covers ManForth on the web and in the mobile app, using one shared account. The separate B1-Way language-learning product has its own privacy information.",
    ] },
    { id: "information", title: "2. Information we use", paragraphs: [
      "Account information includes your display name, email, date of birth provided during registration, verification status, protected credentials, sessions and security-related technical records. Plaintext passwords are not stored as profile information.",
      "Optional content comes from what you enter or import: tasks, events, workout templates, planned targets, actual strength and cardio logs, notes, financial entries, investment positions, goals, focus records and reflections. Preferences include your chosen units, timezone and display settings.",
      "Payment identifiers and membership status come from Stripe confirmations and signed payment events. Email delivery information comes from the verification and security email provider. Support messages contain the information you choose to send.",
    ] },
    { id: "purposes", title: "3. Purposes and legal bases", paragraphs: [
      "We use account information and selected module records to provide the service you request. Where this processing is necessary to perform our agreement with you or take requested steps before entering that agreement, the basis is contractual necessity.",
      "Session, verification, rate-limit and related technical information is used to protect accounts and service integrity, relying on legitimate interests in preventing misuse where that basis applies. Billing and support information is used to handle purchases and requests, with applicable legal obligations governing records that must be retained.",
      "An acknowledgment of this Privacy Policy is not marketing consent or consent to every possible data use. Any processing that requires a separate consent must have its own informed choice and withdrawal route.",
    ] },
    { id: "sensitive", title: "4. Training and sensitive content", paragraphs: [
      "Workout notes and reflections can reveal health information depending on what you enter. Diagnoses and medical history are not required to register. Avoid adding unnecessary sensitive details. Financial records are private information; they are not automatically health or other special-category data.",
    ] },
    { id: "providers", title: "5. Service providers", paragraphs: [
      "The service uses Neon/PostgreSQL for application storage, Vercel for hosting, Resend for verification, recovery and security email, and Stripe for payments. Better Auth is the authentication software used within the backend.",
      "Server-side market queries use CoinGecko and Yahoo Finance. These queries use market symbols or coin identifiers, rather than adding your account name or email. Password breach checks send a padded hash prefix to Have I Been Pwned, not your plaintext password.",
      "Provider processing may involve locations outside your country or the European Economic Area. Applicable transfer protections depend on the provider and processing arrangement. Information about those arrangements can be requested from the controller using the contact above.",
    ] },
    { id: "retention", title: "6. Retention and deletion", paragraphs: [
      "Verification codes are valid for 10 minutes. Verification and recovery flows also enforce expiry, send limits and single-use checks. The email worker clears queued message payloads when they reach sent, expired or terminal states.",
      "Your application records stay associated with your account until removed through the relevant feature or account-deletion process. Deletion resolves pending billing operations before removing identity and owned application records. Payment-provider records, security records and backups may follow different applicable retention requirements; deletion is not a promise of immediate erasure from every provider or backup.",
    ] },
    { id: "security", title: "7. Security", paragraphs: [
      "Controls include authenticated ownership checks, protected passwords, server-side validation, rate limits, time-limited single-use email proof, encrypted queued email payloads and signed provider webhooks. Exports exclude credentials, tokens and provider secrets. These safeguards do not guarantee perfect security or imply end-to-end encryption of every record.",
    ] },
    { id: "rights", title: "8. Your rights", paragraphs: [
      `Depending on applicable law and the processing involved, you may request access, correction, erasure, restriction or portability, or object to processing. Where processing relies on consent, you may withdraw it without affecting earlier lawful processing. Contact ${operator.contact} to exercise your rights.`,
      "Account & Settings → Privacy & Legal provides owned data export and password-confirmed deletion. An active paid membership is not required for these controls or for privacy requests. You may complain to a competent data-protection supervisory authority, including the authority in your habitual residence, workplace or the place of an alleged infringement where applicable.",
    ] },
    { id: "storage", title: "9. Cookies and browser storage", paragraphs: [
      "Necessary session and verification cookies support authentication and email proof. Theme preferences and some Finance display ordering use browser storage. These technologies are separate from registration agreement; landing examples use local demonstration state.",
      "The mobile app keeps session credentials in the device's secure storage. Its labelled demonstration workspace uses separate local records. Local input or a demonstration result is not a confirmed save to your shared account; offline recovery and synchronization depend on the feature available in your app version.",
      "Terms and Privacy pages are available without authentication or account data. Regional membership pricing can use coarse hosting country information; it does not request GPS or persist a location for that pricing lookup.",
    ] },
    { id: "notifications", title: "10. Notifications", paragraphs: [
      "Product reminders appear inside ManForth. Authentication, verification, recovery and security emails remain separate from internal reminder preferences. Registration does not enroll you in a marketing campaign or enable browser or native push permissions.",
    ] },
    { id: "calculations", title: "11. Calculations and policy updates", paragraphs: [
      "Goals, focus totals, workout comparisons and regional pricing use recorded inputs and rules. Exercise suggestions are not diagnoses or medical treatment decisions. Material changes to data processing require appropriate privacy information; reading a notification is not consent to a new purpose.",
    ] },
  ];
  for (const document of [terms, privacy]) {
    // Content-derived versions change when the operator or wording changes.
    document.version += `.${contentHash(document).slice(0, 12)}`;
    document.id = `${document.product}:${document.kind}:${document.locale}:${document.version}`;
  }
  return { terms, privacy };
}
