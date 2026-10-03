import "dotenv/config";
import Stripe from "stripe";
import { annualPrices, billingCurrencies } from "../lib/account/config";
import { annualPriceMatches } from "../lib/landing/price-setup";
const key=process.env.STRIPE_SECRET_KEY,product=process.env.STRIPE_PERSONAL_PRODUCT_ID;
if(!key||!product)throw Error("Configure STRIPE_SECRET_KEY and STRIPE_PERSONAL_PRODUCT_ID first");
const live=key.startsWith("sk_live_");
if(live&&process.argv.includes("--create-gbp")&&!process.argv.includes("--live-reviewed"))throw Error("Live provisioning requires --live-reviewed after merchant review");
const stripe=new Stripe(key,{maxNetworkRetries:2});
const object=await stripe.products.retrieve(product);
if(object.deleted||object.livemode!==live||!object.active)throw Error("Product environment or active status mismatch");
for(const currency of billingCurrencies){
 const id=process.env[`STRIPE_ANNUAL_PRICE_${currency}`]||process.env[`STRIPE_PRICE_ANNUAL_${currency}`];
 if(id){const price=await stripe.prices.retrieve(id);if(!annualPriceMatches(price,currency,product,live))throw Error(`Configured ${currency} price does not match the fixed annual inclusive-tax offer`);console.log(`Verified ${currency}: ${annualPrices[currency]} minor units, yearly, ${live?'live':'test'}`);continue;}
 if(currency!=="GBP"||!process.argv.includes("--create-gbp")){console.log(`${currency}: missing configuration (no price created)`);continue;}
 let matching:Stripe.Price|null=null;
 for await (const price of stripe.prices.list({product,active:true,limit:100})){if(annualPriceMatches(price,"GBP",product,live)){matching=price;break;}}
 if(!matching)matching=await stripe.prices.create({product,currency:"gbp",unit_amount:1000,recurring:{interval:"year",interval_count:1},tax_behavior:"inclusive",metadata:{offer:"manforth-annual"}},{idempotencyKey:`manforth/annual-gbp/${product}/${live?'live':'test'}/1000/inclusive`});
 if(!annualPriceMatches(matching,"GBP",product,live))throw Error("Provisioned GBP price failed validation");
 console.log(`Set STRIPE_ANNUAL_PRICE_GBP=${matching.id} in the same ${live?'live':'test'} deployment. Existing prices/subscriptions were not changed.`);
}
