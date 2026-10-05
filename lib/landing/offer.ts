import { annualPrices, billingCurrencies, APP_START_PATH, type BillingCurrency } from "../account/config";
export const launchMarkets = { PL: "PLN", GB: "GBP", US: "USD" } as const;
export function validBillingCurrency(value: unknown): BillingCurrency | null {
  return typeof value === "string" && billingCurrencies.includes(value as BillingCurrency) ? value as BillingCurrency : null;
}
export function countryCurrency(country: unknown, trusted: boolean): BillingCurrency {
  if (!trusted || typeof country !== "string" || !/^[A-Z]{2}$/.test(country)) return "EUR";
  return launchMarkets[country as keyof typeof launchMarkets] ?? "EUR";
}
export function resolveBillingCurrency(input: { paid?: unknown; country?: unknown; trusted?: boolean }) {
  return validBillingCurrency(input.paid) ?? countryCurrency(input.country, input.trusted === true);
}
function priceAmount(currency: BillingCurrency, amount: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2, currencyDisplay: "symbol" }).format(amount);
}
export function annualAmount(currency: BillingCurrency) {
  return priceAmount(currency, annualPrices[currency] / 100);
}
/** Display comparison only. Checkout continues to charge the full annual price. */
export function monthlyEquivalent(currency: BillingCurrency) {
  return priceAmount(currency, annualPrices[currency] / 1200);
}
export type LandingAction = "signup" | "verify" | "trial" | "open" | "membership";
export function accountAction(state: string, verified: boolean): LandingAction {
  if (!verified) return "verify";
  if (state === "eligible") return "trial";
  if (["trial", "paid", "paid-renewal-off", "renewal-grace", "launch-transition", "migration-window"].includes(state)) return "open";
  return "membership";
}
export const actionDestinations: Record<LandingAction, string> = {
  signup: "/auth/registration?intent=trial", verify: "/account?section=account",
  trial: "/account?section=membership", open: APP_START_PATH, membership: "/account?section=membership",
};
