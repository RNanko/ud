import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, hookHarness, jsxRuntime, findNode, plain } from './helpers.mjs';
import { legalValidation as v, legalBundle as bundle, legalAgreement as agreement, legalReview, legalTypes } from './legal-fixture.mjs';
import {staticStore} from './static-legal-fixture.mjs';
const config=loadModule('lib/account/config.ts');
const drafts=env=>loadModule('lib/legal/drafts.ts',{'../account/config':config},{process:{env}});
const blank=drafts({NODE_ENV:'development'}).draftDocuments();

test('agreement requires an affirmative choice and rejects client authority fields/scope changes',()=>{
 assert.equal(v.validateAgreement(agreement,bundle).accepted,true);
 for(const value of [undefined,{}, {...agreement,accepted:false}, {...agreement,accepted:'true'}, {...agreement,product:'language'}, {...agreement,locale:'pl'}, {...agreement,userId:'victim'}, {...agreement,timestamp:'2000'}, {...agreement,termsHash:'forged'}])assert.throws(()=>v.validateAgreement(value,bundle));
 assert.throws(()=>v.validateAgreement(agreement,null),/unavailable/);
 assert.throws(()=>v.validateAgreement({...agreement,termsId:'draft-version'},bundle),error=>error.code==='LEGAL_VERSIONS_CHANGED');
});
test('draft facts cannot become approved by filling env or running a build',()=>{
 assert.throws(()=>v.assertPublishable(blank.terms),/placeholders/);
 const env={NODE_ENV:'production',VERCEL_ENV:'production',LEGAL_DRAFT_PREVIEW:'true',APP_URL:'http://localhost:3000',LEGAL_OPERATOR_NAME:'A real fact does not approve a document'};
 assert.equal(drafts(env).allowDraftPreview(),false);
 assert.equal(drafts({...env,VERCEL_ENV:undefined,APP_URL:'https://example.com'}).allowDraftPreview(),false);
 assert.equal(drafts({NODE_ENV:'production'}).allowDraftPreview(),false);
 assert.equal(drafts({NODE_ENV:'development'}).allowDraftPreview(),false);
 assert.equal(drafts({...env,VERCEL_ENV:undefined}).allowDraftPreview(),true);
 assert.throws(()=>v.reviewSchema.parse({...legalReview,checks:{...legalReview.checks,retention:false}}));
 assert.throws(()=>v.reviewSchema.parse({...legalReview,decision:'draft'}));
});
test('canonical hashes survive JSONB key reordering and change when actual content changes',()=>{
 const doc=plain(blank.terms),reverse=value=>Array.isArray(value)?value.map(reverse):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).reverse().map(key=>[key,reverse(value[key])])):value;
 assert.equal(v.contentHash(doc),v.contentHash(reverse(doc)));
 const frozen=JSON.stringify(doc);doc.offer.annualPrices.EUR=2000;
 assert.notEqual(v.contentHash(doc),v.contentHash(JSON.parse(frozen)));
 assert.equal(JSON.parse(frozen).offer.annualPrices.EUR,999);
});
test('missing required operator facts do not expose private drafts through public readers or API',async()=>{
 const store=staticStore({});
 assert.equal(await store.publishedBundle(),null);assert.equal(await store.publicDocument('terms'),null);
 const route=loadModule('app/api/public/legal/route.ts',{'@/lib/legal/store':store,'@/lib/account/registration':{registrationConfigurationIssues:()=>['fixture-missing']}});
 const response=await route.GET();assert.deepEqual(await response.json(),{bundle:null,registrationAvailable:false});assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(route.POST,undefined);
 const records=await store.legalAccountHistory('own');assert.equal(records.unavailable,false);assert.equal(records.records.length,0);
});
test('checkbox begins unchecked; policy links do not submit or toggle and explicitly open new tabs',()=>{
 const control=loadModule('app/components/legal/LegalAgreementControl.tsx',{react:{useId:()=> 'agreement'},'react/jsx-runtime':jsxRuntime}).default;
 let changed=false;const tree=control({bundle,accepted:false,onChange:()=>{changed=true;}});
 const input=findNode(tree,n=>n.type==='input');assert.equal(input.props.checked,false);assert.equal(input.props['aria-labelledby'],'agreement-label');
 for(const href of [bundle.terms.href,bundle.privacy.href]){const link=findNode(tree,n=>n.type==='a'&&n.props.href===href);assert.equal(link.props.target,'_blank');assert.equal(link.props.onClick,undefined);assert.match(link.props['aria-label'],/new tab/);}
 assert.equal(changed,false);input.props.onChange({target:{checked:true}});assert.equal(changed,true);
});
test('document attachment returns retained content/hash and rejects malformed scope without reading storage',async()=>{
 let reads=0;
 const route=loadModule('app/api/public/legal/document/route.ts',{'@/lib/legal/store':{publicDocument:async(kind,version)=>{reads++;return kind==='terms'&&version===blank.terms.version?{document:blank.terms,draft:false}:null;}},'@/lib/legal/validation':v});
 for(const query of ['kind=other&version=1','kind=terms&version=../../env','kind=terms&version=1&userId=victim'])assert.equal((await route.GET(new Request(`http://localhost/api/public/legal/document?${query}`))).status,400);
 assert.equal(reads,0);
 const response=await route.GET(new Request(`http://localhost/api/public/legal/document?kind=terms&version=${blank.terms.version}`));assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/attachment; filename="manforth-terms/);assert.match(response.headers.get('cache-control'),/no-store/);
 const copy=await response.json();assert.equal(copy.sha256,v.contentHash(copy.document));assert.equal(copy.draft,false);assert.deepEqual(copy.document,plain(blank.terms));
 assert.equal((await route.GET(new Request('http://localhost/api/public/legal/document?kind=privacy&version=missing'))).status,404);
});
function identityFixture(){
 const trace=[],state={id:'proof',user_id:'intended',purpose:'signup',owner_id:null,consumed_at:null,verified_at:'2026-10-03T00:00:00Z',expires_at:'2099-01-01T00:00:00Z',email:'fixture@example.invalid'};
 let current=bundle,finalized=false,fail=false;
 const actions=loadModule('lib/actions/identity.actions.ts',{
  'next/headers':{headers:async()=>new Headers(),cookies:async()=>({get:()=>({value:'owned-secret-proof'}),delete:()=>trace.push('cookie-cleared'),set(){}})},
  '../auth':{auth:{api:{signUpEmail:async({body})=>{trace.push('create');assert.equal(body.email,state.email);if(fail)throw Error('Transaction rollback');finalized=true;},signInEmail:async()=>trace.push('signin')}}},
  'better-auth/api':{},'../account/result':loadModule('lib/account/result.ts'),'../account/store':{accountSql:async()=>{state.consumed_at=null;trace.push('proof-retry');}},
  '../account/identity-context':{withIdentity:async(_context,fn)=>fn()},'../account/config':config,
  '../account/email/challenges':{challengeState:async()=>state,consumeChallenge:async()=>{assert.equal(state.consumed_at,null);state.consumed_at='consumed';trace.push('consume');return state;},createChallenge:async()=>{trace.push('email');return {token:'proof'};}},
  '../account/email/policy':{emailAddress:loadModule('lib/account/email/policy.ts',{'../store':{},'./crypto':{},'../config':config}).emailAddress,assertEmailRequestOrigin:()=>trace.push('origin')},
  '../account/email/delivery':{},'../account/email/templates':{},'../account/email/crypto':{},'../account/password':{validateNewPassword:async()=>trace.push('password-check')},'../session':{},
  '../legal/validation':v,'../legal/store':{publishedBundle:async()=>current},'../account/signup':{signupFinalized:async()=>finalized},
 });
 return {actions,state,trace,setBundle:value=>current=value,setFail:value=>fail=value};
}
const signup={name:'QA',password:'long QA passphrase 12345',dateOfBirth:'1990-03-25',legal:agreement};
test('direct signup action without checkbox/version evidence fails before proof consumption/auth',async()=>{
 const f=identityFixture();for(const legal of [undefined,{...agreement,accepted:false},{...agreement,userId:'victim'},{...agreement,termsId:'draft'}]){const result=await f.actions.completeSignup({...signup,legal});assert.equal(result.ok,false);}
 assert.equal(f.trace.length,0);assert.equal(f.state.consumed_at,null);
 const missing=await f.actions.beginEmailProof({email:'fixture@example.invalid',purpose:'signup'});assert.equal(missing.ok,false);assert.equal(f.trace.length,0);
});
test('policy change leaves verified proof unconsumed and does not request another email',async()=>{
 const f=identityFixture();f.setBundle({...bundle,terms:{...bundle.terms,id:'new-version'}});
 const result=await f.actions.completeSignup(signup);assert.equal(result.ok,false);assert.equal(result.code,'LEGAL_VERSIONS_CHANGED');assert.equal(f.state.consumed_at,null);assert.ok(f.state.verified_at);assert.equal(f.trace.length,0);
});
test('signup requires agreement without storing evidence and repeat requests cannot create another account',async()=>{
 const f=identityFixture();assert.equal((await f.actions.completeSignup(signup)).ok,true);
 assert.deepEqual(f.trace,['password-check','consume','create','signin','cookie-cleared']);
 assert.equal((await f.actions.completeSignup(signup)).ok,true);assert.equal(f.trace.filter(value=>value==='create').length,1);assert.equal(f.trace.filter(value=>value==='choice').length,0);
 assert.equal(f.trace.includes('email'),false); // No trial, subscription or email action exists in this completion path.
});
test('failed account transaction restores a still-valid proof for retry and never claims success',async()=>{
 const f=identityFixture();f.setFail(true);assert.equal((await f.actions.completeSignup(signup)).ok,false);assert.equal(f.state.consumed_at,null);assert.equal(f.trace.includes('signin'),false);
 f.setFail(false);assert.equal((await f.actions.completeSignup(signup)).ok,true);
});
test('owned exports no longer collect legal acceptance or purchase records',async()=>{
 const store=staticStore();for(const owner of ['alice','other']){const result=await store.legalAccountHistory(owner);assert.equal(result.records.length,0);assert.equal(result.purchases.length,0);}
});
test('payment cannot start when documents are unpublished even if price and payment acknowledgement exist',async()=>{
 let effects=0;const action=loadModule('lib/actions/billing.actions.ts',{'next/headers':{},'../auth':{},'../session':{},'../account/result':loadModule('lib/account/result.ts'),'../account/store':{},'../account/config':config,'../account/access':{},'../account/billing/stripe':{assertCheckoutLaunch:()=>effects++},'../account/billing/reconcile':{},'../legal/validation':v,'../legal/store':{publishedBundle:async()=>null}});
 const result=await action.createMembershipCheckout({currency:'EUR',acceptImmediateCharge:true,legal:agreement});assert.equal(result.ok,false);assert.equal(effects,0);
});
test('legacy reminder opt-ins cannot enqueue email or deliver a queued reminder, security mail remains separate',async()=>{
 let sends=0,decrypted=0;const writes=[];
 const delivery=loadModule('lib/account/email/delivery.ts',{resend:{Resend:class{emails={send:async()=>{sends++;return {data:{id:'provider'}};}};}},'../store':{accountSql:async parts=>{const q=parts.join('?');writes.push(q);return q.includes('RETURNING *')?[{id:'legacy',kind:'reminder',payload:'not-decrypted'}]:[];}},'../config':config,'./crypto':{unseal:()=>{decrypted++;throw Error('Must not read retired reminder');}},'./policy':{}},{process:{env:{RESEND_API_KEY:'fixture-never-deliver'}}});
 assert.equal(await delivery.enqueueMail('notice','reminder',{to:'fixture@example.invalid'}),false);assert.equal(writes.length,0);
 assert.equal((await delivery.processMailQueue())[0].state,'suppressed');assert.equal(decrypted,0);assert.equal(sends,0);assert.ok(writes.some(q=>q.includes("status='suppressed'")));
});
test('registration retains entered fields when changed documents require a new choice',async()=>{
 const harness=hookHarness(),effects=[];
 const Form=loadModule('app/(auth)/auth/registration/reg-form.tsx',{react:{...harness.react,useCallback:fn=>fn,useEffect:fn=>effects.push(fn)},'react/jsx-runtime':jsxRuntime,'next/link':{},'@/app/(main)/account/gym/GymUI':{Field:'Field',GymButton:'GymButton'},'@/app/components/ui/password-input':{PasswordInput:'PasswordInput'},'@/app/components/shared/account/EmailProofForm':{__esModule:true,default:'EmailProof'},'@/app/components/legal/LegalAgreementControl':{__esModule:true,default:'Agreement'},'@/lib/legal/types':legalTypes,'@/lib/actions/identity.actions':{completeSignup:async()=>({ok:false,error:'The documents changed.',code:'LEGAL_VERSIONS_CHANGED'})}},{fetch:async()=>({ok:true,json:async()=>({bundle,registrationAvailable:true})})}).default;
 const render=()=>harness.render(()=>Form());let tree=render();effects[0]();await new Promise(r=>setTimeout(r,0));tree=render();
 findNode(tree,n=>n.type==='EmailProof').props.onVerified('fixture@example.invalid');tree=render();
 findNode(tree,n=>n.type==='Field'&&n.props.label==='Date of birth').props.onChange({target:{value:'1990-03-25'}});
 for(let count=0;count<2;count++){tree=render();const node=findNode(tree,n=>n.type==='PasswordInput'&&n.props.value==='');node.props.onChange({target:{value:'my long passphrase 12345'}});}
 tree=render();findNode(tree,n=>n.type==='Agreement').props.onChange(true);tree=render();await findNode(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});await new Promise(r=>setTimeout(r,0));tree=render();
 assert.equal(findNode(tree,n=>n.type==='Field'&&n.props.label==='Email').props.value,'fixture@example.invalid');assert.equal(findNode(tree,n=>n.type==='Field'&&n.props.label==='Date of birth').props.value,'1990-03-25');assert.equal(findNode(tree,n=>n.type==='PasswordInput').props.value,'my long passphrase 12345');assert.equal(findNode(tree,n=>n.type==='Agreement').props.accepted,false);assert.equal(findNode(tree,n=>n.type==='EmailProof'),undefined);
});
