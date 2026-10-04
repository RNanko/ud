import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { accountSql } from "../store";
import { PERSONAL_PRODUCT } from "../config";
import { billingSources, billingSourcesEnabled, saveBillingSource } from "./sources";
import { nativeSnapshot } from "./native-snapshot";
const annualProducts=()=> (process.env.REVENUECAT_ANNUAL_PRODUCT_IDS??'').split(',').map(s=>s.trim()).filter(Boolean);
export function nativeBillingConfigured(){return billingSourcesEnabled()&&!!process.env.REVENUECAT_SECRET_KEY&&!!process.env.REVENUECAT_ENTITLEMENT_ID&&annualProducts().length>0&&(process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN?.length??0)>=32;}
export function nativeWebhookAuthorized(headers:Headers){
  const secret=process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN;if(!secret||secret.length<32)return false;
  const given=headers.get('authorization')??'',expected=`Bearer ${secret}`;
  return Buffer.byteLength(given)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(given),Buffer.from(expected));
}
export async function reconcileNativeMembership(owner:string){
  if(!nativeBillingConfigured())return;
  const users=await accountSql`SELECT id FROM "user" WHERE id=${owner} AND NOT EXISTS(SELECT 1 FROM b1_deletions WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT})`;
  if(!users[0])throw Error('Account is unavailable');
  const response=await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(owner)}`,{headers:{Authorization:`Bearer ${process.env.REVENUECAT_SECRET_KEY}`},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Store confirmation unavailable');
  const snapshot=nativeSnapshot(await response.json(),owner,process.env.REVENUECAT_ENTITLEMENT_ID!,annualProducts());
  for(const source of snapshot.sources)await saveBillingSource({...source,owner,processor:'revenuecat',priceId:null,observedAt:snapshot.observedAt});
  // A complete authoritative snapshot can revoke a removed entitlement. Never delete history.
  for(const previous of await billingSources(owner)){
    if(previous.provider==='stripe'||snapshot.sources.some(s=>s.provider===previous.provider&&s.environment===previous.environment&&s.subscriptionId===previous.subscriptionId))continue;
    await saveBillingSource({...previous,owner,processor:'revenuecat',status:'revoked',providerStatus:'entitlement-absent',renewalOff:true,graceUntil:null,
      productId:previous.subscriptionId.split(':').slice(2).join(':'),priceId:null,observedAt:snapshot.observedAt});
  }
}
const eventSchema=z.object({api_version:z.literal('1.0'),event:z.object({id:z.string().min(1).max(200),type:z.string().min(1).max(100),app_user_id:z.string().min(1).max(200),environment:z.enum(['SANDBOX','PRODUCTION']),event_timestamp_ms:z.number().int().positive()})});
export async function acceptNativeEvent(input:unknown){
  const {event}=eventSchema.parse(input),environment=event.environment==='PRODUCTION'?'production':'sandbox';
  const owners=await accountSql`SELECT id FROM "user" WHERE id=${event.app_user_id} AND NOT EXISTS(SELECT 1 FROM b1_deletions WHERE user_id=${event.app_user_id} AND product=${PERSONAL_PRODUCT})`;
  if(!owners[0])return;
  await accountSql`INSERT INTO b1_provider_events(provider,event_id,environment,payload) VALUES('revenuecat',${`${environment}:${event.id}`},${environment},${JSON.stringify({userId:event.app_user_id,type:event.type,occurredAt:event.event_timestamp_ms})}::jsonb) ON CONFLICT DO NOTHING`;
}
export async function processNativeQueue(limit=20){
  if(!nativeBillingConfigured())return 0;
  const rows=await accountSql`UPDATE b1_provider_events SET lease_until=now()+interval '3 minutes',attempts=attempts+1 WHERE provider='revenuecat' AND event_id IN
   (SELECT event_id FROM b1_provider_events WHERE provider='revenuecat' AND status IN ('pending','retry') AND next_at<=now() AND attempts<8 AND (lease_until IS NULL OR lease_until<=now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT ${limit}) RETURNING event_id,payload,attempts`;
  for(const row of rows){try{
    const deleted=await accountSql`SELECT 1 FROM b1_deletions WHERE user_id=${row.payload.userId} AND product=${PERSONAL_PRODUCT}`;
    if(!deleted[0])await reconcileNativeMembership(row.payload.userId);
    await accountSql`UPDATE b1_provider_events SET status='processed',lease_until=NULL,error=NULL WHERE provider='revenuecat' AND event_id=${row.event_id}`;
  }catch{await accountSql`UPDATE b1_provider_events SET status=CASE WHEN attempts>=8 THEN 'failed' ELSE 'retry' END,lease_until=NULL,error='Store reconciliation failed',next_at=now()+${Math.min(3600,30*2**row.attempts)}*interval '1 second' WHERE provider='revenuecat' AND event_id=${row.event_id}`;}}
  return rows.length;
}
