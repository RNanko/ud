import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
async function main(){
 const args=process.argv.slice(2), apply=args.includes('--apply');
 if(args.some(a=>a!=='--apply'&&!a.startsWith('--account=')&&!a.startsWith('--expected-owner=')&&!a.startsWith('--expected-host=')&&!a.startsWith('--expected-count=')))throw Error('Unsupported argument.');
 const account=args.find(a=>a.startsWith('--account='))?.slice(10);if(!account)throw Error('Account identifier required.');
 const {default:env}=await import('@next/env');env.loadEnvConfig(root,true,{info(){},error(){}});
 const connectionString=process.env.DATABASE_URL?.trim();if(!connectionString)throw Error('Database unavailable.');
 const host=new URL(connectionString).hostname;
 if(apply&&args.find(a=>a.startsWith('--expected-host='))?.slice(16)!==host)throw Error('Expected database host required.');
 const {Pool,neonConfig}=await import('@neondatabase/serverless');neonConfig.webSocketConstructor=globalThis.WebSocket;
 const pool=new Pool({connectionString,max:1,connectionTimeoutMillis:10000});let db;
 try{
  db=await pool.connect();await db.query(apply?'BEGIN':'BEGIN READ ONLY');
  await db.query("SET LOCAL lock_timeout='5s'");await db.query("SET LOCAL statement_timeout='30s'");
  const matches=(await db.query('SELECT id,name,email FROM "user" WHERE lower(email) LIKE $1 OR lower(name) LIKE $1',['%'+account.toLowerCase()+'%'])).rows;
  if(matches.length!==1){console.log(JSON.stringify({host,matches:matches.map(u=>({id:u.id,name:u.name,email:u.email}))}));throw Error('A unique account match is required.');}
  const user=matches[0],owner=user.id;
  const settings=(await db.query('SELECT preferences,revision FROM b1_account_settings WHERE user_id=$1 AND product=$2',[owner,'b1-way-personal'])).rows[0];
  const inventory=(await db.query("SELECT currency,count(*)::int AS count,min(date)::text AS first,max(date)::text AS last FROM finance_table WHERE user_id=$1 GROUP BY currency ORDER BY currency NULLS FIRST",[owner])).rows;
  const currentMonth=(await db.query("SELECT to_char(now() AT TIME ZONE $1,'YYYY-MM') AS month",[settings?.preferences?.timezone??'Europe/Warsaw'])).rows[0].month;
  const monthly=(await db.query("SELECT to_char(date,'YYYY-MM') AS month,currency,count(*)::int AS count FROM finance_table WHERE user_id=$1 GROUP BY 1,2 ORDER BY 1 DESC,2",[owner])).rows;
  const total=inventory.reduce((sum,row)=>sum+row.count,0);
  if(apply){
   if(args.find(a=>a.startsWith('--expected-owner='))?.slice(17)!==owner||Number(args.find(a=>a.startsWith('--expected-count='))?.slice(17))!==total)throw Error('Account or transaction count differs.');
   await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE',[owner]);
   await db.query('INSERT INTO b1_mobile_finance_versions(user_id,revision) VALUES($1,0) ON CONFLICT DO NOTHING',[owner]);
   await db.query('SELECT user_id FROM b1_mobile_finance_versions WHERE user_id=$1 FOR UPDATE',[owner]);
   await db.query('SELECT id FROM finance_table WHERE user_id=$1 FOR UPDATE',[owner]);
   if((await db.query('SELECT count(*)::int AS count FROM finance_table WHERE user_id=$1',[owner])).rows[0].count!==total)throw Error('Transaction count changed. Rolled back.');
   const audit=async()=>createHash('sha256').update(JSON.stringify((await db.query("SELECT to_jsonb(f)-'currency' AS data FROM finance_table f WHERE user_id=$1 ORDER BY id",[owner])).rows)).digest('hex');
   const before=await audit();
   const changed=await db.query("UPDATE finance_table SET currency='PLN' WHERE user_id=$1 AND currency IS DISTINCT FROM 'PLN'",[owner]);
   if(before!==await audit())throw Error('Transaction details changed. Rolled back.');
   const invalid=(await db.query("SELECT count(*)::int AS count FROM finance_table WHERE user_id=$1 AND currency IS DISTINCT FROM 'PLN'",[owner])).rows[0].count;
   if(invalid)throw Error('Currency verification failed.');
   console.log(JSON.stringify({host,owner,updated:changed.rowCount,total,currency:'PLN',amountsAndOtherFieldsUnchanged:true}));
  }else console.log(JSON.stringify({host,user,defaultCurrency:settings?.preferences?.financeDefaultCurrency??'USD',settingsRevision:settings?.revision,currentMonth,total,inventory,monthly}));
  await db.query('COMMIT');
 }catch(error){if(db)await db.query('ROLLBACK');throw error;}finally{db?.release();await pool.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(/^(Unsupported|Account|A unique|Expected|Transaction|Currency|Database)/.test(error.message)?error.message:'Finance repair failed. No credentials logged.');process.exitCode=1;});
