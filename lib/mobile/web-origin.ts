// Explicit native website links can use the existing hosted web app while the
// original backend runs locally. This never changes web auth/callback origins.
export function mobileWebsiteOrigin(fallback: string, configured: string | undefined, development: boolean) {
  const url = new URL(configured || fallback);
  const local = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[::1\])$/.test(url.hostname);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || !['https:','http:'].includes(url.protocol)
    || url.protocol === 'http:' && (!development || !local)) throw Error('Mobile website origin must be a plain approved HTTPS origin, or local development origin.');
  return url.origin;
}
