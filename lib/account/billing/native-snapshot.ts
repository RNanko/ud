import { z } from "zod";
import type { BillingSource } from "./entitlement";
const date = z.iso.datetime({offset:true}).nullable().optional();
const subscription = z.object({store:z.string(),is_sandbox:z.boolean(),expires_date:date,purchase_date:date,period_type:z.string(),
  refunded_at:date,unsubscribe_detected_at:date,billing_issues_detected_at:date,grace_period_expires_date:date});
const customer = z.object({request_date_ms:z.number().int().positive(),subscriber:z.object({original_app_user_id:z.string(),
  entitlements:z.record(z.string(),z.object({product_identifier:z.string(),expires_date:date})),subscriptions:z.record(z.string(),subscription)})});
export function nativeSnapshot(input:unknown,owner:string,entitlementId:string,products:string[]) {
  const value=customer.parse(input);
  // No email matching, anonymous purchases, or silent transfers between accounts.
  if(value.subscriber.original_app_user_id!==owner) throw Error("Store account ownership requires review");
  const entries=Object.entries(value.subscriber.subscriptions);
  if(entries.length>100)throw Error("Extended store history requires review");
  const entitlement=value.subscriber.entitlements[entitlementId];
  const sources:Array<BillingSource & {productId:string;providerStatus:string}>=[];
  for(const [productId,sub] of entries){
    if(!products.includes(productId)||!['app_store','play_store'].includes(sub.store))continue;
    const provider=sub.store==='app_store'?'apple_app_store':'google_play';
    const paid=sub.period_type.toLowerCase()==='normal'&&!!sub.purchase_date;
    const revoked=!!sub.refunded_at||!entitlement||!products.includes(entitlement.product_identifier);
    const grace=paid&&!revoked&&!!sub.billing_issues_detected_at&&!!sub.grace_period_expires_date;
    sources.push({provider,environment:sub.is_sandbox?'sandbox':'production',subscriptionId:`${owner}:${provider}:${productId}`,
      confirmed:paid,status:revoked?'revoked':!paid?'pending':grace?'grace':'active',providerStatus:revoked?'revoked':grace?'billing-issue':sub.unsubscribe_detected_at?'renewal-off':'verified',
      paidThrough:sub.expires_date??null,graceUntil:grace?sub.grace_period_expires_date??null:null,renewalOff:!!sub.unsubscribe_detected_at||revoked,
      currency:null,amountMinor:null,productId});
  }
  return {sources,observedAt:new Date(value.request_date_ms).toISOString()};
}
