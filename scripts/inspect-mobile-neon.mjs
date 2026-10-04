// Read-only catalog probe. Never treats a PostgreSQL URL as a Neon API key.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { neon, Pool, neonConfig } from '@neondatabase/serverless';

const root = resolve(import.meta.dirname, '..');
const qaPath = resolve(root, '.env.mobile-qa.local');
const local = existsSync(qaPath) ? dotenv.parse(readFileSync(qaPath)) : {};
// Explicit operator selection only; never a missing-QA fallback for tests/API.
const explicitWebProvisioning = process.argv.includes('--provisioning-from-web-env');
const connection = explicitWebProvisioning
  ? dotenv.parse(readFileSync(resolve(root, '.env'))).DATABASE_URL
  : process.env.NEON_PROVISIONING_DATABASE_URL || local.NEON_PROVISIONING_DATABASE_URL;
try {
  if (!connection) throw Error('An explicit NEON_PROVISIONING_DATABASE_URL is required. No application connection fallback is permitted.');
  const endpoint = new URL(connection);
  if (!endpoint.hostname.endsWith('.neon.tech')) throw Error('Unsupported provisioning endpoint.');
  console.log('Provisioning target', { endpoint: endpoint.hostname, database: decodeURIComponent(endpoint.pathname.slice(1)) });
  const sql = neon(connection);
  const identity = await sql.query('SELECT current_database() AS database, current_user AS role, rolcreatedb AS create_database, rolcreaterole AS create_role FROM pg_roles WHERE rolname=current_user');
  const qa = await sql.query("SELECT datname,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname='qa_tablename'");
  console.log('HTTP catalog probe', { identity, qa });
  neonConfig.webSocketConstructor = globalThis.WebSocket;
  const pool = new Pool({ connectionString: connection, connectionTimeoutMillis: 10000 });
  try {
    console.log('WebSocket catalog probe', (await pool.query('SELECT current_database() AS database')).rows);
  } finally { await pool.end(); }
} catch (error) {
  console.error(connection ? 'Catalog probe failed' : 'Configure NEON_PROVISIONING_DATABASE_URL in the ignored ud-1/.env.mobile-qa.local file or process environment.', { name: error.name, code: error.code ?? null });
  process.exitCode = 1;
}
