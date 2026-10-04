// Explicit additive upgrade of the already provisioned QA database only.
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import dotenv from 'dotenv';
import {Pool} from '@neondatabase/serverless';
import {verifyQaConnection,QA_DATABASE,QA_ROLE} from './mobile-qa-connection.mjs';
const root=resolve(import.meta.dirname,'..');
async function main(){
 if(!process.argv.includes('--apply-mobile-momentum')||!process.argv.includes('--provisioning-from-web-env')||process.env.NODE_ENV==='production'||process.env.VERCEL_ENV==='production')throw Error('Explicit local isolated P4.2 Momentum upgrade flags required.');
 const qa=dotenv.parse(readFileSync(resolve(root,'.env.mobile-qa.local'))),app=dotenv.parse(readFileSync(resolve(root,'.env')));if(qa.QA_DATABASE_ISOLATED!=='true')throw Error('Isolation assertion required.');
 console.log('Verified restricted QA connection',await verifyQaConnection(qa.QA_DATABASE_URL));
 const target=new URL(app.DATABASE_URL),runtime=new URL(qa.QA_DATABASE_URL);if(target.hostname!==runtime.hostname||decodeURIComponent(target.pathname.slice(1))===QA_DATABASE)throw Error('QA provisioning separation differs.');target.pathname=`/${QA_DATABASE}`;
 const db=new Pool({connectionString:target.href,max:1,connectionTimeoutMillis:10000});
 try{
  if((await db.query('SELECT current_database() AS name')).rows[0].name!==QA_DATABASE)throw Error('Actual database differs.');
  const names=readdirSync(resolve(root,'lib/db')).filter(n=>/^\d{4}_.+\.sql$/.test(n)&&Number(n.slice(0,4))<=35&&!['0028_cross_platform_billing.sql','0030_cross_platform_billing.sql'].includes(n)).sort();
  if(names.length!==34||names[30]!=='0032_registration_birth_date.sql'||names[31]!=='0033_mobile_investments.sql'||names[32]!=='0034_mobile_momentum.sql'||names[33]!=='0035_mobile_momentum_receipt_order.sql')throw Error('Unexpected reviewed migration sequence.');
  const files=names.map(name=>({name,hash:createHash('sha256').update(readFileSync(resolve(root,'lib/db',name))).digest('hex')}));
  await db.query('BEGIN');try{
   await db.query("SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='10s'");await db.query('LOCK TABLE b1_mobile_qa_metadata.migrations IN EXCLUSIVE MODE');
   const applied=(await db.query('SELECT name,hash FROM b1_mobile_qa_metadata.migrations ORDER BY name')).rows;
   if(![32,33,34].includes(applied.length)||JSON.stringify(applied)!==JSON.stringify(files.slice(0,applied.length)))throw Error('Applied migration hashes differ; no change made.');
   for(const file of files.slice(applied.length)){await db.query(readFileSync(resolve(root,'lib/db',file.name),'utf8'));await db.query('INSERT INTO b1_mobile_qa_metadata.migrations(name,hash) VALUES($1,$2)',[file.name,file.hash]);}
   await db.query(`GRANT SELECT,INSERT,UPDATE ON momentum_state,b1_mobile_momentum_operations,b1_mobile_momentum_identities TO ${QA_ROLE}`);
   await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}
  const receiptRights=(await db.query("SELECT bool_and(has_table_privilege($1,t.name,p.name)) AS writable,bool_or(has_table_privilege($1,t.name,'DELETE')) AS deletable FROM (VALUES('b1_mobile_momentum_operations'),('b1_mobile_momentum_identities')) t(name) CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE')) p(name)",[QA_ROLE])).rows[0];
  if(!receiptRights.writable||receiptRights.deletable)throw Error('QA receipt permissions require review.');
  console.log('PASS: 34 selected hashes verified/applied only in qa_tablename; additive Momentum durable receipts and stable identity claims. Restricted runtime has no receipt DELETE; existing records/trials and production grants are preserved.');
 }finally{await db.end();}
}
main().catch(error=>{console.error('P4.2 Momentum QA upgrade stopped',{name:error.name,code:error.code??null,reason:error.code?'Scoped QA operation failed.':error.message});process.exitCode=1;});
