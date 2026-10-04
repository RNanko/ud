import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import nextEnv from '@next/env';
import Stripe from 'stripe';
import config from '../lib/account/config.ts';
import branding from '../lib/brand.ts';
const {annualPrices,PERSONAL_PRODUCT}=config;
const {brand}=branding;
nextEnv.loadEnvConfig(process.cwd());
const apply=process.argv.includes('--apply');
const key=process.env.STRIPE_SECRET_KEY;
if(!key)throw Error('STRIPE_SECRET_KEY is missing');
const stripe=new Stripe(key,{maxNetworkRetries:2,timeout:15000});
const live=key.startsWith('sk_live_')||key.startsWith('rk_live_');
const origin=new URL(process.env.NEXT_PUBLIC_SITE_URL||'https://b1-way-mf.vercel.app').origin;
if(!origin.startsWith('https://'))throw Error('Public billing policies require HTTPS');
const settings={POLICY_TERMS_URL:`${origin}/terms`,POLICY_PRIVACY_URL:`${origin}/privacy`};
function saveEnvironment(values){
 const path=resolve('.env');let content=readFileSync(path,'utf8');
 for(const [name,value] of Object.entries(values)){
  const line=`${name}=${JSON.stringify(value)}`;
  const pattern=new RegExp(`^${name}=.*$`,'m');
  content=pattern.test(content)?content.replace(pattern,()=>line):`${content.trimEnd()}\n${line}\n`;
 }
 const temporary=resolve('.env.billing-pending');writeFileSync(temporary,content,{mode:0o600});renameSync(temporary,path);
}
try{
 let product;
 if(process.env.STRIPE_PERSONAL_PRODUCT_ID)product=await stripe.products.retrieve(process.env.STRIPE_PERSONAL_PRODUCT_ID);
 else{
  const listed=await stripe.products.list({limit:100});
  const matches=listed.data.filter(p=>p.metadata.product===PERSONAL_PRODUCT);
  if(listed.has_more||matches.length>1)throw Error('Product catalogue needs manual review');
  product=matches[0];
 }
 if(!product){if(!apply)throw Error('Membership product is missing');product=await stripe.products.create({name:'ManForth Annual Membership',description:'One annual ManForth membership for your account across web and mobile.',metadata:{product:PERSONAL_PRODUCT}},{idempotencyKey:`manforth/catalogue/${PERSONAL_PRODUCT}`});}
 if(!product.active||product.livemode!==live||product.metadata.product!==PERSONAL_PRODUCT)throw Error('Unexpected membership product');
 settings.STRIPE_PERSONAL_PRODUCT_ID=product.id;
 const legacy=new Set((process.env.STRIPE_LEGACY_ANNUAL_PRICE_IDS??'').split(',').filter(Boolean));
 const verified=[];
 for(const [currency,amount] of Object.entries(annualPrices)){
  const lookup=`manforth_annual_${currency.toLowerCase()}_${amount}_v1`;
  const listed=await stripe.prices.list({lookup_keys:[lookup],limit:10});
  let price=listed.data[0];if(listed.data.length>1)throw Error('Ambiguous annual price');
  if(!price){if(!apply)throw Error('Annual price is missing');price=await stripe.prices.create({product:product.id,currency:currency.toLowerCase(),unit_amount:amount,recurring:{interval:'year',interval_count:1},tax_behavior:'inclusive',lookup_key:lookup,metadata:{product:PERSONAL_PRODUCT,plan:'annual'}},{idempotencyKey:`manforth/price/${product.id}/${currency}/${amount}`});}
  if(!price.active||price.product!==product.id||price.livemode!==live||price.unit_amount!==amount||price.currency!==currency.toLowerCase()||price.recurring?.interval!=='year'||price.recurring.interval_count!==1||price.tax_behavior!=='inclusive')throw Error('Annual price verification failed');
  const previous=process.env[`STRIPE_ANNUAL_PRICE_${currency}`]||process.env[`STRIPE_PRICE_ANNUAL_${currency}`];if(previous&&previous!==price.id)legacy.add(previous);
  settings[`STRIPE_ANNUAL_PRICE_${currency}`]=price.id;verified.push({currency,amountMinor:amount,interval:'year'});
 }
 settings.STRIPE_LEGACY_ANNUAL_PRICE_IDS=[...legacy].join(',');
 let portal;
 if(process.env.STRIPE_PORTAL_CONFIGURATION_ID)portal=await stripe.billingPortal.configurations.retrieve(process.env.STRIPE_PORTAL_CONFIGURATION_ID);
 else{const list=await stripe.billingPortal.configurations.list({limit:100});portal=list.data.find(c=>c.metadata.product===PERSONAL_PRODUCT);}
 if(!portal){if(!apply)throw Error('Cancellation portal is missing');portal=await stripe.billingPortal.configurations.create({business_profile:{headline:'Manage your ManForth membership',privacy_policy_url:settings.POLICY_PRIVACY_URL,terms_of_service_url:settings.POLICY_TERMS_URL},features:{invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_cancel:{enabled:true,mode:'at_period_end',proration_behavior:'none'}},metadata:{product:PERSONAL_PRODUCT}},{idempotencyKey:`manforth/portal/${product.id}/v1`});}
 if(!portal.active||!portal.features.subscription_cancel.enabled||portal.features.subscription_cancel.mode!=='at_period_end')throw Error('Cancellation portal verification failed');
 settings.STRIPE_PORTAL_CONFIGURATION_ID=portal.id;
 const endpointUrl=`${origin}/api/billing/webhook`;
 const endpoints=await stripe.webhookEndpoints.list({limit:100});
 let endpoint=endpoints.data.find(e=>e.url===endpointUrl&&e.livemode===live);
 if(!endpoint){if(!apply)throw Error('Signed webhook endpoint is missing');endpoint=await stripe.webhookEndpoints.create({url:endpointUrl,description:'ManForth shared membership reconciliation',enabled_events:['checkout.session.completed','checkout.session.expired','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed','charge.refunded','charge.dispute.created','charge.dispute.updated','charge.dispute.closed'],metadata:{product:PERSONAL_PRODUCT}},{idempotencyKey:`manforth/webhook/${product.id}/v1`});settings.STRIPE_WEBHOOK_SECRET=endpoint.secret;}
 if(endpoint.status!=='enabled'||!(settings.STRIPE_WEBHOOK_SECRET||process.env.STRIPE_WEBHOOK_SECRET))throw Error('Webhook signing configuration requires review');
 if(apply)saveEnvironment(settings);
 console.log(JSON.stringify({catalogueVerified:true,environment:live?'production':'test',prices:verified,portalCancellation:'at_period_end',webhookUrl:endpointUrl,environmentSaved:apply,support:brand.supportEmail}));
}catch(error){console.error(JSON.stringify({setupFailed:true,code:error?.code??null,message:error instanceof Stripe.errors.StripeError?'Stripe rejected the setup request. Check account permissions and merchant settings.':error.message}));process.exitCode=1;}
