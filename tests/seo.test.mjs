import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { loadModule, plain, jsxRuntime, hookHarness, findNode } from './helpers.mjs';

const pages=loadModule('lib/seo/public-pages.ts');
const production={process:{env:{NODE_ENV:'production',VERCEL_ENV:'production',NEXT_PUBLIC_SITE_ORIGIN:'https://hostile-preview.invalid'}}};
const brand=loadModule('lib/brand.ts',{},production);
const metadata=loadModule('lib/seo/metadata.ts',{'../brand':brand});
const schema=loadModule('lib/seo/structured-data.ts',{'../brand':brand});
const features=loadModule('lib/seo/features.ts');
const canonical='https://b1-way-mf.vercel.app';

test('public origin is pinned even when an unchecked preview origin is configured',()=>{
  assert.equal(brand.publicOrigin(),canonical);
  assert.equal(brand.indexPublicSite(),true);
  for(const env of [{NODE_ENV:'development',VERCEL_ENV:'production'},{NODE_ENV:'production',VERCEL_ENV:'preview'},{NODE_ENV:'production'},{}])assert.equal(loadModule('lib/brand.ts',{}, {process:{env}}).indexPublicSite(),false);
});

test('public page titles, canonicals and social cards are distinct and stable',()=>{
  const articles=Object.values(features.featureArticles);
  const values=[metadata.publicMetadata('/',brand.brand.title,brand.brand.description),metadata.publicMetadata('/help','ManForth Help','Help with the app'),...articles.map(a=>metadata.publicMetadata(a.path,a.title,a.description))];
  assert.equal(new Set(values.map(v=>v.title.absolute)).size,5);
  values.forEach((v,i)=>{assert.equal(v.alternates.canonical,canonical+pages.publicPages[i].path);assert.deepEqual(plain(v.robots),{index:true,follow:true});assert.equal(v.openGraph.url,v.alternates.canonical);assert.equal(v.openGraph.images[0].width,1200);assert.equal(v.twitter.card,'summary_large_image');assert.equal(v.openGraph.siteName,'ManForth');assert.ok(v.description);});
});

test('sitemap contains exactly the five approved public pages without arbitrary timestamps or priorities',()=>{
  const file=loadModule('app/sitemap.ts',{'@/lib/brand':brand,'@/lib/seo/public-pages':pages});
  assert.deepEqual(plain(file.default()),plain(pages.publicPages.map(p=>({url:canonical+p.path}))));
  assert.ok(file.default().every(r=>Object.keys(r).length===1));
  const preview=loadModule('app/sitemap.ts',{'@/lib/brand':{...brand,indexPublicSite:()=>false},'@/lib/seo/public-pages':pages});assert.deepEqual(plain(preview.default()),[]);
});

test('crawl rules let public auth pages expose noindex while private records retain crawl exclusions',async()=>{
  const robots=loadModule('app/robots.ts',{'@/lib/brand':brand,'@/lib/seo/public-pages':pages}).default();
  assert.equal(robots.rules.allow,'/');assert.deepEqual(plain(robots.rules.disallow),['/account','/api']);assert.equal(robots.sitemap,canonical+'/sitemap.xml');
  const config=loadModule('next.config.ts',{'./lib/brand':brand,'./lib/seo/public-pages':pages}).default;
  const headers=await config.headers();assert.deepEqual(plain(headers.map(h=>h.source)),plain(pages.excludedSearchSurfaces));assert.ok(headers.every(h=>h.headers[0].value.includes('noindex')));
  const preview=loadModule('next.config.ts',{'./lib/brand':{...brand,indexPublicSite:()=>false},'./lib/seo/public-pages':pages}).default;assert.deepEqual(plain((await preview.headers()).map(h=>h.source)),['/:path*']);
});

test('structured data is connected to visible page identity and excludes invented eligibility claims',()=>{
  const home=plain(schema.publicGraph('/',brand.brand.title,brand.brand.description));
  assert.deepEqual(home['@graph'].map(n=>n['@type']),['WebPage','WebSite','WebApplication']);
  const site=home['@graph'][1];assert.equal(site.name,'ManForth');assert.equal(site.alternateName,'ManForth by B1-Way');assert.equal(home['@graph'][0].mainEntity['@id'],home['@graph'][2]['@id']);
  const data=JSON.stringify(home);assert.doesNotMatch(data,/aggregateRating|ratingValue|review|offers|price|Organization|Event"|ANDROID|IOS|downloadUrl/);
  const page=plain(schema.publicGraph('/features/workout-planner','Workout planner','Training log',[{name:'ManForth',path:'/'},{name:'Workout planner',path:'/features/workout-planner'}]));
  assert.equal(page['@graph'][0].breadcrumb['@id'],page['@graph'][1]['@id']);assert.equal(page['@graph'][1].itemListElement[1].item,canonical+'/features/workout-planner');
});

test('JSON-LD serialization cannot close a script, and preserves the original data when parsed',()=>{
  const input={name:'</script><script>alert("fixture")</script> & >\u2028\u2029'};
  const serialized=schema.serializeJsonLd(input);assert.doesNotMatch(serialized,/[<>&\u2028\u2029]/);assert.deepEqual(JSON.parse(serialized),input);
});

test('three feature explanations use valid shared Help IDs and keep limitations explicit',()=>{
  const config=loadModule('lib/account/config.ts');
  const offer=loadModule('lib/landing/offer.ts',{'../account/config':config});
  const help=loadModule('lib/help/content.ts',{'../landing/offer':offer});
  const articles=help.helpArticles(14);
  assert.equal(Object.keys(features.featureArticles).length,3);
  for(const article of Object.values(features.featureArticles)){assert.ok(pages.publicPages.some(p=>p.path===article.path));assert.ok(article.questionIds.every(id=>articles.some(q=>q.id===id)));assert.ok(article.steps.length>=3&&article.limits.length>=3);assert.ok(article.example&&article.description);assert.ok(pages.publicPages.some(p=>p.path===article.related));}
  assert.match(features.featureArticles['workout-planner'].limits.join(' '),/not weight or repetition recommendations/);
  assert.match(features.featureArticles['goal-tracker'].limits.join(' '),/Automatic linking.*not included/);
});

function deferredFixture(fail=false) {
  const harness=hookHarness();let requests=0;
  const mocks={'react/jsx-runtime':jsxRuntime,react:harness.react};
  Object.defineProperty(mocks,'./AppPreview',{get(){requests++;if(fail)throw Error('fixture unavailable');return {__esModule:true,default:'InteractivePreview'};},configurable:true});
  const Preview=loadModule('app/components/landing/DeferredAppPreview.tsx',mocks).default;
  const render=()=>harness.render(()=>Preview({preview:'readable preview',children:'all six features',momentum:'readable goals'}));
  return {render,requests:()=>requests,recover(){fail=false;}};
}

test('interactive demo is not imported on first render and repeat taps share one load',async()=>{
  const f=deferredFixture();const tree=f.render();assert.equal(f.requests(),0);assert.ok(JSON.stringify(tree).includes('all six features'));
  const button=findNode(tree,n=>n.type==='button');button.props.onClick();button.props.onClick();await setImmediate();assert.equal(f.requests(),1);assert.ok(findNode(f.render(),n=>n.type==='InteractivePreview'));
});

test('failed interactive chunk keeps readable content and can be retried',async()=>{
  const f=deferredFixture(true);findNode(f.render(),n=>n.type==='button').props.onClick();await setImmediate();const failed=f.render();assert.ok(JSON.stringify(failed).includes('all six features'));assert.equal(findNode(failed,n=>n.type==='button').props.children,'Retry interactive preview');f.recover();findNode(failed,n=>n.type==='button').props.onClick();await setImmediate();assert.equal(f.requests(),2);assert.ok(findNode(f.render(),n=>n.type==='InteractivePreview'));
});
