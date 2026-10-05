import { qaDatabaseUrl } from './qa-database.mjs';

export function mobileDevEnvironment(application, options, authSecret) {
  const database = qaDatabaseUrl({ ...application, QA_DATABASE_URL: options.QA_DATABASE_URL, QA_DATABASE_ISOLATED: options.QA_DATABASE_ISOLATED });
  const endpoint = new URL(database);
  // This launcher retains the existing Neon HTTP + transactional WS adapters.
  // Plain local PostgreSQL needs a reviewed compatible proxy, not a guessed URL.
  if (!endpoint.hostname.endsWith('.neon.tech')) throw Error('The existing Neon driver requires an isolated Neon-compatible endpoint. Plain local PostgreSQL/proxy setup is not verified in this checkpoint.');
  const origin = new URL(options.MOBILE_DEV_APP_ORIGIN || 'http://localhost:3001');
  if (origin.protocol !== 'http:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw Error('MOBILE_DEV_APP_ORIGIN must be a plain local HTTP origin.');
  const hostname = origin.hostname;
  if (!['localhost', '127.0.0.1', '10.0.2.2'].includes(hostname) && !/^10\./.test(hostname) && !/^192\.168\./.test(hostname) && !/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) throw Error('The development API must run on a local/ private-network host.');
  const port = Number(origin.port || 80);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Use an explicit local port between 1024 and 65535.');
  if (typeof authSecret !== 'string' || authSecret.length < 32) throw Error('A separate local auth secret is required.');
  // Empty inherited application variables stop Next from silently loading web
  // provider credentials from .env. Only host runtime essentials are retained.
  const env = Object.fromEntries(Object.keys(application).map(key => [key, '']));
  for (const key of ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'ComSpec', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE', 'HOME', 'HOMEDRIVE', 'HOMEPATH', 'ProgramFiles', 'ProgramFiles(x86)', 'NUMBER_OF_PROCESSORS']) if (application[key]) env[key] = application[key];
  // These facts are already public policy copy, not provider credentials. Keep
  // the QA pages representative without inheriting the web environment wholesale.
  for (const key of ['LEGAL_OPERATOR_NAME','LEGAL_OPERATOR_FORM','LEGAL_OPERATOR_COUNTRY','LEGAL_OPERATOR_ADDRESS','LEGAL_CONTACT_EMAIL','LEGAL_OPERATOR_REGISTRATION','LEGAL_OPERATOR_REGISTRATION_STATUS','LEGAL_OPERATOR_TAX','LEGAL_OPERATOR_TAX_STATUS']) if (application[key]) env[key] = application[key];
  Object.assign(env, {
    NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: database,
    APP_URL: origin.origin, BETTER_AUTH_URL: origin.origin, BETTER_AUTH_SECRET: authSecret,
    MANFORTH_MOBILE_API_ENABLED: 'true', MANFORTH_MOBILE_QA_LOCAL: 'true', B1_WAY_ENFORCE_MEMBERSHIP: 'true', SOCIAL_PASSWORD_MIGRATION_COMPLETE: 'true',
    // Pin out-of-phase providers even if a new variable is later added to .env.
    B1_BILLING_SOURCES_ENABLED:'false', B1_BILLING_ENVIRONMENT:'test',
    STRIPE_SECRET_KEY:'', RESEND_API_KEY:'', REVENUECAT_SECRET_KEY:'', REVENUECAT_ENTITLEMENT_ID:'', REVENUECAT_ANNUAL_PRODUCT_IDS:'', REVENUECAT_WEBHOOK_AUTH_TOKEN:'',
  });
  if(options.EMAIL_QA_PROTECTION_SECRET){
    if(options.EMAIL_QA_PROTECTION_SECRET.length<32)throw Error('A separate isolated email secret is required.');
    env.MANFORTH_MOBILE_QA_MAIL='true';env.EMAIL_PROTECTION_SECRET=options.EMAIL_QA_PROTECTION_SECRET;
  }
  return { env, port };
}
