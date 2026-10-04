// Anonymous, read-only HTTP checks. Never sends cookies or invokes mutation endpoints.
import { writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const origin = process.argv[2] || 'http://127.0.0.1:3100';
const phase = process.argv[3] || 'final';
const production = 'https://b1-way-mf.vercel.app';
const publicPaths = ['/', '/help', '/features/workout-planner', '/features/weekly-planner', '/features/goal-tracker'];
const paths = [...publicPaths, '/robots.txt', '/sitemap.xml', '/auth/login', '/auth/registration', '/auth/forgot-password', '/account/gym', '/terms', '/privacy', '/seo-missing', '/features/not-a-feature'];
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1],m[2]]));
const records = [];
for (const path of paths) {
  const start = performance.now();
  const response = await fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const headerMs = performance.now() - start;
  const body = await response.text();
  const meta = [...body.matchAll(/<meta\s[^>]*>/g)].map(m => attributes(m[0]));
  const links = [...body.matchAll(/<link\s[^>]*>/g)].map(m => attributes(m[0]));
  const scripts = [...body.matchAll(/<script\s[^>]*src="([^"]+)"/g)].map(m => m[1]);
  const jsonLd = [...body.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const record = { path, status:response.status, location:response.headers.get('location'), contentType:response.headers.get('content-type'), xRobots:response.headers.get('x-robots-tag'), cacheControl:response.headers.get('cache-control'), headerMs, bytes:Buffer.byteLength(body), gzipBytes:gzipSync(body).length, title:body.match(/<title>([^<]+)<\/title>/)?.[1], description:meta.find(m=>m.name==='description')?.content, canonical:links.find(l=>l.rel==='canonical')?.href, robots:meta.find(m=>m.name==='robots')?.content, og:meta.filter(m=>m.property?.startsWith('og:')), icons:links.filter(l=>l.rel?.includes('icon')), jsonLd, scripts, h1Count:[...body.matchAll(/<h1[\s>]/g)].length };
  if (/txt|xml/.test(path)) record.body=body;
  if (path === '/') {
    record.heroImage = [...body.matchAll(/<img\s[^>]*>/g)].map(m=>attributes(m[0])).find(i=>i.src?.includes('finance-1100'));
    record.coreExplanations = ['Finance','Investments','To-Do','Events','Gym','Momentum'].every(name=>body.includes(name));
    record.featureLinks = publicPaths.slice(2).every(p=>body.includes(`href="${p}"`));
    record.helpAnswersInHtml = body.includes('The trial does not automatically charge');
    record.brokenLocalAnchors = [...new Set([...body.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]))].filter(id=>!body.includes(`id="${id}"`));
  }
  records.push(record);
}

// Same unthrottled local HTTP protocol before/after: one warm-up plus seven samples.
await fetch(origin + '/');
const timings = [];
for (let i=0;i<7;i++) {
  const start=performance.now(); const response=await fetch(origin+'/'); const headerMs=performance.now()-start;
  await response.arrayBuffer(); timings.push({headerMs,totalMs:performance.now()-start});
}
const js=[];
for (const path of [...new Set(records[0].scripts)]) {
  const response=await fetch(new URL(path,origin)); const bytes=Buffer.from(await response.arrayBuffer());
  js.push({path,status:response.status,bytes:bytes.length,gzipBytes:gzipSync(bytes).length});
}
const measurement={conditions:'Production local server, anonymous Node fetch, unthrottled warm requests; not browser LCP/INP/CLS or field data',timings,initialHtmlScripts:js,initialScriptBytes:js.reduce((s,r)=>s+r.bytes,0),initialScriptGzipBytes:js.reduce((s,r)=>s+r.gzipBytes,0)};
await mkdir('docs/seo/artifacts',{recursive:true});
await writeFile(`docs/seo/artifacts/${phase}-http.json`,JSON.stringify({origin,records,measurement},null,2));
if(phase==='preview') {
  for(const path of publicPaths){const r=records.find(r=>r.path===path);assert.equal(r.status,200);assert.match(r.robots,/noindex/);assert.match(r.xRobots,/noindex/);assert.equal(new URL(r.canonical).href,production+path);}
  assert.doesNotMatch(records.find(r=>r.path==='/sitemap.xml').body,/<loc>/);
  assert.doesNotMatch(records.find(r=>r.path==='/robots.txt').body,/Disallow: \/auth|Disallow: \/\s/);
  console.log('PASS: preview build excludes public pages using crawlable noindex headers and an empty sitemap, retaining production canonicals.');
}
if(phase==='final') {
  for(const path of publicPaths){const r=records.find(r=>r.path===path);assert.equal(r.status,200,path);assert.equal(r.h1Count,1,path);assert.equal(new URL(r.canonical).href,production+path);assert.match(r.robots,/^index, follow/);assert.ok(r.title&&r.description);assert.ok(r.jsonLd.length===1);assert.equal(r.xRobots,null);}
  assert.equal(new Set(records.slice(0,5).map(r=>r.title)).size,5);
  assert.ok(records[0].coreExplanations&&records[0].featureLinks&&records[0].helpAnswersInHtml);
  assert.deepEqual(records[0].brokenLocalAnchors,[]);
  assert.equal(records[0].heroImage.loading,'eager'); assert.equal(records[0].heroImage.fetchPriority,'high');
  const robots=records.find(r=>r.path==='/robots.txt'); assert.match(robots.contentType,/text\/plain/);assert.match(robots.body,/Sitemap: https:\/\/b1-way-mf\.vercel\.app\/sitemap.xml/);assert.doesNotMatch(robots.body,/Disallow: \/auth/);
  const sitemap=records.find(r=>r.path==='/sitemap.xml');assert.match(sitemap.contentType,/xml/);assert.deepEqual([...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]),publicPaths.map(p=>production+p));assert.doesNotMatch(sitemap.body,/lastmod|priority|changefreq/);
  for(const path of ['/auth/login','/auth/registration','/auth/forgot-password','/terms','/privacy']){const r=records.find(r=>r.path===path);assert.match(r.robots,/noindex/);assert.match(r.xRobots,/noindex/);}
  const account=records.find(r=>r.path==='/account/gym');assert.equal(account.status,307);assert.match(account.location,/\/auth\/login/);assert.match(account.xRobots,/noindex/);
  for(const path of ['/seo-missing','/features/not-a-feature'])assert.equal(records.find(r=>r.path===path).status,404,path);
  const image=await fetch(origin+'/opengraph-image');const data=Buffer.from(await image.arrayBuffer());assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/image\/png/);assert.equal(data.readUInt32BE(16),1200);assert.equal(data.readUInt32BE(20),630);await writeFile('docs/seo/artifacts/social-preview.png',data);
  const icon=await fetch(origin+'/favicon.ico');const ico=Buffer.from(await icon.arrayBuffer());assert.equal(icon.status,200);assert.equal(ico.readUInt16LE(2),1);
  for(const scene of ['finance','investments','todo','gym','events'])for(const size of ['mobile','1100','1672']){const response=await fetch(`${origin}/manforth/${scene}-${size}.webp`);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/image\/webp/);const data=Buffer.from(await response.arrayBuffer());assert.equal(data.toString('ascii',8,12),'WEBP');}
  const offer=await fetch(origin+'/api/public/offer');assert.equal(offer.status,200);assert.match(offer.headers.get('cache-control'),/private.*no-store/);assert.match(offer.headers.get('x-robots-tag'),/noindex/);const prices=await offer.json();assert.equal(prices.currency,'EUR');
  for(const params of ['?utm_source=seo-check','?currency=USD','?slide=gym']){const response=await fetch(origin+'/'+params);const body=await response.text();const link=[...body.matchAll(/<link\s[^>]*>/g)].map(m=>attributes(m[0])).find(l=>l.rel==='canonical');assert.equal(new URL(link.href).href,production+'/');assert.ok(body.includes(records[0].title));}
  console.log('PASS: 5 indexable pages, crawl rules, private/auth/legal exclusions, real 404s, stable metadata, safe schema, hero and social/icon assets.');
}
console.log(JSON.stringify({phase,measurement:{htmlBytes:records[0].bytes,htmlGzipBytes:records[0].gzipBytes,scriptBytes:measurement.initialScriptBytes,scriptGzipBytes:measurement.initialScriptGzipBytes,timings},routes:records.map(r=>({path:r.path,status:r.status,robots:r.robots}))},null,2));
