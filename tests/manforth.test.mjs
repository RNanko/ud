import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { loadModule, hookHarness, jsxRuntime, plain, findNode } from './helpers.mjs';
import { legalValidation, legalBundle, legalAgreement, legalTypes } from './legal-fixture.mjs';
const config=loadModule('lib/account/config.ts');
const offer=loadModule('lib/landing/offer.ts',{'../account/config':config});
const demo=loadModule('lib/landing/demo.ts');
test('monthly marketing equivalents use the exact annual checkout amounts in every supported currency',()=>{
 for(const [currency,amount] of Object.entries({USD:'$0.83',EUR:'€0.83',GBP:'£0.83',PLN:'PLN 3.33'}))assert.equal(offer.monthlyEquivalent(currency).replace(/\u00a0/g,' '),amount);
 assert.deepEqual(plain(config.annualPrices),{PLN:3999,GBP:999,EUR:999,USD:999});
});

test('landing membership shows annual billing and routes purchase, verification and existing access safely',()=>{
 let state={currency:'EUR',paid:false,action:'signup',trialDays:14,availability:{EUR:true}};
 const Membership=loadModule('app/components/landing/AnnualMembership.tsx',{
  '@/app/components/shared/account/SessionButton':{__esModule:true,default:'SessionButton'},
  'react/jsx-runtime':jsxRuntime,'next/link':{__esModule:true,default:'Link'},'lucide-react':{},'@/app/components/ui/button':{Button:'Button'},'@/lib/landing/offer':offer,'./LandingProvider':{useLanding:()=>state},
 }).default;
 const purchase=tree=>findNode(tree,n=>n.type==='Button'&&n.props.className.includes('mf-membership-buy')).props.children;
 for(const currency of config.billingCurrencies){
  state={...state,currency,availability:{[currency]:true}};const tree=Membership();
  assert.equal(findNode(tree,n=>n.props.className==='mf-price').props.children[0].props.children,offer.monthlyEquivalent(currency));
  assert.equal(findNode(tree,n=>n.props.className==='mf-annual-charge').props.children[0].props.children,offer.annualAmount(currency));
  assert.match(JSON.stringify(tree),/billed annually/);assert.match(JSON.stringify(tree),/no monthly billing/);
  assert.equal(purchase(tree).props.href,'/auth/registration?intent=membership');
 }
 state={...state,action:'verify'};assert.equal(purchase(Membership()).props.href,offer.actionDestinations.verify);
 state={...state,action:'open',paid:true};assert.equal(purchase(Membership()).props.href,'/account?section=membership');assert.equal(purchase(Membership()).props.children[0],'Manage membership');
 state={...state,action:'signup',paid:false,availability:{[state.currency]:false}};const unavailable=Membership();
 assert.equal(purchase(unavailable).props.href,offer.actionDestinations.signup);assert.equal(purchase(unavailable).props.children[0],'Try it free for 14 days');assert.match(JSON.stringify(unavailable),/currently unavailable/);
});

test('country mapping accepts only trusted exact launch markets and keeps billing separate',()=>{
 for(const [country,currency]of Object.entries({PL:'PLN',GB:'GBP',US:'USD',DE:'EUR',FR:'EUR',CA:'EUR',AU:'EUR',CH:'EUR',IN:'EUR'}))assert.equal(offer.countryCurrency(country,true),currency);
 for(const invalid of [null,undefined,'','gb','GB,US','USA',' GB','UK'])assert.equal(offer.countryCurrency(invalid,true),'EUR');
 assert.equal(offer.countryCurrency('GB',false),'EUR');assert.equal(config.financeCurrencies[0],'USD');assert.ok(config.financeCurrencies.includes('NONE'));assert.equal(config.INVESTMENT_CURRENCY,'USD');
 assert.equal(offer.resolveBillingCurrency({paid:'USD',country:'GB',trusted:true}),'USD');
 assert.equal(offer.resolveBillingCurrency({country:'US',trusted:true}),'USD');
 assert.equal(offer.resolveBillingCurrency({country:'PL',trusted:true}),'PLN');
 assert.equal(offer.resolveBillingCurrency({paid:'CAD',country:'GB',trusted:true}),'GBP');
});
test('CTA destinations distinguish verification, eligibility, active membership and expiry',()=>{
 assert.equal(offer.accountAction('eligible',false),'verify');assert.equal(offer.accountAction('eligible',true),'trial');
 for(const state of ['trial','paid','paid-renewal-off','renewal-grace'])assert.equal(offer.accountAction(state,true),'open');
 for(const state of ['expired','deletion-pending'])assert.equal(offer.accountAction(state,true),'membership');
 assert.equal(offer.actionDestinations.signup,'/auth/registration?intent=trial');
});
test('linked demonstration completion is idempotent and reset has no invented sets',()=>{
  let state=demo.initialDemo;assert.equal(demo.demoWorkoutCount(state),2);
 state=demo.demoReducer(state,{type:'move',date:'2026-10-02'});assert.equal(state.plannedDate,'2026-10-02');assert.equal(state.occurrenceId,demo.sampleOccurrence.id);
 for(let i=0;i<15;i++)state=demo.demoReducer(state,{type:'complete'});
 assert.equal(demo.demoWorkoutCount(state),3);assert.equal(state.occurrenceId,demo.sampleOccurrence.id);assert.equal(state.actualSets,undefined);
 state=demo.demoReducer(state,{type:'task',lane:'done'});assert.equal(demo.demoWorkoutCount(state),3);
 assert.deepEqual(plain(demo.demoReducer(state,{type:'reset'})),plain(demo.initialDemo));
});
test('public account projection reads only owned access state and never starts a trial or provider flow',async()=>{
 let signedIn=false,reads=0;
 const route=loadModule('app/api/public/account/route.ts',{'next/server':{NextResponse:{json:(value,options)=>({value,...options})}},'@/lib/auth':{auth:{api:{getSession:async()=>signedIn?{user:{id:'alice',emailVerified:true}}:null}}},'@/lib/account/access':{productAccess:async owner=>{assert.equal(owner,'alice');reads++;return {state:'paid'};}},'@/lib/account/store':{membershipFor:async owner=>{assert.equal(owner,'alice');return {paid_confirmed:true,paid_through:'2099-01-01T00:00:00Z',billing_currency:'GBP'};}},'@/lib/landing/offer':offer});
 const anonymous=await route.GET({headers:new Headers()});assert.equal(anonymous.value.action,'signup');assert.equal(reads,0);
 signedIn=true;const paid=await route.GET({headers:new Headers()});assert.equal(paid.value.action,'open');assert.equal(paid.value.paidCurrency,'GBP');assert.equal(paid.value.userId,undefined);assert.match(paid.headers['Cache-Control'],/no-store/);
});
test('all four approved checkout currencies use server-selected annual prices and disable adaptive conversion',async()=>{
 const result=loadModule('lib/account/result.ts');
 for(const currency of config.billingCurrencies){
  const creates=[],writes=[];const pending={customer_id:'cus_owned',checkout_currency:currency,checkout_price:`price_${currency}`,checkout_operation:'operation_owned',checkout_expires:new Date(Date.now()+12*3600000).toISOString()};
  const sql=async(parts,...values)=>{const query=parts.join('?');writes.push({query,values});if(query.includes('checkout_lease=now()')&&query.includes('RETURNING *'))return [pending];return [];};
  const client={subscriptions:{list:async()=>({has_more:false,data:[]})},checkout:{sessions:{create:async(value,options)=>{creates.push({value,options});return {id:'cs_fixture',url:'https://checkout.stripe.com/fixture'};}}}};
  const service=loadModule('lib/actions/billing.actions.ts',{'next/headers':{headers:async()=>new Headers()},'../auth':{auth:{api:{getSession:async()=>({user:{emailVerified:true}})}}},'../session':{requireUserId:async()=> 'alice'},'../account/result':result,'../account/store':{accountSql:sql,membershipFor:async()=>({customer_id:'cus_owned'})},'../account/config':config,'../legal/validation':legalValidation,'../legal/store':{publishedBundle:async()=>legalBundle,purchaseLegalSnapshot:async owner=>assert.equal(owner,'alice')},'../account/access':{},'../account/billing/stripe':{assertCheckoutLaunch(){},stripeClient:()=>client,validatedPrice:async code=>{assert.equal(code,currency);return {id:`price_${code}`};}},'../account/billing/reconcile':{reconcileMembership:async owner=>assert.equal(owner,'alice')}});
  const response=await service.createMembershipCheckout({currency,acceptImmediateCharge:true,legal:legalAgreement});assert.equal(response.ok,true,JSON.stringify(response));assert.equal(creates.length,1);assert.equal(creates[0].value.line_items[0].price,`price_${currency}`);assert.equal(creates[0].value.adaptive_pricing.enabled,false);assert.equal(creates[0].value.subscription_data.metadata.product,config.PERSONAL_PRODUCT);assert.match(creates[0].options.idempotencyKey,/operation_owned/);
  const tampered=await service.createMembershipCheckout({currency,acceptImmediateCharge:true,amount:1});assert.equal(tampered.ok,false);assert.equal(creates.length,1);
 }
});
function providerFixture(status='authenticated'){
 const harness=hookHarness(),effects=[],requests=[],resolvers=[];
 const Provider=loadModule('app/components/landing/LandingProvider.tsx',{
  '@/app/components/shared/account/SessionProvider':{useAuthSession:()=>({status,data:status==='authenticated'?{user:{id:'alice'}}:null})},
  '@/app/components/shared/account/SessionButton':{__esModule:true,default:'SessionButton'},
  react:{...harness.react,createContext:()=>({}),useContext:()=>null,useEffect:fn=>effects.push(fn)},'react/jsx-runtime':jsxRuntime,'next/link':{},'lucide-react':{},'@/app/components/ui/button':{},'@/lib/landing/offer':offer,
 },{AbortController,fetch:(url,options={})=>{requests.push({url,options});return new Promise(resolve=>resolvers.push(resolve));}}).default;
 const render=()=>harness.render(()=>Provider({trialDays:14,children:null}));
 render();const cleanups=effects.map(effect=>effect()).filter(Boolean);return {render,requests,resolvers,cleanup:()=>cleanups.forEach(fn=>fn())};
}
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
const response=value=>({ok:true,json:async()=>value});

test('paid currency wins either fetch order and landing automatic pricing performs no writes',async()=>{
 for(const order of [[1,0],[0,1]]){
  const fixture=providerFixture();
  for(const index of order){fixture.resolvers[index](response(index?{action:'open',paidCurrency:'USD'}:{currency:'PLN',availability:{PLN:true}}));await flush();}
  const state=fixture.render().props.value;
  assert.equal(state.currency,'USD');assert.equal(state.paid,true);assert.equal(state.action,'open');assert.equal(state.availability.PLN,true);
  assert.equal(state.choose,undefined);assert.equal(fixture.requests.length,2);assert.ok(fixture.requests.every(r=>!r.options.method||r.options.method==='GET'));fixture.cleanup();
 }
});

test('offer errors retain EUR, account state resolves independently and unmounted fetches do not change state',async()=>{
 const fixture=providerFixture();fixture.resolvers[0]({ok:false});fixture.resolvers[1](response({action:'verify',paidCurrency:null}));await flush();
 assert.equal(fixture.render().props.value.currency,'EUR');assert.equal(fixture.render().props.value.action,'open');fixture.cleanup();
 const abandoned=providerFixture();abandoned.cleanup();assert.ok(abandoned.requests.every(r=>r.options.signal.aborted));
 abandoned.resolvers[0](response({currency:'PLN'}));abandoned.resolvers[1](response({action:'open',paidCurrency:'GBP'}));await flush();
 assert.equal(abandoned.render().props.value.currency,'EUR');assert.equal(abandoned.render().props.value.action,'open');
});

test('regional endpoint ignores stale preferences, falls back to EUR and never caches geography or writes cookies',async()=>{
 const mocks={'next/server':{NextResponse:{json:(value,options={})=>({value,status:options.status??200,headers:options.headers})}},'@/lib/landing/offer':offer,'@/lib/account/config':config,'@/lib/legal/store':{publishedBundle:async()=>legalBundle},'@/lib/account/billing/stripe':{checkoutConfigurationReady:()=>true,configuredPrice:code=>{if(code==='GBP')throw Error('Missing GBP');return 'price';}}};
 const route=loadModule('app/api/public/offer/route.ts',mocks,{process:{env:{VERCEL:'1'}}});
 const request=country=>({headers:new Headers(country?{'x-vercel-ip-country':country}:{}),cookies:{get:()=>({value:'USD'})}});
 for(const [country,currency]of [['PL','PLN'],['US','USD'],['GB','GBP'],['DE','EUR'],[undefined,'EUR'],['XX','EUR'],['gb','EUR']]){
  const result=await route.GET(request(country));assert.equal(result.value.currency,currency);
  for(const name of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control'])assert.match(result.headers[name],/no-store/);
  assert.equal(result.value.manual,undefined);assert.equal(result.headers['Set-Cookie'],undefined);
 }
 assert.equal((await route.GET(request('GB'))).value.availability.GBP,false);assert.equal(route.POST,undefined);
 const local=loadModule('app/api/public/offer/route.ts',mocks,{process:{env:{}}});assert.equal((await local.GET(request('PL'))).value.currency,'EUR');
});

function membershipFixture(fetchOffer){
 const harness=hookHarness(),effects=[],checkouts=[],initial={access:{state:'eligible'},billingCurrency:null,paidThrough:null,hasCustomer:false};
 const Settings=loadModule('app/components/shared/account/MembershipSettings.tsx',{
  react:{...harness.react,useEffect:fn=>effects.push(fn)},'react/jsx-runtime':jsxRuntime,'./AccountPreferencesProvider':{useAccountPreferences:()=>({settings:{preferences:{numberLocale:'en-US'}}})},
  '@/lib/account/format':{formatAccountTimestamp:value=>value},'@/app/(main)/account/gym/GymUI':{GymButton:'GymButton'},'@/lib/landing/offer':offer,'@/lib/account/config':config,
  '@/app/components/legal/LegalAgreementControl':{__esModule:true,default:'LegalAgreementControl'},'@/lib/legal/types':legalTypes,
  '@/lib/actions/billing.actions':{createMembershipCheckout:async input=>{checkouts.push(input);return {ok:true,value:null};},membershipStatus:async()=>({ok:true,value:initial})},
 },{AbortController,fetch:fetchOffer}).default;
 const render=()=>harness.render(()=>Settings({initial,trialDays:14,stripeAvailable:true,checkoutAvailable:true,legalBundle}));
 const purchase=tree=>findNode(tree,n=>n.type==='GymButton'&&n.props.children==='Purchase annual membership');
 const tree=render();effects[0]();return {render,purchase,tree,checkouts};
}

test('membership cannot charge before resolving region and submits exactly the displayed currency',async()=>{
 let resolve;const fixture=membershipFixture(()=>new Promise(done=>resolve=done));assert.equal(fixture.purchase(fixture.tree).props.disabled,true);
 resolve(response({currency:'USD',availability:{USD:true}}));await flush();
 let tree=fixture.render();assert.equal(fixture.purchase(tree).props.disabled,true);
 findNode(tree,n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});tree=fixture.render();
 assert.equal(fixture.purchase(tree).props.disabled,true);
 findNode(tree,n=>n.type==='LegalAgreementControl').props.onChange(true);tree=fixture.render();
 assert.equal(fixture.purchase(tree).props.disabled,false);await fixture.purchase(tree).props.onClick();
 assert.deepEqual(plain(fixture.checkouts),[{currency:'USD',acceptImmediateCharge:true,legal:plain(legalAgreement)}]);
 assert.equal(findNode(tree,n=>n.type==='GymSelect'),undefined);
 const failed=membershipFixture(async()=>({ok:false}));await flush();tree=failed.render();findNode(tree,n=>n.type==='input').props.onChange({target:{checked:true}});findNode(tree,n=>n.type==='LegalAgreementControl').props.onChange(true);await failed.purchase(failed.render()).props.onClick();assert.equal(failed.checkouts[0].currency,'EUR');
 const unavailable=membershipFixture(async()=>response({currency:'PLN',availability:{PLN:false}}));await flush();tree=unavailable.render();assert.equal(findNode(tree,n=>n.type==='input'),undefined);assert.equal(findNode(tree,n=>n.type==='LegalAgreementControl'),undefined);assert.equal(unavailable.purchase(tree).props.disabled,true);assert.equal(unavailable.checkouts.length,0);
});

test('GBP price matches exact annual inclusive-tax product and mode; mismatch never falls back',async()=>{
 const validate=loadModule('lib/landing/price-setup.ts',{'../account/config':config}).annualPriceMatches;
 const price={id:'price_gbp',active:true,product:'prod_personal',currency:'gbp',unit_amount:999,recurring:{interval:'year',interval_count:1},tax_behavior:'inclusive',livemode:false};
 assert.equal(validate(price,'GBP','prod_personal',false),true);
 for(const patch of [{unit_amount:1000},{livemode:true},{tax_behavior:'exclusive'},{recurring:{interval:'month',interval_count:1}},{active:false},{currency:'eur'}])assert.equal(validate({...price,...patch},'GBP','prod_personal',false),false);
 let current=price;const service=loadModule('lib/account/billing/stripe.ts',{stripe:class{prices={retrieve:async()=>current};},'../config':config},{process:{env:{STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_PERSONAL_PRODUCT_ID:'prod_personal',STRIPE_ANNUAL_PRICE_GBP:'price_gbp'}}});
 assert.equal((await service.validatedPrice('GBP')).id,'price_gbp');current={...price,currency:'eur'};await assert.rejects(service.validatedPrice('GBP'),/configuration/);
 assert.throws(()=>service.configuredPrice('EUR'),/not configured/);
});
test('ManForth email branding retains the verified sender mailbox and master assets are not delivered',()=>{
 const brand=loadModule('lib/brand.ts');assert.equal(brand.brandedEmailSender('B1-Way <support-mf@b1-way.pl>'),'ManForth by B1-Way <support-mf@b1-way.pl>');
 assert.equal(brand.brandedEmailSender(),'ManForth by B1-Way <support-mf@b1-way.pl>');
 const templates=loadModule('lib/account/email/templates.ts');const mail=templates.mailTemplate('example@example.invalid','Example',['No private data']);assert.match(mail.html,/MANFORTH/);assert.match(mail.html,/mailto:support-mf@b1-way\.pl/);assert.match(mail.text,/Support: support-mf@b1-way\.pl/);assert.match(mail.text,/ManForth by B1-Way/);
 const manifest=JSON.parse(readFileSync('public/manforth/asset-manifest.json','utf8'));assert.equal(manifest.length,5);
 for(const scene of manifest)for(const file of scene.files){assert.equal(statSync('public'+file.src).size,file.bytes);assert.ok(file.bytes<(file.mobile?200000:400000));assert.match(file.src,/\.webp$/);}
});
function carouselFixture({reduced=false,coarse=false,broken=false}={}){
 const harness=hookHarness(),timers=new Map(),effects=[];let serial=0,observer,visibility;
 const scenes=loadModule('lib/landing/scenes.ts');
 const Hero=loadModule('app/components/landing/HeroCarousel.tsx',{react:{...harness.react,useEffect:fn=>effects.push(fn)},'react/jsx-runtime':jsxRuntime,'lucide-react':{},'@/lib/landing/scenes':scenes,'@/lib/landing/offer':offer,'./LandingProvider':{useLanding:()=>({trialDays:14,currency:'EUR'}),MainAction:'MainAction'}},{
 window:{innerWidth:1200,matchMedia:query=>({matches:query.includes('reduced-motion')?reduced:query.includes('coarse')?coarse:false,addEventListener(){},removeEventListener(){}}),Image:class{complete=false;naturalWidth=1;set src(value){queueMicrotask(()=>broken&&value.includes('investments')?this.onerror?.():this.onload?.());}decode(){return Promise.resolve();}}},
 document:{hidden:false,addEventListener:(type,fn)=>{if(type==='visibilitychange')visibility=fn;},removeEventListener(){}},IntersectionObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){}},setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),queueMicrotask,
 });
 const render=()=>{effects.length=0;const tree=harness.render(Hero.default);return {tree,effects:[...effects]};};
 return {render,timers,hide:()=>{observer([{isIntersecting:false}]);},visibility:()=>visibility?.()};
}
test('carousel waits for the image, pauses offscreen/hover/focus, and cleans up its rotation timer',()=>{
 const fixture=carouselFixture();let node=fixture.render();const unmount=node.effects[0]();node.effects[1]();assert.equal(fixture.timers.size,0);
 findNode(node.tree,n=>n.type==='img').props.onLoad();node=fixture.render();const cleanup=node.effects[1]();assert.equal(fixture.timers.size,1);assert.ok([...fixture.timers.values()][0].ms>=5000);
 findNode(node.tree,n=>n.props?.className==='mf-hero').props.onMouseEnter();cleanup();node=fixture.render();node.effects[1]();assert.equal(fixture.timers.size,0);
 findNode(node.tree,n=>n.props?.className==='mf-hero').props.onMouseLeave();node=fixture.render();const secondCleanup=node.effects[1]();assert.equal(fixture.timers.size,1);
 findNode(node.tree,n=>n.props?.className==='mf-hero').props.onFocusCapture();secondCleanup();node=fixture.render();node.effects[1]();assert.equal(fixture.timers.size,0);
 findNode(node.tree,n=>n.props?.['aria-label']==='Play story rotation').props.onClick();node=fixture.render();const thirdCleanup=node.effects[1]();assert.equal(fixture.timers.size,1);
 fixture.hide();thirdCleanup();node=fixture.render();node.effects[1]();assert.equal(fixture.timers.size,0);unmount();assert.equal(fixture.timers.size,0);
});
test('reduced motion and coarse pointer start with manual navigation; broken candidates retain the current story',async()=>{
 for(const options of [{reduced:true},{coarse:true}]){const fixture=carouselFixture(options);let node=fixture.render();node.effects[0]();findNode(node.tree,n=>n.type==='img').props.onLoad();node=fixture.render();node.effects[1]();assert.equal(fixture.timers.size,0);}
 const fixture=carouselFixture({broken:true});let node=fixture.render();node.effects[0]();findNode(node.tree,n=>n.type==='img').props.onLoad();node=fixture.render();
 findNode(node.tree,n=>n.type==='button'&&n.props.children?.[1]==='Investments').props.onClick();await new Promise(resolve=>setTimeout(resolve,0));node=fixture.render();assert.equal(findNode(node.tree,n=>n.type==='source').props.srcSet,'/manforth/finance-mobile.webp');assert.equal(findNode(node.tree,n=>n.props?.['aria-label']==='Play story rotation').props['aria-pressed'],false);
});
