// Call before constructing a database client. A disposable schema alone does
// not establish that its containing database is safe for integration writes.
export function qaDatabaseUrl(env = process.env) {
  if (env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production') throw Error('QA database writes are forbidden in a production runtime.');
  if (env.QA_DATABASE_ISOLATED !== 'true' || !env.QA_DATABASE_URL) throw Error('Configure a dedicated QA_DATABASE_URL and explicitly confirm QA_DATABASE_ISOLATED=true before integration writes.');
  let qa;
  try { qa = new URL(env.QA_DATABASE_URL); } catch { throw Error('Invalid QA database connection configuration.'); }
  if (!['postgres:', 'postgresql:'].includes(qa.protocol)) throw Error('QA database must use a PostgreSQL connection.');
  if (env.DATABASE_URL) {
    let application;
    try { application = new URL(env.DATABASE_URL); } catch { throw Error('Cannot verify separation from the application database.'); }
    // Neon direct/pooler hosts are aliases of the same compute. Encoded names,
    // default ports, passwords and URL options do not establish isolation.
    const host = url => url.hostname.toLowerCase().replace(/-pooler(?=\.)/, '') + ':' + (url.port || '5432');
    const database = url => decodeURIComponent(url.pathname);
    if (host(qa) === host(application) && database(qa) === database(application)) throw Error('QA_DATABASE_URL must identify a separate database from DATABASE_URL, not another schema or credential.');
  }
  return env.QA_DATABASE_URL;
}
