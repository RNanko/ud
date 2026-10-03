/** Display identity only. Database, membership and storage identifiers stay unchanged. */
export const brand = {
  productName: "ManForth", wordmark: "MANFORTH", shortName: "MF",
  parentBrand: "B1-Way", brandLine: "by B1-Way", supportEmail: "support-mf@b1-way.pl",
  publicSiteOrigin: process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://b1-way-mf.vercel.app",
  title: "ManForth by B1-Way | Plan. Train. Make progress.",
  description: "Organize your money, plan your week, track workouts, and follow your goals with ManForth, a B1-Way product.",
} as const;
export function publicOrigin() {
  const url = new URL(brand.publicSiteOrigin);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) throw new Error("NEXT_PUBLIC_SITE_ORIGIN must be an HTTPS origin");
  return url.origin;
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
