import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mobileDevEnvironment } from './mobile-dev-environment.mjs';
import { verifyQaConnection } from './mobile-qa-connection.mjs';
const require = createRequire(import.meta.url);
try {
  const { loadEnvConfig } = require('@next/env');
  const root = resolve(import.meta.dirname, '..');
  const qaPath = resolve(root, '.env.mobile-qa.local');
  const local = existsSync(qaPath) ? require('dotenv').parse(readFileSync(qaPath)) : {};
  const options = Object.fromEntries(['QA_DATABASE_URL', 'QA_DATABASE_ISOLATED', 'MOBILE_DEV_APP_ORIGIN'].map(key => [key, process.env[key] ?? local[key]]));
  const { combinedEnv } = loadEnvConfig(root, true, { info() {}, error() {} });
  // Validate target separation BEFORE generating secrets, spawning Next, or
  // constructing any database client. No migration/fixture/provider action.
  const checked = mobileDevEnvironment(combinedEnv, options, 'validation-only-placeholder-at-least-32-characters');
  console.log('Verified QA runtime connection', await verifyQaConnection(checked.env.DATABASE_URL));
  const secretPath = resolve(root, '.mobile-dev', 'auth-secret');
  mkdirSync(resolve(root, '.mobile-dev'), { recursive: true });
  if (!existsSync(secretPath)) writeFileSync(secretPath, randomBytes(48).toString('base64url'), { flag: 'wx', mode: 0o600 });
  const emailSecretPath=resolve(root,'.mobile-dev','email-secret');
  if(!existsSync(emailSecretPath))writeFileSync(emailSecretPath,randomBytes(48).toString('base64url'),{flag:'wx',mode:0o600});
  options.EMAIL_QA_PROTECTION_SECRET=readFileSync(emailSecretPath,'utf8').trim();
  const configured = mobileDevEnvironment(combinedEnv, options, readFileSync(secretPath, 'utf8').trim());
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '0.0.0.0', '--port', String(configured.port)], { cwd: root, env: configured.env, stdio: 'inherit', windowsHide: true });
  child.on('exit', code => { process.exitCode = code ?? 1; });
  child.on('error', () => { console.error('The isolated development server could not start.'); process.exitCode = 1; });
} catch (error) {
  // Validation messages contain no credentials or endpoint values.
  console.error(error.message); process.exitCode = 1;
}
