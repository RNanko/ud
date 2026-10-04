import 'server-only';
import { createHash } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { accountSql,accountSettings } from '../account/store';
import { cashString,cashMinor } from '../account/decimal';
import { serializeFinanceEntry,type FinanceEntry } from '../finance';
import { mergeFinanceCategories,type FinanceCategory } from '../finance-playground';
import { financeQuerySchema,financeWriteSchema } from './finance-contract';
import { MobileError } from './http';
function canonical(value:unknown):unknown{return Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;}
export async function readMobileFinance(owner:string,query:Record<string,string>={}){
 const settings=await accountSettings(owner),q=financeQuerySchema.parse(query),currency=q.currency??settings.preferences.financeDefaultCurrency;
 const values:unknown[]=[owner];const bind=(value:unknown)=>{values.push(value);return `$${values.length}`;};
 const conditions=['user_id=$1',currency==='unassigned'?'currency IS NULL':`currency=${bind(currency)}`];
 if(q.month!=='all')conditions.push(`to_char(date,'YYYY-MM')=${bind(q.month)}`);
 if(q.type!=='all')conditions.push(`CASE WHEN type='+' THEN '+' ELSE '-' END=${bind(q.type)}`);
 if(q.category)conditions.push(`COALESCE(category,'Uncategorized')=${bind(q.category)}`);
 if(q.search)conditions.push(`strpos(lower(concat_ws(' ',category,subcategory,comment,amount::text)),lower(${bind(q.search)}))>0`);
 const order={newest:'date DESC,id DESC',oldest:'date ASC,id ASC',highest:'amount DESC,id DESC',lowest:'amount ASC,id ASC',category:"COALESCE(category,'Uncategorized') ASC,date DESC,id DESC"}[q.sort];
 const limit=bind(q.size),offset=bind((q.page-1)*q.size);
 // One statement: version, exact summary, page and category metadata all use
 // the same MVCC snapshot. No downloaded subset is presented as a full total.
 const [row]=await accountSql.query(`WITH filtered AS (SELECT * FROM finance_table WHERE ${conditions.join(' AND ')}),page_rows AS (SELECT * FROM filtered ORDER BY ${order} LIMIT ${limit} OFFSET ${offset})
 SELECT COALESCE((SELECT revision::text FROM b1_mobile_finance_versions WHERE user_id=$1),'0') AS revision,
 (SELECT count(*)::text FROM filtered) AS total,
 COALESCE((SELECT sum(amount)::text FROM filtered WHERE type='+'),'0') AS revenue,
 COALESCE((SELECT sum(amount)::text FROM filtered WHERE type IS DISTINCT FROM '+'),'0') AS spending,
 COALESCE((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('amount',p.amount::text,'date',to_char(p.date,'YYYY-MM-DD')) ORDER BY ${order}) FROM page_rows p),'[]'::jsonb) AS entries,
 COALESCE((SELECT jsonb_agg(t) FROM (SELECT name,type,hidden FROM finance_categories WHERE user_id=$1 ORDER BY name) t),'[]'::jsonb) AS categories,
 COALESCE((SELECT jsonb_agg(t) FROM (SELECT DISTINCT category AS name,CASE WHEN type='+' THEN '+' ELSE '-' END AS type FROM finance_table WHERE user_id=$1 AND category IS NOT NULL ORDER BY category) t),'[]'::jsonb) AS inferred,
 COALESCE((SELECT jsonb_agg(t.currency) FROM (SELECT DISTINCT COALESCE(currency,'unassigned') AS currency FROM finance_table WHERE user_id=$1 ORDER BY currency) t),'[]'::jsonb) AS currencies,
 COALESCE((SELECT jsonb_agg(t.month) FROM (SELECT DISTINCT to_char(date,'YYYY-MM') AS month FROM finance_table WHERE user_id=$1 ORDER BY month DESC) t),'[]'::jsonb) AS months`,values);
 const revision=Number(row.revision),total=Number(row.total);if(!Number.isSafeInteger(revision)||!Number.isSafeInteger(total))throw new MobileError(503,'unavailable','Finance history requires server review.');
 if(q.expected!==undefined&&q.expected!==revision)throw new MobileError(409,'conflict','Finance changed during export. Reload and export again.');
 const stored=row.categories as FinanceCategory[],inferred=(row.inferred as {name:string;type:'+'|'-'}[]).map(item=>({category:item.name,type:item.type} as FinanceEntry));
 const revenue=cashMinor(row.revenue),spending=cashMinor(row.spending);
 return {revision,query:{...q,currency},total,entries:(row.entries as Parameters<typeof serializeFinanceEntry>[0][]).map(serializeFinanceEntry),summary:{revenue:cashString(revenue),spending:cashString(spending),balance:cashString(revenue-spending)},categories:mergeFinanceCategories(stored,inferred),hiddenCategories:stored.filter(c=>c.hidden),currencies:[...new Set([settings.preferences.financeDefaultCurrency,'PLN','EUR','USD',...row.currencies as string[]])],months:row.months};
}
export async function writeMobileFinance(owner:string,input:unknown){
 const payload=financeWriteSchema.parse(input),id='id' in payload.data?payload.data.id:'category';
 if(payload.data.kind==='category'&&!payload.data.hidden&&payload.data.name.length>60){
  const existing=await accountSql`SELECT 1 FROM finance_categories WHERE user_id=${owner} AND type=${payload.data.type} AND normalized_name=${payload.data.name.toLocaleLowerCase('en')} UNION ALL SELECT 1 FROM finance_table WHERE user_id=${owner} AND type=${payload.data.type} AND category=${payload.data.name} LIMIT 1`;
  if(!existing.length)throw new MobileError(400,'invalid','Use 60 characters or fewer for a new category.');
 }
 const hash=createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
 // Record ID prefix reserves created/deleted identities across later operations.
 const fingerprint=`id:${id}:${hash}`;
 const command=payload.data.kind==='category'?{...payload.data,normalized_name:payload.data.name.toLocaleLowerCase('en')}:payload.data;
 const [row]=await accountSql`SELECT b1_mobile_save_finance(${owner},${payload.operationId}::uuid,${fingerprint},${payload.revision},${JSON.stringify(command)}::jsonb) AS outcome`;
 const outcome=row?.outcome;
 if(outcome?.outcome==='unauthorized')throw new MobileError(401,'session','Sign in again.');
 if(outcome?.outcome==='conflict'||outcome?.outcome==='operation-reused')throw new MobileError(409,'conflict','Newer finance changes exist or this request ID was reused. Your entered values are retained. Reload and review before saving.');
 if(!['saved','duplicate'].includes(outcome?.outcome)||!Number.isSafeInteger(Number(outcome.revision)))throw Error('Unacknowledged Finance write');
 revalidateTag('finance-data',{expire:0});
 return {acknowledgedOperationId:payload.operationId,revision:Number(outcome.revision)};
}
