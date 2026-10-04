import { PublicError } from "../errors";
import "server-only";
import type Stripe from "stripe";
import { accountSql, membershipFor } from "../store";
import { PERSONAL_PRODUCT, annualPrices, launchPolicy, type BillingCurrency } from "../config";
import { stripeClient, stripeLive } from "./stripe";
import { billingSources, billingSourcesEnabled, saveBillingSource } from "./sources";
const idOf=(value:string|{id:string}|null|undefined)=>typeof value==="string"?value:value?.id??null;
async function paidInvoice(stripe:Stripe,invoice:Stripe.Invoice,customerId:string,amount:number){
 const payments=await stripe.invoicePayments.list({invoice:invoice.id,limit:100});
 if(payments.has_more)throw new PublicError('Extended invoice payments require review');
 let allocated=0,revoked=false;
 for(const payment of payments.data){
  if(payment.status!=='paid')continue;
  let charge:Stripe.Charge|null=null;
  if(payment.payment.type==='payment_intent'){
   const intent=await stripe.paymentIntents.retrieve(idOf(payment.payment.payment_intent)!);
   if(intent.status==='succeeded'&&intent.latest_charge)charge=await stripe.charges.retrieve(idOf(intent.latest_charge)!);
  }else if(payment.payment.type==='charge'&&payment.payment.charge)charge=await stripe.charges.retrieve(idOf(payment.payment.charge)!);
  if(!charge||idOf(charge.customer)!==customerId||!charge.paid||charge.livemode!==stripeLive())continue;
  if(charge.refunded||charge.disputed){revoked=true;continue;}
  allocated+=payment.amount_paid??0;
 }
 return {confirmed:allocated>=amount&&!revoked,revoked};
}
export async function reconcileMembership(owner:string){
 const member=await membershipFor(owner);if(!member?.customer_id)return;
 const deleted=await accountSql`SELECT 1 FROM b1_deletions WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}`;if(deleted[0])return;
 const lock=crypto.randomUUID();
 const locked=await accountSql`UPDATE b1_memberships SET sync_lock=${lock},sync_lease=now()+interval '2 minutes' WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND (sync_lease IS NULL OR sync_lease<=now()) RETURNING 1`;
 if(!locked[0])throw new PublicError("Membership confirmation is already running. Retry shortly.");
 const observedAt=new Date().toISOString();
 try{
  const stripe=stripeClient(),customer=await stripe.customers.retrieve(member.customer_id);
  if(customer.deleted||customer.metadata.user_id!==owner||customer.metadata.product!==PERSONAL_PRODUCT)throw new PublicError("Billing ownership requires operator review");
  const subscriptions=await stripe.subscriptions.list({customer:member.customer_id,status:"all",limit:100,expand:["data.latest_invoice"]});
  if(subscriptions.has_more)throw new PublicError("Extended billing history requires operator review");
  const candidates=subscriptions.data.filter(s=>s.metadata.product===PERSONAL_PRODUCT&&s.metadata.user_id===owner);
  const live=candidates.filter(s=>!["canceled","incomplete_expired"].includes(s.status));
  if(live.length>1){await accountSql`UPDATE b1_memberships SET operator_review=true WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}`;}
  const selected=live[0]??candidates.find(s=>s.id===member.subscription_id)??candidates.sort((a,b)=>b.created-a.created)[0];
  if(!selected)return;
  const previous=await billingSources(owner);
  for(const sub of candidates){
  if(sub.livemode!==stripeLive()||sub.items.data.length!==1)throw new PublicError("Unexpected subscription configuration");
  const item=sub.items.data[0],price=item.price,currency=price.currency.toUpperCase() as BillingCurrency;
  const currentPrice=process.env[`STRIPE_ANNUAL_PRICE_${currency}`]||process.env[`STRIPE_PRICE_ANNUAL_${currency}`];
  const legacyPrice=price.id===member.price_id||(process.env.STRIPE_LEGACY_ANNUAL_PRICE_IDS??"").split(",").includes(price.id);
  if(!(currency in annualPrices)||(!legacyPrice&&(price.id!==currentPrice||price.unit_amount!==annualPrices[currency]))||!price.unit_amount||price.unit_amount<0||price.recurring?.interval!=="year"||price.recurring.interval_count!==1||price.tax_behavior!=="inclusive"||idOf(price.product)!==process.env.STRIPE_PERSONAL_PRODUCT_ID||item.quantity!==1||sub.trial_start!==null||sub.trial_end!==null)throw new PublicError("Membership configuration requires operator review");
  const latest=sub.latest_invoice;const invoice=typeof latest==="string"?await stripe.invoices.retrieve(latest):latest;
  const invoiceSub=idOf(invoice?.parent?.subscription_details?.subscription);
  const line=invoice?.lines.data.find(line=>idOf(line.pricing?.price_details?.price)===price.id&&line.parent?.subscription_item_details?.subscription_item===item.id);
  const matchingInvoice=invoice?.status==="paid"&&invoice.amount_paid>=price.unit_amount&&invoice.currency===price.currency&&invoiceSub===sub.id&&line?.quantity===1&&line.period.end>line.period.start&&line.period.end===item.current_period_end;
  const payment=matchingInvoice?await paidInvoice(stripe,invoice!,member.customer_id,price.unit_amount):{confirmed:false,revoked:false};
  const confirmed=matchingInvoice&&payment.confirmed;
  const known=previous.find(source=>source.provider==='stripe'&&source.subscriptionId===sub.id&&source.environment===(sub.livemode?'production':'test'));
  const wasPaid=known?.confirmed??(member.subscription_id===sub.id&&!!member.paid_confirmed);
  const through=confirmed?new Date(line!.period.end*1000).toISOString():known?.paidThrough??(member.subscription_id===sub.id?member.paid_through:null)??null;
  const failedRenewal=wasPaid&&!confirmed&&!payment.revoked&&["past_due","unpaid"].includes(sub.status)&&invoice?.billing_reason==="subscription_cycle";
  const periodKey=failedRenewal?`${sub.id}:${item.current_period_start}`:null;
  const grace=failedRenewal&&through?new Date(Math.min(Date.parse(through),item.current_period_start*1000)+launchPolicy().graceDays*86400000).toISOString():null;
  if(billingSourcesEnabled()){
   await saveBillingSource({owner,provider:"stripe",processor:"stripe",environment:sub.livemode?"production":"test",subscriptionId:sub.id,
    status:payment.revoked?'revoked':failedRenewal?"grace":confirmed||wasPaid?sub.status==="canceled"?"canceled":"active":"pending",providerStatus:sub.status,confirmed:!!confirmed||wasPaid||payment.revoked,
    paidThrough:through,graceUntil:grace,renewalOff:sub.cancel_at_period_end||sub.cancel_at!==null||sub.status==="canceled",currency,amountMinor:price.unit_amount,
    productId:idOf(price.product)!,priceId:price.id,observedAt});
   // Older code still reads the account projection; all provider-specific history stays separate.
   await accountSql`DELETE FROM b1_billing_sources WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND provider='stripe' AND environment='unknown' AND subscription_id=${sub.id}`;
  }
  if(sub.id!==selected.id)continue;
  await accountSql`UPDATE b1_memberships SET subscription_id=${sub.id},billing_currency=${currency},price_id=${price.id},status=${sub.status},
   paid_confirmed=paid_confirmed OR ${!!confirmed},paid_through=CASE WHEN ${!!confirmed} THEN GREATEST(paid_through,${through}::timestamptz) ELSE paid_through END,
   renewal_off=${sub.cancel_at_period_end||sub.cancel_at!==null||sub.status==="canceled"},
   grace_until=CASE WHEN ${!!confirmed} THEN NULL WHEN ${failedRenewal} AND (grace_period_key IS NULL OR grace_period_key<>${periodKey}) THEN ${grace}::timestamptz ELSE grace_until END,
   grace_period_key=CASE WHEN ${failedRenewal} THEN ${periodKey} ELSE grace_period_key END,last_synced_at=now(),sync_error=NULL
   WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND sync_lock=${lock} AND NOT EXISTS(SELECT 1 FROM b1_deletions WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT})`;
  }
 }catch(error){await accountSql`UPDATE b1_memberships SET sync_error='Provider confirmation unavailable; retained last confirmed access',last_synced_at=now() WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND sync_lock=${lock}`;throw error;}
 finally{await accountSql`UPDATE b1_memberships SET sync_lock=NULL,sync_lease=NULL WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND sync_lock=${lock}`;}
}
export async function acceptStripeEvent(event:Stripe.Event){
 if(event.livemode!==stripeLive())throw new PublicError("Webhook environment mismatch");
 const object=event.data.object as unknown as {id:string;customer?:string|{id:string};object?:string;};
 // Persist only identifiers; authoritative objects are retrieved when processing.
 const environment=event.livemode?"production":"test";
 await accountSql`INSERT INTO b1_provider_events(provider,event_id,environment,payload) VALUES('stripe',${`${environment}:${event.id}`},${environment},${JSON.stringify({type:event.type,id:object.id,object:object.object,customer:idOf(object.customer),created:event.created})}::jsonb) ON CONFLICT DO NOTHING`;
}
export async function processStripeQueue(limit=20){
 const environment=stripeLive()?'production':'test';
 const rows=await accountSql`UPDATE b1_provider_events SET lease_until=now()+interval '3 minutes',attempts=attempts+1 WHERE provider='stripe' AND event_id IN
  (SELECT event_id FROM b1_provider_events WHERE provider='stripe' AND environment IN ('unknown',${environment}) AND status IN ('pending','retry') AND next_at<=now() AND attempts<8 AND (lease_until IS NULL OR lease_until<=now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT ${limit}) RETURNING event_id,payload,attempts`;
 for(const row of rows){try{
  const payload=row.payload;let customer=payload.customer;
  if(!customer&&payload.object==="charge")customer=idOf((await stripeClient().charges.retrieve(payload.id)).customer);
  if(!customer&&payload.object==="refund"){const refund=await stripeClient().refunds.retrieve(payload.id);if(refund.charge)customer=idOf((await stripeClient().charges.retrieve(idOf(refund.charge)!)).customer);}
  if(!customer&&payload.object==="dispute"){const dispute=await stripeClient().disputes.retrieve(payload.id);customer=idOf((await stripeClient().charges.retrieve(idOf(dispute.charge)!)).customer);}
  const deleted=customer?await accountSql`SELECT 1 FROM b1_deletions WHERE customer_id=${customer}`:[];
  const members=customer&&!deleted[0]?await accountSql`SELECT user_id FROM b1_memberships WHERE customer_id=${customer} AND product=${PERSONAL_PRODUCT}`:[];
  if(members[0]){
   if(payload.type.includes("refund")||payload.type.includes("dispute"))await accountSql`UPDATE b1_memberships SET operator_review=true WHERE customer_id=${customer} AND product=${PERSONAL_PRODUCT}`;
   await reconcileMembership(members[0].user_id);
  }
  await accountSql`UPDATE b1_provider_events SET status='processed',lease_until=NULL,error=NULL WHERE provider='stripe' AND event_id=${row.event_id}`;
 }catch{await accountSql`UPDATE b1_provider_events SET status=CASE WHEN attempts>=8 THEN 'failed' ELSE 'retry' END,lease_until=NULL,error='Provider reconciliation failed',next_at=now()+${Math.min(3600,30*2**row.attempts)}*interval '1 second' WHERE provider='stripe' AND event_id=${row.event_id}`;}}
 return rows.length;
}
