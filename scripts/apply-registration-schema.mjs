import {readFileSync} from 'node:fs';
import nextEnv from '@next/env';
import {neon} from '@neondatabase/serverless';
nextEnv.loadEnvConfig(process.cwd());
if(!process.argv.includes('--apply'))throw Error('Use --apply for the requested additive registration migration');
let stage='configuration';
try{
 if(!process.env.DATABASE_URL)throw Error('Database is not configured');
 const sql=neon(process.env.DATABASE_URL);
 const audit=()=>sql.query(`SELECT count(*)::int AS users,md5(string_agg((to_jsonb(u)-'date_of_birth')::text,'|' ORDER BY id)) AS fingerprint FROM "user" u`);
 stage='migration';
 const [before,,after]=await sql.transaction([audit(),sql.query(readFileSync('lib/db/0032_registration_birth_date.sql','utf8')),audit()]);
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Existing account audit requires review');
 console.log(JSON.stringify({migrationApplied:'0032_registration_birth_date',existingAccountsPreserved:true,existingUserCount:after[0].users}));
}catch(error){console.error(JSON.stringify({registrationMigrationFailed:true,stage,code:error.code??null}));process.exitCode=1;}
