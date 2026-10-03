import "server-only";
import Stripe from "stripe";
import { annualPrices, launchPolicy, type BillingCurrency } from "../config";
export function stripeClient(){
 const key=process.env.STRIPE_SECRET_KEY;
 if(!key)throw new Error("Membership checkout is unavailable until Stripe is configured");
 return new Stripe(key,{maxNetworkRetries:2,timeout:15000});
}
export function stripeLive(){return process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")===true;}
export function configuredPrice(currency:BillingCurrency){const price=process.env[`STRIPE_ANNUAL_PRICE_${currency}`];if(!price)throw new Error(`Annual ${currency} price is not configured`);return price;}
export async function validatedPrice(currency:BillingCurrency,id=configuredPrice(currency)){
 const price=await stripeClient().prices.retrieve(id);
 const product=typeof price.product==="string"?price.product:price.product.id;
 if(!price.active||product!==process.env.STRIPE_PERSONAL_PRODUCT_ID||price.currency!==currency.toLowerCase()||price.unit_amount!==annualPrices[currency]||price.recurring?.interval!=="year"||price.recurring.interval_count!==1||price.tax_behavior!=="inclusive"||price.livemode!==stripeLive())throw new Error("Annual price configuration does not match the membership offer");
 return price;
}
export function assertCheckoutLaunch(){
 stripeClient();
 if(stripeLive()&&(!launchPolicy().liveCheckoutReady||process.env.STRIPE_TAX_SETUP_CONFIRMED!=="true"||!process.env.STRIPE_PORTAL_CONFIGURATION_ID||!process.env.POLICY_TERMS_URL||!process.env.POLICY_PRIVACY_URL))throw new Error("Live billing is disabled until merchant, tax, policies and cancellation setup are reviewed");
}
