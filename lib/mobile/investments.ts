import 'server-only';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { accountSql,accountSettings } from '../account/store';
import { investmentPositionSchemaForZone,type InvestmentPosition } from '../investments';
import { investmentMarket,getCryptoMarket } from '../investment-market';
import catalog from '../data/crypto-catalog.json';
import { MobileError } from './http';
import { investmentWriteSchema,investmentMarketQuery } from './investment-contract';
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;
export async function readMobileInvestments(owner:string){
 const [row]=await accountSql`SELECT COALESCE((SELECT revision FROM b1_mobile_investment_versions WHERE user_id=${owner}),0)::text AS revision,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'currency',p.currency,'kind',p.kind,'assetId',p.asset_id,'symbol',p.symbol,'name',p.name,
 'buyPrice',p.buy_price::text,'quantity',p.quantity::text,'boughtOn',to_char(p.bought_on,'YYYY-MM-DD'),'manualPrice',p.manual_price::text,
 'manualPriceAt',to_char(p.manual_price_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'archived',p.archived) ORDER BY p.bought_on DESC,p.id)
 FROM (SELECT * FROM investment_positions WHERE user_id=${owner} ORDER BY bought_on DESC,id LIMIT 2001) p),'[]'::jsonb) AS positions`;
 const revision=Number(row.revision);if(!Number.isSafeInteger(revision)||row.positions.length>2000)throw new MobileError(503,'unavailable','This portfolio requires a larger-history view. Open the website; no partial total is shown.');
 return {revision,positions:row.positions,assets:catalog.assets,catalogAt:catalog.updatedAt};
}
export async function readMobileInvestmentMarket(owner:string,query:unknown){
 const {ids}=investmentMarketQuery.parse(query),snapshot=await readMobileInvestments(owner),positions=snapshot.positions.filter((p:InvestmentPosition&{archived:boolean})=>!p.archived&&p.currency==='USD'&&ids.includes(p.id));
 return investmentMarket(positions);
}
export async function writeMobileInvestment(owner:string,input:unknown){
 const payload=investmentWriteSchema.parse(input),settings=await accountSettings(owner);
 const hash=createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex'),fingerprint=`id:${payload.data.id}:${hash}`;
 const [receipt]=await accountSql`SELECT fingerprint,acknowledged_revision::text AS revision FROM b1_mobile_investment_operations WHERE user_id=${owner} AND operation_id=${payload.operationId}::uuid`;
 if(receipt){if(receipt.fingerprint!==fingerprint)throw new MobileError(409,'conflict','This retry ID already belongs to another request.');if(!Number.isSafeInteger(Number(receipt.revision)))throw Error('Invalid investment receipt');return {acknowledgedOperationId:payload.operationId,revision:Number(receipt.revision)};}
 let data=payload.data;
 if(data.kind==='position'){
  const position=investmentPositionSchemaForZone(settings.preferences.timezone).parse(data.position);
  if(position.kind==='crypto'){
   let asset=catalog.assets.find(a=>a.id===position.assetId);
   if(!asset&&process.env.MANFORTH_MOBILE_QA_LOCAL!=='true')try{asset=(await getCryptoMarket()).assets.find(a=>a.id===position.assetId);}catch{/* Existing owned legacy assets remain editable during provider failure. */}
   if(asset){position.name=asset.name;position.symbol=asset.symbol;}
   else{
    const rows=await accountSql`SELECT name,symbol FROM investment_positions WHERE user_id=${owner} AND id=${data.id} AND asset_id=${position.assetId} AND kind='crypto' AND NOT archived`;
    if(data.create||!rows.length)throw new MobileError(400,'invalid','Choose an asset from the supported crypto list.');position.name=rows[0].name;position.symbol=rows[0].symbol;
   }
  }else position.assetId=null;
  if(position.kind==='crypto')position.manualPrice='';
  data={...data,position};
 }
 // Fingerprint the original immutable client envelope, before server metadata.
 const [row]=await accountSql`SELECT b1_mobile_save_investment(${owner},${payload.operationId}::uuid,${fingerprint},${payload.revision},${JSON.stringify(data)}::jsonb) AS outcome`;
 const result=row?.outcome;
 if(result?.outcome==='unauthorized')throw new MobileError(401,'session','Sign in again.');
 if(['conflict','operation-reused'].includes(result?.outcome))throw new MobileError(409,'conflict','Newer portfolio changes exist or the retry ID was reused. Your input is retained; reload and review.');
 if(!['saved','duplicate'].includes(result?.outcome)||!Number.isSafeInteger(Number(result.revision)))throw Error('Investment not acknowledged');
 revalidatePath('/account/investments');return {acknowledgedOperationId:payload.operationId,revision:Number(result.revision)};
}
