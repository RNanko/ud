/** NONE is an explicit numbers-only choice, distinct from legacy missing currencies. */
export const financeCurrencies = ["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "JPY", "CNY", "HKD", "SGD", "INR", "PLN", "AED", "NONE"] as const;
export type FinanceCurrency = typeof financeCurrencies[number];
const names: Record<FinanceCurrency, string> = {
  USD: "US dollar", EUR: "Euro", GBP: "British pound", CAD: "Canadian dollar",
  AUD: "Australian dollar", CHF: "Swiss franc", JPY: "Japanese yen", CNY: "Chinese yuan",
  HKD: "Hong Kong dollar", SGD: "Singapore dollar", INR: "Indian rupee", PLN: "Polish złoty",
  AED: "UAE dirham", NONE: "Custom · numbers only",
};
export function financeCurrencyLabel(currency: string | null | undefined) {
  if (!currency || currency === "unassigned") return "Currency not recorded";
  if (currency === "NONE") return names.NONE;
  return Object.hasOwn(names, currency) ? `${currency} · ${names[currency as FinanceCurrency]}` : currency;
}
export const financeCurrencyOptions = financeCurrencies.map(value => ({ value, label: financeCurrencyLabel(value) }));
