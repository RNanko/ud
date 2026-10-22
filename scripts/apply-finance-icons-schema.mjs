import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),name='0052_finance_category_icons.sql';
const normalize=value=>value.replaceAll('\r\n','\n').trim();
const body=value=>normalize(value.match(/AS \$\$([\s\S]*?)\$\$;/)?.[1]??'');
const suggestions={salary:'revenue:document_payment',freelance:'revenue:consulting',gifts:'revenue:gift_income',smoke:'spending:10_10_miscellaneous',eat:'spending:01_02_restaurants',study:'spending:08_06_education',out:'spending:05_09_events',clothes:'spending:06_01_clothing',payments:'spending:10_06_credit-card',servis:'spending:03_07_car-service',investment:'spending:10_02_investments',transport:'spending:03_03_public-transit',food:'spending:01_01_groceries',home:'spending:02_01_rent',shopping:'spending:06_09_shopping',health:'spending:04_10_wellness'};
export async function applyFinanceIconsSchema(db,{apply=false,expectedDatabase,account,expectedOwner}={}){
 const sql=readFileSync(resolve(root,'lib/db',name),'utf8'),old=readFileSync(resolve(root,'lib/db/0038_finance_currency_edit.sql'),'utf8');
 await db.query(apply?'BEGIN':'BEGIN READ ONLY');
 try{
  await db.query("SET LOCAL lock_timeout='5s'");await db.query("SET LOCAL statement_timeout='60s'");
  const {database}=(await db.query('SELECT current_database() AS database')).rows[0];
  if(expectedDatabase&&database!==expectedDatabase)throw Error('Database identity differs.');
  if(apply&&!expectedDatabase)throw Error('Apply requires explicit database.');
  if(apply)await db.query("SELECT pg_advisory_xact_lock(hashtext('finance-category-icons-schema'))");
  const [func]=(await db.query("SELECT prosrc,prosecdef,proconfig FROM pg_proc WHERE oid=to_regprocedure('public.b1_mobile_save_finance(text,uuid,text,bigint,jsonb)')")).rows;
  const ready=!!(await db.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='finance_categories' AND column_name='icon'")).rows.length;
  if(!func||func.prosecdef||func.proconfig||![body(old),body(sql)].includes(normalize(func.prosrc))||ready!==(normalize(func.prosrc)===body(sql)))throw Error('Finance schema differs; review required.');
  if(ready){
   if(!(await db.query("SELECT to_regclass('public.b1_schema_installations') AS table")).rows[0].table)throw Error('Finance schema receipt is missing; review required.');
   const receipt=(await db.query('SELECT checksum FROM b1_schema_installations WHERE name=$1',[name])).rows[0];
   if(receipt?.checksum!==createHash('sha256').update(normalize(sql)).digest('hex'))throw Error('Finance schema checksum differs; review required.');
  }
  if(apply&&!ready){
   if(db.exec)await db.exec(sql);else await db.query(sql);
   await db.query('CREATE TABLE IF NOT EXISTS b1_schema_installations(name text PRIMARY KEY,checksum text NOT NULL,installed_at timestamptz NOT NULL DEFAULT now())');
   await db.query('INSERT INTO b1_schema_installations(name,checksum) VALUES($1,$2)',[name,createHash('sha256').update(normalize(sql)).digest('hex')]);
  }
  let assignments=[],updated=0,owner;
  if(account){
   const users=(await db.query('SELECT id FROM "user" WHERE lower(email) LIKE $1',['%'+account.toLowerCase()+'%'])).rows;
   if(users.length!==1)throw Error('Account match is not unique.');owner=users[0].id;
   if(apply&&expectedOwner!==owner)throw Error('Account identity differs.');
   if(apply)await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE',[owner]);
   // Match the board: stored categories, inferred history categories, then defaults.
   const categories=(await db.query(`WITH candidates AS (
     SELECT name,type,0 AS priority FROM finance_categories WHERE user_id=$1 AND NOT hidden
     UNION ALL SELECT DISTINCT category,CASE WHEN type='+' THEN '+' ELSE '-' END,1 FROM finance_table WHERE user_id=$1 AND category IS NOT NULL AND trim(category)<>''
     UNION ALL SELECT name,type,2 FROM (VALUES ('Salary','+'),('Freelance','+'),('Gifts','+'),('Food','-'),('Transport','-'),('Home','-'),('Shopping','-'),('Health','-')) d(name,type)
    ), visible AS (SELECT DISTINCT ON (type,lower(trim(name))) name,type FROM candidates c
      WHERE NOT EXISTS(SELECT 1 FROM finance_categories h WHERE h.user_id=$1 AND h.hidden AND h.type=c.type AND h.normalized_name=lower(trim(c.name)))
      ORDER BY type,lower(trim(name)),priority)
    SELECT COALESCE(saved.id,'category:'||md5($1||':'||v.type||':'||lower(trim(v.name)))) AS id,v.name,v.type,${ready||apply?'saved.icon':'NULL::text'} AS "currentIcon"
    FROM visible v LEFT JOIN finance_categories saved ON saved.user_id=$1 AND saved.type=v.type AND saved.normalized_name=lower(trim(v.name)) ORDER BY v.type,v.name`,[owner])).rows;
   assignments=categories.map(c=>({...c,icon:suggestions[c.name.trim().toLowerCase()]??(c.type==='+'?'revenue:cashflow':'spending:10_10_miscellaneous')}));
   if(apply){
    const audit=async()=>(await db.query("SELECT count(*)::text AS count,md5(COALESCE(string_agg(to_jsonb(f)::text,'|' ORDER BY f.id),'')) AS fingerprint FROM finance_table f WHERE user_id=$1",[owner])).rows[0];
    const before=JSON.stringify(await audit());
    for(const c of assignments)updated+=(await db.query(`INSERT INTO finance_categories(id,user_id,name,normalized_name,type,hidden,icon) VALUES($1,$2,$3,lower(trim($3)),$4,false,$5)
     ON CONFLICT(user_id,type,normalized_name) DO UPDATE SET icon=EXCLUDED.icon WHERE finance_categories.icon IS DISTINCT FROM EXCLUDED.icon`,[c.id,owner,c.name,c.type,c.icon])).rowCount;
    if(before!==JSON.stringify(await audit()))throw Error('Transactions changed; rolled back.');
   }
  }
  await db.query('COMMIT');return {database,state:ready||apply?'ready':'pending',schemaApplied:apply&&!ready,owner,assignments,updated,transactionHistoryUnchanged:true};
 }catch(error){await db.query('ROLLBACK');throw error;}
}
async function main(){
 const args=process.argv.slice(2);if(args.some(a=>a!=='--apply'&&!a.startsWith('--expected-host=')&&!a.startsWith('--expected-database=')&&!a.startsWith('--account=')&&!a.startsWith('--expected-owner=')))throw Error('Unsupported argument.');
 const {default:env}=await import('@next/env');env.loadEnvConfig(root,true,{info(){},error(){}});
 const connectionString=process.env.DATABASE_URL?.trim();if(!connectionString)throw Error('Database unavailable.');const host=new URL(connectionString).hostname;
 if(args.includes('--apply')&&args.find(a=>a.startsWith('--expected-host='))?.slice(16)!==host)throw Error('Database host differs.');
 const {Pool,neonConfig}=await import('@neondatabase/serverless');neonConfig.webSocketConstructor=globalThis.WebSocket;
 const pool=new Pool({connectionString,max:1,connectionTimeoutMillis:10000});let db;
 try{db=await pool.connect();console.log(JSON.stringify({host,...await applyFinanceIconsSchema(db,{apply:args.includes('--apply'),expectedDatabase:args.find(a=>a.startsWith('--expected-database='))?.slice(20),account:args.find(a=>a.startsWith('--account='))?.slice(10),expectedOwner:args.find(a=>a.startsWith('--expected-owner='))?.slice(17)})}));}
 finally{db?.release();await pool.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(/^(Database|Finance schema|Apply|Account|Transactions|Unsupported)/.test(error.message)?error.message:'Finance icon setup failed. No credentials logged.');process.exitCode=1;});
