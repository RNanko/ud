// Local production HTTP/payload lab. This does not measure browser LCP, CLS or INP.
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const origin=new URL(process.argv[2]??'http://localhost:3001');
if(!['localhost','127.0.0.1'].includes(origin.hostname)||!['http:','https:'].includes(origin.protocol))throw Error('Use a local production server for this lab');
const samples=[];let html='',rootHeaders;
for(let i=0;i<5;i++){
 const started=performance.now(),response=await fetch(new URL('/',origin)),headersAt=performance.now();
 html=await response.text();rootHeaders=response.headers;
 samples.push({status:response.status,headersMs:+(headersAt-started).toFixed(1),completeMs:+(performance.now()-started).toFixed(1)});
}
const js=[...new Set([...html.matchAll(/<script[^>]+src="([^"?]+\.js(?:\?[^" ]*)?)"/g)].map(match=>match[1]))];
const css=[...new Set([...html.matchAll(/href="([^"?]+\.css(?:\?[^" ]*)?)"/g)].map(match=>match[1]))];
async function payload(paths){let raw=0,gzipEstimate=0;for(const path of paths){const response=await fetch(new URL(path,origin));if(!response.ok)throw Error(`Asset failed: ${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());raw+=bytes.length;gzipEstimate+=gzipSync(bytes).length;}return {files:paths.length,decodedBytes:raw,gzipEstimateBytes:gzipEstimate};}
const [scripts,styles]=await Promise.all([payload(js),payload(css)]);
const regional=await fetch(new URL('/api/public/offer',origin),{headers:{'x-vercel-ip-country':'GB'}}),offer=await regional.json();
const manifest=JSON.parse(await readFile('public/manforth/asset-manifest.json','utf8')),images=manifest.flatMap(scene=>scene.files);
const report={measuredAt:new Date().toISOString(),origin:origin.origin,method:'Five sequential Node fetch requests against a local next start build; decoded payload sizes and zlib gzip estimates. Not browser timings or actual wire transfer/CWV.',root:{samples,htmlDecodedBytes:Buffer.byteLength(html),cacheControl:rootHeaders.get('cache-control'),firstFinanceImageInHTML:html.includes('/manforth/finance-1100.webp'),mobileSourceInHTML:html.includes('/manforth/finance-mobile.webp'),highPriorityInHTML:html.includes('fetchPriority="high"')||html.includes('fetchpriority="high"')},scripts,styles,offer:{status:regional.status,cacheControl:regional.headers.get('cache-control'),cdnCacheControl:regional.headers.get('cdn-cache-control'),vercelCdnCacheControl:regional.headers.get('vercel-cdn-cache-control'),localSpoofedCountryResult:offer.currency},assets:{allVariantsBytes:images.reduce((sum,file)=>sum+file.bytes,0),mobileVariantsBytes:images.filter(file=>file.mobile).reduce((sum,file)=>sum+file.bytes,0),firstMobileHeroBytes:images.find(file=>file.src==='/manforth/finance-mobile.webp').bytes},browserCoreWebVitals:'Not measured'};
await writeFile('docs/manforth-lab.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
