import nextEnv from '@next/env';
import Stripe from 'stripe';
import config from '../lib/account/config.ts';
nextEnv.loadEnvConfig(process.cwd());
// A remote smoke check creates unpaid Checkout sessions, never purchases.
// This deliberately refuses live credentials: real charging belongs to the user.
if(!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw Error('Unpaid smoke verification requires the configured nonproduction Stripe account');
const stripe=new Stripe(process.env.STRIPE_SECRET_KEY,{maxNetworkRetries:2,timeout:15000});
let customer;const sessions=[];const results=[];
try{
 customer=await stripe.customers.create({name:'ManForth isolated unpaid checkout verification',metadata:{product:config.PERSONAL_PRODUCT,user_id:`isolated-check-${crypto.randomUUID()}`,verification:'unpaid-checkout-only'}});
 for(const [currency,amount] of Object.entries(config.annualPrices)){
  const price=process.env[`STRIPE_ANNUAL_PRICE_${currency}`];
  const session=await stripe.checkout.sessions.create({mode:'subscription',customer:customer.id,client_reference_id:customer.metadata.user_id,allowed_payment_method_types:['card'],line_items:[{price,quantity:1}],subscription_data:{metadata:customer.metadata},metadata:customer.metadata,success_url:'http://localhost:3000/account?billing=confirming',cancel_url:'http://localhost:3000/account?billing=cancelled',billing_address_collection:'required',customer_update:{address:'auto'},automatic_tax:{enabled:false},adaptive_pricing:{enabled:false},custom_text:{submit:{message:`Annual membership: ${currency} ${(amount/100).toFixed(2)}. Charged now; renews yearly until canceled.`}},consent_collection:{terms_of_service:'required'}});
  sessions.push(session.id);
  const lines=await stripe.checkout.sessions.listLineItems(session.id);
  if(session.status!=='open'||!session.url||session.currency!==currency.toLowerCase()||session.amount_total!==amount||lines.data.length!==1||lines.data[0].price?.id!==price)throw Error('Checkout did not match the annual offer');
  const portal=await stripe.billingPortal.sessions.create({customer:customer.id,configuration:process.env.STRIPE_PORTAL_CONFIGURATION_ID,return_url:'http://localhost:3000/account'});
  if(!portal.url)throw Error('Cancellation portal unavailable');
  results.push({currency,amountMinor:amount,checkoutVerified:true,portalVerified:true});
 }
 console.log(JSON.stringify({unpaidCheckouts:results,chargesCreated:0,subscriptionsCreated:0}));
}catch(error){console.error(JSON.stringify({checkoutVerificationFailed:true,code:error.code??null,message:error instanceof Stripe.errors.StripeError?'Stripe rejected an unpaid checkout. Inspect merchant checkout settings.':error.message}));process.exitCode=1;}
finally{
 let cleaned=true;for(const id of sessions)try{await stripe.checkout.sessions.expire(id);}catch{cleaned=false;}
 if(customer)try{await stripe.customers.del(customer.id);}catch{cleaned=false;}
 console.log(JSON.stringify({temporaryBillingFixturesRemoved:cleaned}));if(!cleaned)process.exitCode=1;
}
