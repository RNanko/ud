export const PERSONAL_PRODUCT = "b1-way-personal";
export const INVESTMENT_CURRENCY = "USD";
export const financeCurrencies = ["PLN", "EUR", "USD"] as const;
export const billingCurrencies = ["PLN", "GBP", "USD", "EUR"] as const;
export const annualPrices = { PLN: 4000, GBP: 1000, EUR: 1000, USD: 1000 } as const;
export type BillingCurrency = keyof typeof annualPrices;
const integer = (name: string, fallback: number, min = 1, max = 100000) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name} configuration`);
  return value;
};
export function launchPolicy() {
  const trialDays = integer("TRIAL_DAYS", 14);
  if (![7, 14].includes(trialDays)) throw new Error("TRIAL_DAYS must be 7 or 14");
  return {
    trialDays, graceDays: integer("BILLING_GRACE_DAYS", 3, 0, 7), completionHours: 24,
    otpDigits: 6, otpMinutes: 10, resendSeconds: 60, signupSends: 2, sendBlockHours: 24,
    attemptsPerCode: 5, attemptsPerDay: 10,
    sourceRequestsPerHour: integer("SIGNUP_SOURCE_REQUESTS_PER_HOUR", 20),
    recipientsPerSourcePerDay: integer("SIGNUP_RECIPIENTS_PER_SOURCE_PER_DAY", 10),
    emailsPerDay: integer("EMAIL_GLOBAL_DAILY_BUDGET", 200),
    criticalEmailReserve: 20,
    recoverySendsPerDay: integer("RECOVERY_EMAILS_PER_DAY", 3),
    emailChangeSendsPerDay: integer("EMAIL_CHANGE_EMAILS_PER_DAY", 3),
    enforceMembership: process.env.B1_WAY_ENFORCE_MEMBERSHIP === "true",
    legacyAccessUntil: process.env.B1_WAY_LEGACY_ACCESS_UNTIL ?? null,
    legacyCreatedBefore: process.env.B1_WAY_LEGACY_CREATED_BEFORE ?? null,
    liveCheckoutReady: process.env.STRIPE_LIVE_LAUNCH_CONFIRMED === "true",
  };
}
export function appOrigin() {
  const origin = process.env.APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const url = new URL(origin);
  if (url.pathname !== "/" || url.search || url.hash || !["http:", "https:"].includes(url.protocol)) throw new Error("APP_URL must be a trusted origin");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("APP_URL requires HTTPS");
  return url.origin;
}
