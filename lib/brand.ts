/** Display identity only. Database, membership and storage identifiers stay unchanged. */
export const brand = {
  productName: "ManForth", wordmark: "MANFORTH", shortName: "MF",
  parentBrand: "B1-Way", brandLine: "by B1-Way", supportEmail: "support-mf@b1-way.pl",
  // Public discovery identity is deliberately independent of request Host and preview environment URLs.
  publicSiteOrigin: "https://b1-way-mf.vercel.app",
  title: "ManForth — Workout, Task & Goal Planner | B1-Way",
  description: "Plan your week, log workouts, organize spending, and track personal goals with ManForth by B1-Way. Connect your daily actions in one workspace.",
} as const;
export function publicOrigin() {
  return brand.publicSiteOrigin;
}
export function indexPublicSite() {
  return process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production";
}
/** Keep the configured verified sender address; only the personal-product display name changes. */
export function brandedEmailSender(configured?:string) {
  const address=configured?.match(/<([^<>]+)>/)?.[1] ?? configured?.trim() ?? brand.supportEmail;
  if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address))throw Error("Invalid configured email sender address");
  return `${brand.productName} ${brand.brandLine} <${address}>`;
}
