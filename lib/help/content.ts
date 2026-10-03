import { brand } from "../brand";
import type { BillingCurrency } from "../account/config";
import { annualAmount } from "../landing/offer";

export const helpCategories = [
  { id: "getting-started", label: "Getting started" },
  { id: "membership", label: "Account & Membership" },
  { id: "money", label: "Money & units" },
  { id: "gym", label: "Gym" },
  { id: "momentum", label: "Momentum" },
  { id: "privacy", label: "Support & Privacy" },
] as const;
export type HelpCategory = (typeof helpCategories)[number]["id"];
export type HelpArticle = {
  id: string;
  question: string;
  answer: string;
  category: HelpCategory;
  aliases: readonly string[];
  relatedIds: readonly string[];
  platform: "web";
  publication: "published";
  version: number;
  verifiedOn: string;
};

/** The landing is a selection from this same public answer library. */
export const landingQuestionIds = ["about-manforth", "no-card-trial", "annual-membership"] as const;

export function helpArticles(trialDays: number, currency: BillingCurrency = "EUR"): HelpArticle[] {
  const article = (id: string, category: HelpCategory, question: string, answer: string, aliases: string[], relatedIds: string[]): HelpArticle => ({
    id, category, question, answer, aliases, relatedIds,
    platform: "web", publication: "published", version: 1, verifiedOn: "2026-10-03",
  });
  return [
    article("about-manforth", "getting-started", "What is ManForth?", "ManForth is B1-Way's personal-development workspace: Finance, Investments, To-Do, Events, Gym and Momentum. It helps you organize the actions and records behind your own goals.", ["start", "features", "planner", "tasks", "events"], ["no-card-trial", "workout-goal"]),
    article("no-card-trial", "membership", "How does the no-card trial work?", `Verify your email and create an account, then explicitly start your one ${trialDays}-day trial in Account & Settings. No card is needed. Opening the landing page or this Q&A does not start the trial. The trial does not automatically charge when it ends.`, ["free", "signup", "register", "verification", "credit card"], ["annual-membership", "after-trial"]),
    article("annual-membership", "membership", "What does membership cost?", `Your annual price is ${annualAmount(currency)} ${currency}, selected automatically for your region. EUR is used when the region is unknown or unsupported. Billed annually, with renewal unless canceled. Account & Settings confirms the full annual amount and currency before Stripe checkout. Existing subscriptions keep their recorded currency. Purchase availability depends on the configured checkout.`, ["price", "payment", "subscription", "cost", "billing", "Stripe"], ["regional-currency", "cancel-renewal"]),
    article("after-trial", "membership", "What happens after the trial?", "Choose annual membership to continue membership-based access. There is no monthly plan. Buying during a trial charges the full annual amount now and starts the paid year; it does not defer payment to trial expiry. Saved records remain readable when membership expires. Help, security, billing, export and account deletion remain available.", ["expired", "expiry", "read only", "access", "monthly"], ["annual-membership", "cancel-renewal", "support-and-data"]),
    article("regional-currency", "membership", "Why is this currency displayed?", "For a new purchase, membership pricing follows your region automatically. The United States uses USD, the United Kingdom uses GBP and supported countries use their local price. Elsewhere, or when your region is unknown, we use EUR. Stripe charges the currency confirmed before payment. Existing subscriptions keep their original currency. Local development uses the EUR fallback.", ["country", "location", "dollar", "euro", "pound", "automatic"], ["annual-membership", "currencies-and-units"]),
    article("cancel-renewal", "membership", "How do I cancel annual renewal?", "Open Account & Settings → Membership & billing and use the billing portal when payment management is available. Cancellation turns renewal off while keeping confirmed paid access through its end date. Published terms explain any applicable withdrawal or refund rights.", ["cancel", "renew", "subscription", "portal", "receipt", "invoice"], ["annual-membership", "after-trial"]),
    article("currencies-and-units", "money", "Can I change currencies and units?", "Finance lets you choose a supported currency for new entries; historical entries keep their recorded currency. Investments use USD. Gym supports kg/lb and km/mi display preferences in Account & Settings. Membership pricing is selected automatically for your region, separately from these display preferences.", ["weight", "distance", "kg", "lb", "km", "mi", "dumbbells", "old records"], ["regional-currency", "money-movement"]),
    article("money-movement", "money", "Does ManForth trade or move my money?", "No. Finance and Investments organize records you enter. They are not a bank or brokerage, and they do not buy assets, transfer funds or guarantee returns.", ["bank", "crypto", "stocks", "investing", "returns", "transfer"], ["currencies-and-units", "support-and-data"]),
    article("workout-goal", "momentum", "Does a completed workout update my weekly goal?", "A confirmed Gym session can count toward your chosen training goal, together with its linked Events occurrence. That occurrence counts once. Planned or unconfirmed training does not become a completed workout just because time passed.", ["goal tracker", "progress", "weekly", "completed", "double count", "training"], ["training-adviser", "about-manforth"]),
    article("training-adviser", "gym", "Is the training adviser medical advice?", "No. Presets and exercise information help with planning and logging. Ask a qualified trainer to check technique and suitability, and seek appropriate professional advice for injuries or health conditions. The app does not diagnose, measure recovery or prescribe heavier weights.", ["exercise", "workout", "presets", "trainer", "safety", "injury", "fitness"], ["workout-goal", "currencies-and-units"]),
    article("language-product", "getting-started", "Is this the language-learning app?", "ManForth is a separate B1-Way personal-development product. A ManForth membership does not include another product's subscription or language-learning entitlement.", ["language", "English", "B1 Way", "separate product"], ["about-manforth", "annual-membership"]),
    article("support-and-data", "privacy", "How do I get support or manage my data?", `Contact ${brand.supportEmail}. Account & Settings → Privacy & support includes data export and account deletion. Notification preferences and security have their own settings sections. Published privacy and terms links appear in the footer when configured. The contact link opens your email client; this Q&A does not automatically send a message.`, ["contact", "export", "download", "delete", "privacy", "security", "notifications"], ["after-trial", "no-card-trial"]),
  ];
}

function normalized(value: string) {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
export function searchHelp(articles: readonly HelpArticle[], query: string, category: HelpCategory | "all" = "all") {
  const words = normalized(query).split(/\s+/).filter(Boolean);
  return articles.filter(article => {
    if (article.publication !== "published" || category !== "all" && article.category !== category) return false;
    const content = normalized([article.question, article.answer, ...article.aliases].join(" "));
    return words.every(word => content.includes(word));
  });
}
