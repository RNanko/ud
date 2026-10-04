/** Pure capability check; public policy readiness must not open a database. */
export function qaMailEnabled(env: Record<string, string | undefined> = process.env) {
  if (env.MANFORTH_MOBILE_QA_MAIL !== 'true') return false;
  try {
    const u = new URL(env.DATABASE_URL ?? '');
    if (env.NODE_ENV !== 'development' || env.MANFORTH_MOBILE_QA_LOCAL !== 'true' || !['postgres:', 'postgresql:'].includes(u.protocol) || !u.hostname.endsWith('.neon.tech') || decodeURIComponent(u.pathname.slice(1)) !== 'qa_tablename' || decodeURIComponent(u.username) !== 'manforth_mobile_qa' || env.RESEND_API_KEY) throw Error();
    return true;
  } catch { throw new Error('Invalid isolated mail configuration.'); }
}
