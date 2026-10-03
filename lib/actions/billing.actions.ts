"use server";
import z from "zod";
import { headers } from "next/headers";
import { auth } from "../auth";
import { requireUserId } from "../session";
import { actionResult } from "../account/result";
import { accountSql, membershipFor } from "../account/store";
import { PERSONAL_PRODUCT, billingCurrencies, launchPolicy, appOrigin } from "../account/config";
import { productAccess } from "../account/access";
import { assertCheckoutLaunch, stripeClient, validatedPrice } from "../account/billing/stripe";
import { reconcileMembership } from "../account/billing/reconcile";
import { legalAgreementSchema, validateAgreement } from "../legal/validation";
import { publishedBundle, purchaseLegalSnapshot } from "../legal/store";
async function eligibleOwner(){const owner=await requireUserId();const deleted=await accountSql`SELECT 1 FROM b1_deletions WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}`;if(deleted[0])throw new Error("Account deletion is pending");await accountSql`INSERT INTO b1_memberships(user_id,product,enrolled_at) VALUES(${owner},${PERSONAL_PRODUCT},now()) ON CONFLICT DO NOTHING`;return owner;}
async function verifiedOwner(){const owner=await eligibleOwner(),session=await auth.api.getSession({headers:await headers(),query:{disableCookieCache:true}});if(!session?.user.emailVerified)throw new Error("Verify your login email first");return owner;}
export async function membershipStatus(){return actionResult(async()=>{
 const owner=await requireUserId(),member=await membershipFor(owner),access=await productAccess(owner);
 return {access,trialStart:member?.trial_started_at??null,trialEnd:member?.trial_ends_at??null,paidThrough:member?.paid_through??null,renewalOff:!!member?.renewal_off,billingCurrency:member?.billing_currency??null,hasCustomer:!!member?.customer_id,providerStatus:member?.status??"eligible",syncError:member?.sync_error??null,checkoutPending:!!member?.checkout_operation};
});}
export async function startMembershipTrial(){return actionResult(async()=>{
 const owner=await verifiedOwner(),days=launchPolicy().trialDays;
 const rows=await accountSql`UPDATE b1_memberships SET trial_started_at=now(),trial_ends_at=now()+${days}*interval '1 day',status='trial' WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND trial_started_at IS NULL AND paid_confirmed=false RETURNING trial_ends_at`;
 if(!rows[0])throw new Error("Your trial has already started or you have a paid membership");return {endsAt:rows[0].trial_ends_at};
});}
export async function createMembershipCheckout(input:unknown){return actionResult(async()=>{
 const {currency,acceptImmediateCharge,legal}=z.object({currency:z.enum(billingCurrencies),acceptImmediateCharge:z.literal(true),legal:legalAgreementSchema}).strict().parse(input);void acceptImmediateCharge;
 const bundle=await publishedBundle();validateAgreement(legal,bundle);if(!bundle?.purchaseReady)throw Error('Purchases are awaiting reviewed legal and consumer-rights processes.');
 assertCheckoutLaunch();const owner=await verifiedOwner(),stripe=stripeClient(),price=await validatedPrice(currency);
 let member=await membershipFor(owner);
 if(member?.checkout_id){const pending=await stripe.checkout.sessions.retrieve(member.checkout_id);
  if(pending.status==="open"){if(member.checkout_currency!==currency)throw new Error("An existing checkout uses a different currency. Close it and confirm the current regional price before opening a new checkout.");const evidence=await accountSql`SELECT 1 FROM b1_legal_purchases WHERE operation=${member.checkout_operation} AND user_id=${owner} AND product=${PERSONAL_PRODUCT}`;if(!evidence[0])throw Error('This pending checkout predates legal snapshots. Close it and review the current purchase information.');return {url:pending.url!};}
  if(pending.status==="complete"){await reconcileMembership(owner);const confirmed=await membershipFor(owner);if(!confirmed?.paid_confirmed)throw new Error("Your previous checkout is being confirmed. Check membership status before purchasing again.");if(confirmed.paid_through&&Date.parse(confirmed.paid_through)>Date.now())throw new Error("Your paid membership is active. Use billing management.");if(!["canceled","incomplete_expired"].includes(confirmed.status))throw new Error("An existing subscription needs billing management before a new purchase.");}
  await accountSql`UPDATE b1_memberships SET checkout_id=NULL,checkout_operation=NULL,checkout_currency=NULL,checkout_price=NULL,checkout_expires=NULL WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND checkout_id=${pending.id}`;
 }
 await reconcileMembership(owner);member=await membershipFor(owner);
 if(member?.subscription_id&&!["canceled","incomplete_expired","eligible","trial"].includes(member.status))throw new Error("A membership already exists. Use billing management.");
 const lease=await accountSql`UPDATE b1_memberships SET checkout_lease=now()+interval '2 minutes',checkout_operation=COALESCE(checkout_operation,${crypto.randomUUID()}),checkout_currency=COALESCE(checkout_currency,${currency}),checkout_price=COALESCE(checkout_price,${price.id}),checkout_expires=COALESCE(checkout_expires,now()+interval '12 hours')
 WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND (checkout_lease IS NULL OR checkout_lease<now()) AND checkout_id IS NULL RETURNING *`;
 if(!lease[0])throw new Error("Checkout is already being prepared. Retry shortly.");
 member=lease[0];
 try{
  if(member.checkout_currency!==currency||member.checkout_price!==price.id)throw new Error("Retry the original pending checkout currency. Contact support if it cannot be recovered.");
  if(Date.parse(member.checkout_expires)<=Date.now()+1800000)throw new Error("Pending checkout needs reconciliation before another purchase. Contact support.");
  await purchaseLegalSnapshot(owner,member.checkout_operation,currency,member.checkout_price,legal);
  let customerId=member.customer_id;
  if(!customerId){const customer=await stripe.customers.create({metadata:{user_id:owner,product:PERSONAL_PRODUCT}},{idempotencyKey:`b1/customer/${owner}`});customerId=customer.id;await accountSql`UPDATE b1_memberships SET customer_id=${customerId} WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND customer_id IS NULL`;}
  const existing=await stripe.subscriptions.list({customer:customerId,status:"all",limit:100});if(existing.has_more)throw new Error("Extended billing history needs review before another purchase.");if(existing.data.some(s=>s.metadata.product===PERSONAL_PRODUCT&&!["canceled","incomplete_expired"].includes(s.status)))throw new Error("A subscription is already awaiting payment or active. Open billing management.");
  const session=await stripe.checkout.sessions.create({mode:"subscription",customer:customerId,client_reference_id:owner,allowed_payment_method_types:["card"],line_items:[{price:member.checkout_price,quantity:1}],subscription_data:{metadata:{user_id:owner,product:PERSONAL_PRODUCT}},metadata:{user_id:owner,product:PERSONAL_PRODUCT,operation:member.checkout_operation},success_url:`${appOrigin()}/account?billing=confirming`,cancel_url:`${appOrigin()}/account?billing=cancelled`,expires_at:Math.floor(Date.parse(member.checkout_expires)/1000),billing_address_collection:"required",automatic_tax:{enabled:process.env.STRIPE_AUTOMATIC_TAX==="true"},customer_update:{address:"auto"},adaptive_pricing:{enabled:false},custom_text:{submit:{message:`Annual membership: ${currency} ${currency==="PLN"?"40":"10"}. Charged now; no additional trial.`}},...(process.env.POLICY_TERMS_URL?{consent_collection:{terms_of_service:"required" as const}}:{})},{idempotencyKey:`b1/checkout/${member.checkout_operation}`});
  await accountSql`UPDATE b1_memberships SET checkout_id=${session.id},checkout_lease=NULL WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND checkout_operation=${member.checkout_operation}`;
  if(!session.url)throw new Error("Checkout URL is unavailable");return {url:session.url};
 }finally{await accountSql`UPDATE b1_memberships SET checkout_lease=NULL WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND checkout_operation=${member.checkout_operation}`;}
});}
export async function expireMembershipCheckout(){return actionResult(async()=>{
 const owner=await eligibleOwner(),member=await membershipFor(owner);if(!member?.checkout_id)throw new Error("No recoverable open checkout was found");
 const stripe=stripeClient(),pending=await stripe.checkout.sessions.retrieve(member.checkout_id);if(pending.status==="complete")throw new Error("Checkout is complete. Confirm membership instead.");if(pending.status==="open")await stripe.checkout.sessions.expire(pending.id);
 await accountSql`UPDATE b1_memberships SET checkout_id=NULL,checkout_operation=NULL,checkout_currency=NULL,checkout_price=NULL,checkout_expires=NULL WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND checkout_id=${pending.id}`;return {message:"Open checkout closed. Review the current regional price before purchasing."};
});}
export async function openMembershipPortal(){return actionResult(async()=>{
 const owner=await eligibleOwner(),member=await membershipFor(owner),stripe=stripeClient();if(!member?.customer_id)throw new Error("No billing customer exists yet");
 const customer=await stripe.customers.retrieve(member.customer_id);if(customer.deleted||customer.metadata.user_id!==owner||customer.metadata.product!==PERSONAL_PRODUCT)throw new Error("Billing ownership could not be verified");
 const configuration=process.env.STRIPE_PORTAL_CONFIGURATION_ID;if(!configuration)throw new Error("Billing portal configuration is missing");
 const portal=await stripe.billingPortal.sessions.create({customer:member.customer_id,configuration,return_url:`${appOrigin()}/account`});return {url:portal.url};
});}
export async function refreshMembership(){return actionResult(async()=>{const owner=await requireUserId();await reconcileMembership(owner);return {message:"Membership checked against Stripe"};});}
