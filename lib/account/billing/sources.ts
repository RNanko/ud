import "server-only";
import { accountSql } from "../store";
import { PERSONAL_PRODUCT, appOrigin } from "../config";
import type { BillingSource } from "./entitlement";
export const billingSourcesEnabled = () => process.env.B1_BILLING_SOURCES_ENABLED === "true";
export function billingEnvironment(): "production" | "test" {
  if (process.env.B1_BILLING_ENVIRONMENT !== "test") return "production";
  // A local-only setting copied into production must not crash account reads
  // or let sandbox evidence grant paid access. Deployment scope takes priority.
  if (process.env.VERCEL_ENV === "production") return "production";
  const local = ["localhost", "127.0.0.1", "10.0.2.2"].includes(new URL(appOrigin()).hostname);
  return local || process.env.NODE_ENV === "development" ? "test" : "production";
}
export async function billingSources(owner: string): Promise<BillingSource[]> {
  if (!billingSourcesEnabled()) return [];
  const rows = await accountSql`SELECT provider,environment,subscription_id,status,confirmed,paid_through,grace_until,renewal_off,currency,amount_minor
    FROM b1_billing_sources WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}`;
  return rows.map(row => ({provider:row.provider,environment:row.environment,subscriptionId:row.subscription_id,status:row.status,confirmed:row.confirmed,
    paidThrough:row.paid_through,graceUntil:row.grace_until,renewalOff:row.renewal_off,currency:row.currency,amountMinor:row.amount_minor===null?null:Number(row.amount_minor)}));
}
export type SourceSnapshot = BillingSource & { owner: string; processor: "stripe" | "revenuecat"; providerStatus: string; productId: string; priceId: string | null; observedAt: string };
export async function saveBillingSource(source: SourceSnapshot) {
  if (!billingSourcesEnabled()) return;
  // Ownership is immutable, and older reconciliations cannot overwrite newer state.
  const rows = await accountSql`INSERT INTO b1_billing_sources(user_id,product,provider,environment,subscription_id,processor,status,provider_status,confirmed,paid_through,grace_until,renewal_off,currency,amount_minor,provider_product_id,provider_price_id,observed_at)
   SELECT ${source.owner},${PERSONAL_PRODUCT},${source.provider},${source.environment},${source.subscriptionId},${source.processor},${source.status},${source.providerStatus},${source.confirmed},${source.paidThrough}::timestamptz,${source.graceUntil}::timestamptz,${source.renewalOff},${source.currency},${source.amountMinor},${source.productId},${source.priceId},${source.observedAt}::timestamptz
   WHERE EXISTS(SELECT 1 FROM "user" WHERE id=${source.owner}) AND NOT EXISTS(SELECT 1 FROM b1_deletions WHERE user_id=${source.owner} AND product=${PERSONAL_PRODUCT})
   ON CONFLICT(provider,environment,subscription_id) DO UPDATE SET status=excluded.status,provider_status=excluded.provider_status,confirmed=excluded.confirmed,paid_through=excluded.paid_through,grace_until=excluded.grace_until,renewal_off=excluded.renewal_off,currency=excluded.currency,amount_minor=excluded.amount_minor,provider_product_id=excluded.provider_product_id,provider_price_id=excluded.provider_price_id,observed_at=excluded.observed_at,updated_at=now()
   WHERE b1_billing_sources.user_id=excluded.user_id AND b1_billing_sources.product=excluded.product AND b1_billing_sources.observed_at<=excluded.observed_at RETURNING user_id`;
  if (!rows[0]) {
    const existing=await accountSql`SELECT user_id FROM b1_billing_sources WHERE provider=${source.provider} AND environment=${source.environment} AND subscription_id=${source.subscriptionId}`;
    if(existing[0] && existing[0].user_id!==source.owner) throw Error("Provider subscription belongs to a different account");
  }
}
