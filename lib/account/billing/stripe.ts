import { PublicError } from "../errors";
import "server-only";
import Stripe from "stripe";
import { annualPrices, billingCurrencies, type BillingCurrency } from "../config";
export function stripeClient(){
 const key=process.env.STRIPE_SECRET_KEY;
 if(!key)throw new PublicError("Membership checkout is unavailable until Stripe is configured");
 return new Stripe(key,{maxNetworkRetries:2,timeout:15000});
}
export function stripeLive(){return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY??'');}
export function configuredPrice(currency:BillingCurrency){const price=process.env[`STRIPE_ANNUAL_PRICE_${currency}`]||process.env[`STRIPE_PRICE_ANNUAL_${currency}`];if(!price)throw new PublicError(`Annual ${currency} price is not configured`);return price;}
export async function validatedPrice(currency:BillingCurrency,id=configuredPrice(currency)){
 const price=await stripeClient().prices.retrieve(id);
 const product=typeof price.product==="string"?price.product:price.product.id;
 if(!price.active||product!==process.env.STRIPE_PERSONAL_PRODUCT_ID||price.currency!==currency.toLowerCase()||price.unit_amount!==annualPrices[currency]||price.recurring?.interval!=="year"||price.recurring.interval_count!==1||price.tax_behavior!=="inclusive"||price.livemode!==stripeLive())throw new PublicError("Annual price configuration does not match the membership offer");
 return price;
}
export function assertCheckoutLaunch(){
 stripeClient();
 if(stripeLive()&&(!process.env.POLICY_TERMS_URL||!process.env.POLICY_PRIVACY_URL))throw new PublicError("Configure the public Terms and Privacy URLs for checkout");
 if(!["STRIPE_PERSONAL_PRODUCT_ID","STRIPE_PORTAL_CONFIGURATION_ID","STRIPE_WEBHOOK_SECRET"].every(key=>!!process.env[key]))throw new PublicError("Annual checkout is unavailable until product, prices, portal and signed webhooks are configured");
 for(const currency of billingCurrencies)configuredPrice(currency);
}
export function checkoutConfigurationReady(){try{assertCheckoutLaunch();return true;}catch{return false;}}
