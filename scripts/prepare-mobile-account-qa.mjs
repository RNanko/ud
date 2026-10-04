// Basic QA account permissions only. No DELETE grants or RLS changes.
import {readFileSync,readdirSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';import dotenv from 'dotenv';import {Pool} from '@neondatabase/serverless';import {verifyQaConnection,QA_DATABASE,QA_ROLE} from './mobile-qa-connection.mjs';
const root=resolve(import.meta.dirname,'..');
async function main(){
 if(!process.argv.includes('--prepare-mobile-account')||!process.argv.includes('--provisioning-from-web-env')||process.env.NODE_ENV==='production'||process.env.VERCEL_ENV==='production')throw Error('Explicit isolated account setup flags required.');
 const qa=dotenv.parse(readFileSync(resolve(root,'.env.mobile-qa.local'))),app=dotenv.parse(readFileSync(resolve(root,'.env')));if(qa.QA_DATABASE_ISOLATED!=='true')throw Error('QA assertion missing.');
 console.log('Verified QA runtime',await verifyQaConnection(qa.QA_DATABASE_URL));
 const runtime=new URL(qa.QA_DATABASE_URL),target=new URL(qa.NEON_PROVISIONING_DATABASE_URL||app.DATABASE_URL);if(target.hostname!==runtime.hostname)throw Error('Provisioning branch differs.');target.pathname='/'+QA_DATABASE;
 const db=new Pool({connectionString:target.href,max:1,connectionTimeoutMillis:10000});
 try{if((await db.query('SELECT current_database() AS name')).rows[0].name!==QA_DATABASE)throw Error('Wrong actual database.');
 const names=readdirSync(resolve(root,'lib/db')).filter(n=>/^\d{4}_.+\.sql$/.test(n)&&Number(n.slice(0,4))<=35&&!['0028_cross_platform_billing.sql','0030_cross_platform_billing.sql'].includes(n)).sort(),expected=names.map(name=>({name,hash:createHash('sha256').update(readFileSync(resolve(root,'lib/db',name))).digest('hex')}));
 const applied=(await db.query('SELECT name,hash FROM b1_mobile_qa_metadata.migrations ORDER BY name')).rows;if(expected.length!==34||JSON.stringify(applied)!==JSON.stringify(expected))throw Error('Applied migration ledger differs; no grants changed.');
 await db.query('BEGIN');try{
 await db.query(`GRANT SELECT ON public.user_notes,public.quote_likes,public.quotes,public.b1_email_attempts,public.b1_email_ledgers,public.b1_email_outbox,public.b1_email_suppressions TO ${QA_ROLE}`);
 await db.query(`GRANT INSERT,UPDATE ON public.b1_email_attempts,public.b1_email_ledgers,public.b1_email_outbox,public.b1_deletions TO ${QA_ROLE}`);
 await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}
 console.log('PASS: QA-only export/proof/pending-deletion grants; NO DELETE grants or RLS changes.');
 }finally{await db.end();}
 console.log('Verified effective role after setup',await verifyQaConnection(qa.QA_DATABASE_URL));
}
main().catch(e=>{console.error('Account QA setup stopped',{code:e.code??null,reason:e.code?'Scoped QA permission setup failed.':e.message});process.exitCode=1;});
