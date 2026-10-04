// API/history probe only. Timings are local-development observations, not
// native rendering benchmarks or a production capacity certification.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { verifyQaConnection } from './mobile-qa-connection.mjs';
import { qaFixturePath } from './mobile-qa-fixtures.mjs';
import { moduleLoader } from '../../ud-mobile/tests/helpers.mjs';
const root=resolve(import.meta.dirname,'..'),local=dotenv.parse(readFileSync(resolve(root,'.env.mobile-qa.local')));
if(local.QA_DATABASE_ISOLATED!=='true')throw Error('QA isolation assertion required.');
const accounts=JSON.parse(readFileSync(qaFixturePath(root,'fixture-accounts-phase3-recovery.json'))),alex=accounts.find(a=>a.id.endsWith('-alex')),origin='http://localhost:3001';
const {collectFinanceCsv}=moduleLoader()(resolve(root,'../ud-mobile/src/services/finance-export.ts'));
let stage='identity';
async function main(){
 await verifyQaConnection(local.QA_DATABASE_URL);assert.ok(/^qa-mobile-[a-f0-9]{16}-alex$/.test(alex.id)&&alex.email.endsWith('@example.invalid'));
 const auth=await fetch(`${origin}/api/auth/sign-in/email`,{method:'POST',headers:{'content-type':'application/json','expo-origin':'udmobile://'},body:JSON.stringify({email:alex.email,password:alex.password}),signal:AbortSignal.timeout(60000)});assert.equal(auth.status,200);
 const cookie=auth.headers.getSetCookie().map(line=>line.split(';')[0]).join('; '),read=async path=>{const r=await fetch(`${origin}/api/mobile/v1/${path}`,{headers:{Cookie:cookie,'expo-origin':'udmobile://'},signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);return (await r.json()).data;};
 stage='additive labelled synthetic history';const label=`QA history ${randomUUID()}`,rows=Array.from({length:1200},(_,i)=>({id:randomUUID(),date:`2035-${String(i%12+1).padStart(2,'0')}-02`,amount:'0.10',category:`${label} ${i%100}`,subcategory:'Synthetic performance probe',type:i%2?'+':'-',comment:'Isolated P3.4 history; preserved for repeat inspection'}));
 const sql=neon(local.QA_DATABASE_URL);await sql.query(`INSERT INTO finance_table(id,user_id,date,amount,currency,category,subcategory,type,comment)
 SELECT r.id,$1,r.date::date,r.amount::numeric,'USD',r.category,r.subcategory,r.type,r.comment
 FROM jsonb_to_recordset($2::jsonb) AS r(id text,date text,amount text,category text,subcategory text,type text,comment text)`,[alex.id,JSON.stringify(rows)]);
 stage='bounded page and exact whole-history totals';const query={currency:'USD',search:label},path=`finance?currency=USD&search=${encodeURIComponent(label)}&size=20`;
 const started=performance.now(),data=await read(path),pageMs=Math.round(performance.now()-started),pageBytes=Buffer.byteLength(JSON.stringify(data));assert.equal(data.total,1200);assert.equal(data.entries.length,20);assert.equal(data.summary.revenue,'60.00');assert.equal(data.summary.spending,'60.00');assert.equal(data.summary.balance,'0.00');assert.equal(data.categories.filter(c=>c.name.startsWith(label)).length,100);
 stage='all-page export';const exportStarted=performance.now(),csv=await collectFinanceCsv(read,query,()=>true);assert.equal(csv.count,1200);assert.equal(csv.text.split('\r\n').length,1202);const exportMs=Math.round(performance.now()-exportStarted);
 console.log('PASS: 1,200 real synthetic transactions / 100 history categories / 12 months; 20-row page, exact totals and complete 12-page CSV',{pageMs,pageBytes,exportMs,csvBytes:Buffer.byteLength(csv.text)});
 console.log('Native list rendering, memory, keyboard and frame performance remain unverified. Earlier records and trials are preserved.');
}
main().catch(error=>{console.error('History probe stopped',{stage,code:error.code??null,reason:error.code?'Restricted QA operation failed.':error.message});process.exitCode=1;});
