import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import nextEnv from '@next/env';
import {neon} from '@neondatabase/serverless';
nextEnv.loadEnvConfig(process.cwd());
if(!process.argv.includes('--apply'))throw Error('Use --apply only for the requested additive application migration');
const sql=neon(process.env.DATABASE_URL);
let stage='audit-before';
try{
 const audit=()=>sql`SELECT count(*)::int AS accounts, count(subscription_id)::int AS stripe_mappings, count(trial_started_at)::int AS trials, md5(string_agg(m::text,'|' ORDER BY user_id,product)) AS fingerprint FROM b1_memberships m`;
 const before=await audit();
 stage='migration';
 const statements=readFileSync('lib/db/0030_cross_platform_billing.sql','utf8').replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean);
 await sql.transaction(statements.map(statement=>sql.query(statement)));
 stage='audit-after';
 const after=await audit();
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Membership migration audit requires review');
 const local=new URL(process.env.APP_URL||'http://localhost:3000').hostname==='localhost';
 const mode=process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')?'production':'test';
 if(mode==='test'&&!local)throw Error('Nonproduction billing configuration is restricted to local runtime');
 stage='environment';let text=readFileSync('.env','utf8');
 for(const [key,value] of Object.entries({B1_BILLING_SOURCES_ENABLED:'true',B1_BILLING_ENVIRONMENT:mode})){
  const line=`${key}=${value}`,pattern=new RegExp(`^${key}=.*$`,'m');text=pattern.test(text)?text.replace(pattern,line):text.trimEnd()+`\n${line}\n`;
 }
 writeFileSync('.env.billing-pending',text,{mode:0o600});renameSync('.env.billing-pending','.env');
 const {fingerprint,...counts}=after[0];void fingerprint;
 console.log(JSON.stringify({migrationApplied:'0030_cross_platform_billing',membershipRecordsPreserved:true,counts,sourcesEnabled:true}));
}catch(error){console.error(JSON.stringify({migrationFailed:true,stage,code:error.code??null}));process.exitCode=1;}
