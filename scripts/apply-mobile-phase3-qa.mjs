// Scoped QA upgrades and owner-authorized synthetic legal registry retirement.
// No database/account reset or production operation; other records are preserved.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { Pool, neon } from '@neondatabase/serverless';
import { verifyQaConnection, QA_DATABASE, QA_ROLE } from './mobile-qa-connection.mjs';
import { prepareQaLegalRetirement, legalTables } from './mobile-qa-legal-retirement.mjs';
const root=resolve(import.meta.dirname,'..');let stage='configuration';
async function main(){
 if(!process.argv.includes('--apply-mobile-phase3')||!process.argv.includes('--provisioning-from-web-env')||process.env.NODE_ENV==='production'||process.env.VERCEL_ENV==='production')throw Error('Explicit local QA additive-upgrade flags required.');
 const qa=dotenv.parse(readFileSync(resolve(root,'.env.mobile-qa.local'))),app=dotenv.parse(readFileSync(resolve(root,'.env')));
 if(qa.QA_DATABASE_ISOLATED!=='true')throw Error('QA isolation assertion missing.');
 console.log('Restricted QA transport verified',await verifyQaConnection(qa.QA_DATABASE_URL));
 const source=new URL(app.DATABASE_URL),runtime=new URL(qa.QA_DATABASE_URL);
 if(source.hostname!==runtime.hostname||decodeURIComponent(source.pathname.slice(1))===QA_DATABASE)throw Error('Provisioning endpoint/database separation differs.');
 source.pathname=`/${QA_DATABASE}`;
 const db=new Pool({connectionString:source.href,max:1,connectionTimeoutMillis:10000});
 try{
  stage='real QA identity';if((await db.query('SELECT current_database() AS name')).rows[0].name!==QA_DATABASE)throw Error('QA identity mismatch.');
  const names=readdirSync(resolve(root,'lib/db')).filter(n=>/^\d{4}_.+\.sql$/.test(n)&&Number(n.slice(0,4))<=31&&!['0028_cross_platform_billing.sql','0030_cross_platform_billing.sql'].includes(n)).sort();
  if(names.length!==30||names[26]!=='0026_mobile_events.sql'||names[27]!=='0027_static_legal_pages.sql'||names[28]!=='0029_mobile_gym.sql'||names[29]!=='0031_mobile_finance.sql')throw Error('Unexpected migration sequence.');
  const files=names.map(name=>{const sql=readFileSync(resolve(root,'lib/db',name),'utf8');return {name,sql,hash:createHash('sha256').update(sql).digest('hex')};});
  const applied=(await db.query('SELECT name,hash FROM b1_mobile_qa_metadata.migrations ORDER BY name')).rows;
  if(applied.length>30){
   if(JSON.stringify(applied.slice(0,30))!==JSON.stringify(files.map(({name,hash})=>({name,hash}))))throw Error('Phase 3 prefix hashes differ; no changes made.');
   console.log('Phase 3 prefix is already present. Later QA migrations exist; use apply-mobile-phase4-qa.mjs to verify them. No grants or records changed.');return;
  }
  if(![26,27,28,29,30].includes(applied.length)||JSON.stringify(applied)!==JSON.stringify(files.slice(0,applied.length).map(({name,hash})=>({name,hash}))))throw Error('Prior migration hashes do not match; no changes made.');
  if(applied.length<28&&!process.argv.includes('--retire-qa-legal-tables'))throw Error('Explicit --retire-qa-legal-tables is required for the owner-approved static policy transition.');
  stage='additive migration';await db.query('BEGIN');
  try{
   await db.query("SET LOCAL statement_timeout='20s'; SET LOCAL lock_timeout='10s'");
   for(const file of files.slice(applied.length)){
    const retirement=file.name==='0027_static_legal_pages.sql'?await prepareQaLegalRetirement(db,root):null;
    await db.query(file.sql);
    if(retirement)console.log('QA-only legal retirement verified',{archivedSyntheticRows:retirement.count,unchangedApplicationTables:await retirement.verifyRetained()});
    await db.query('INSERT INTO b1_mobile_qa_metadata.migrations(name,hash) VALUES($1,$2)',[file.name,file.hash]);
   }
   // Only new QA objects and canonical preset planning writes. No production
   // grant is changed and no runtime administrator credential is stored.
   await db.query(`GRANT SELECT,INSERT,UPDATE ON b1_mobile_event_versions,b1_mobile_event_operations TO ${QA_ROLE}; REVOKE DELETE ON b1_mobile_event_versions,b1_mobile_event_operations FROM ${QA_ROLE}; GRANT INSERT,UPDATE ON gym_plans TO ${QA_ROLE}`);
   await db.query(`GRANT SELECT,INSERT,UPDATE ON b1_mobile_gym_operations,gym_entities,gym_plans,gym_sessions,gym_rest_days TO ${QA_ROLE}; REVOKE DELETE ON b1_mobile_gym_operations,gym_entities,gym_plans,gym_sessions,gym_rest_days FROM ${QA_ROLE}`);
   await db.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON finance_table TO ${QA_ROLE}; GRANT SELECT,INSERT,UPDATE ON finance_categories,b1_mobile_finance_versions,b1_mobile_finance_operations TO ${QA_ROLE}; REVOKE DELETE ON finance_categories,b1_mobile_finance_versions,b1_mobile_finance_operations FROM ${QA_ROLE}`);
   await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}
  const remaining=(await db.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1::text[])",[legalTables])).rows[0].count;
  if(remaining)throw Error('Legal registry tables remain; review QA migration state.');
  console.log('PASS: 30 migration hashes verified on qa_tablename; six legal tables absent; application records preserved.');
  const permissions=(await neon(qa.QA_DATABASE_URL).query("SELECT bool_and(has_table_privilege(current_user,t.name,p.privilege)) AS can_write, bool_or(has_table_privilege(current_user,t.name,'DELETE')) AS can_delete FROM (VALUES('b1_mobile_event_versions'),('b1_mobile_event_operations')) t(name) CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE')) p(privilege)"))[0];
  if(!permissions.can_write||permissions.can_delete)throw Error('Effective QA Events permissions require review.');
  console.log('PASS: runtime can read/write Events revisions and receipts, without deleting them.');
  const gymPermissions=(await neon(qa.QA_DATABASE_URL).query("SELECT bool_and(has_table_privilege(current_user,t.name,p.privilege)) AS can_write, bool_or(has_table_privilege(current_user,t.name,'DELETE')) AS can_delete FROM (VALUES('b1_mobile_gym_operations'),('gym_entities'),('gym_plans'),('gym_sessions'),('gym_rest_days')) t(name) CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE')) p(privilege)"))[0];
  if(!gymPermissions.can_write||gymPermissions.can_delete)throw Error('Effective QA Gym permissions require review.');
  console.log('PASS: restricted Gym writes/receipts are available, without DELETE or DDL privileges.');
  const financePermissions=(await neon(qa.QA_DATABASE_URL).query("SELECT bool_and(has_table_privilege(current_user,t.name,p.privilege)) AS can_write,bool_or(has_table_privilege(current_user,t.name,'DELETE')) AS can_delete FROM (VALUES('b1_mobile_finance_versions'),('b1_mobile_finance_operations'),('finance_categories')) t(name) CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE')) p(privilege)"))[0];
  const deleteEntry=(await neon(qa.QA_DATABASE_URL).query("SELECT has_table_privilege(current_user,'finance_table','SELECT,INSERT,UPDATE,DELETE') AS allowed"))[0];
  if(!financePermissions.can_write||financePermissions.can_delete||!deleteEntry.allowed)throw Error('Effective QA Finance permissions require review.');
  console.log('PASS: canonical Finance CRUD available; category tombstones/revisions/receipts cannot be deleted by runtime.');
 }finally{await db.end();}
}
main().catch(error=>{console.error('QA upgrade stopped',{stage,code:error.code??null,reason:error.code?'Scoped database operation failed; no production action was attempted.':error.message});process.exitCode=1;});
