// Explicit owner-selected original DB setup. No QA fixture/tool fallback, auth
// bypass, legacy migration replay, billing/legal retirement or provider action.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { originalMobileMigrations } from './mobile-original-migrations.mjs';
const root = resolve(import.meta.dirname,'..');
neonConfig.webSocketConstructor = globalThis.WebSocket;
let stage = 'configuration';
async function main() {
  const expectedDatabase = process.argv.find(arg=>arg.startsWith('--expected-database='))?.slice('--expected-database='.length);
  if (expectedDatabase!=='neondb') throw Error('Explicit original selection required.');
  const connection = dotenv.parse(readFileSync(resolve(root,'.env'))).DATABASE_URL;
  const url = new URL(connection);
  if (!url.hostname.endsWith('.neon.tech') || decodeURIComponent(url.pathname.slice(1))!==expectedDatabase) throw Error('Original URL differs from the reviewed target.');
  const db = new Pool({ connectionString:connection,max:1,connectionTimeoutMillis:10000 });
  try { stage = process.argv.includes('--apply') ? 'additive-original-mobile-schema' : 'read-only-original-schema'; console.log(JSON.stringify(await originalMobileMigrations(db,root,{apply:process.argv.includes('--apply'),expectedDatabase}),null,2)); }
  finally { await db.end(); }
}
main().catch(error=>{ console.error('Original mobile setup stopped',{stage,code:error.code??null,reason:'Target, source hashes, permissions or preserved-data check failed. No credentials logged.'});process.exitCode=1; });
