import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {loadModule, hookHarness, jsxRuntime, findNode, plain} from './helpers.mjs';
import {legalValidation as validation, legalBundle as bundle, legalTypes} from './legal-fixture.mjs';
import {staticStore} from './static-legal-fixture.mjs';
const operator=loadModule('lib/legal/operator.ts');
const validEnv={LEGAL_OPERATOR_NAME:'Synthetic Operator',LEGAL_OPERATOR_FORM:'Individual (natural person)',LEGAL_OPERATOR_COUNTRY:'Synthetic country',LEGAL_OPERATOR_ADDRESS:'Synthetic fixture address',LEGAL_CONTACT_EMAIL:'fixture@example.invalid',LEGAL_OPERATOR_REGISTRATION_STATUS:'not-applicable',LEGAL_OPERATOR_TAX_STATUS:'not-applicable'};
const document=kind=>({id:`b1-way-personal:${kind}:en:fixture-1`,product:'b1-way-personal',locale:'en',kind,version:'fixture-1',title:'Synthetic published fixture',introduction:'Isolated fixture, not actual policy approval.',effectiveDate:'2026-01-01',updatedAt:'2026-01-01',operator:{name:validEnv.LEGAL_OPERATOR_NAME,form:validEnv.LEGAL_OPERATOR_FORM,country:validEnv.LEGAL_OPERATOR_COUNTRY,address:validEnv.LEGAL_OPERATOR_ADDRESS,contact:validEnv.LEGAL_CONTACT_EMAIL,registration:'',tax:'',registrationStatus:'not-applicable',taxStatus:'not-applicable'},sections:Array.from({length:8},(_,i)=>({id:`section-${i}`,title:`Section ${i}`,paragraphs:['Synthetic content.']}))});
test('operator configuration rejects examples, blanks, unresolved facts and trailing slashes',()=>{
 for(const value of ['YOUR FULL LEGAL NAME','YOUR ACTUAL COUNTRY','YOUR CORRECT OPERATOR ADDRESS','YOUR_FULL_LEGAL_NAME','  ','Name\\','[REVIEW REQUIRED: fact]','Unknown'])assert.notEqual(operator.factStatus(value),'provided');
 assert.equal(operator.operatorConfiguration(validEnv).configured,true);
 for(const key of ['LEGAL_OPERATOR_NAME','LEGAL_OPERATOR_FORM','LEGAL_OPERATOR_COUNTRY','LEGAL_OPERATOR_ADDRESS'])assert.equal(operator.operatorConfiguration({...validEnv,[key]:'YOUR FULL LEGAL NAME'}).configured,false);
 assert.equal(operator.operatorConfiguration({...validEnv,LEGAL_CONTACT_EMAIL:'invalid'}).configured,false);
});
test('individual disclosures preserve provided, confirmed non-applicability and unresolved states',()=>{
 assert.equal(operator.disclosureState(''),'unresolved');
 assert.equal(operator.disclosureState('','not-applicable'),'not-applicable');
 assert.equal(operator.disclosureState('Not applicable'),'not-applicable');
 assert.equal(operator.disclosureState('Synthetic registration','provided'),'provided');
 assert.equal(operator.disclosureState('Synthetic registration','not-applicable'),'unresolved');
 const doc=document('terms');validation.assertPublishable(doc);
 assert.equal(doc.operator.registration,'');assert.equal(doc.operator.tax,'');
 assert.throws(()=>validation.assertPublishable({...doc,operator:{...doc.operator,taxStatus:'unresolved'}}),/applicability/);
 assert.throws(()=>validation.assertPublishable({...doc,operator:{...doc.operator,name:'YOUR FULL LEGAL NAME'}}),/placeholders/);
});
test('false and invalid preview values stay false, including local development',()=>{
 for(const value of [undefined,'false',' FALSE ','0','invalid',false])assert.equal(operator.parseExplicitBoolean(value),false);
 const drafts=env=>loadModule('lib/legal/drafts.ts',{}, {process:{env}});
 assert.equal(drafts({NODE_ENV:'development',LEGAL_DRAFT_PREVIEW:'false'}).allowDraftPreview(),false);
 assert.equal(drafts({NODE_ENV:'development',LEGAL_DRAFT_PREVIEW:'true',APP_URL:'http://localhost:3000'}).allowDraftPreview(),true);
 assert.equal(drafts({NODE_ENV:'production',VERCEL_ENV:'production',LEGAL_DRAFT_PREVIEW:'true',APP_URL:'http://localhost:3000'}).allowDraftPreview(),false);
 const privateDraft=drafts(validEnv).draftDocuments();
 assert.doesNotMatch(privateDraft.terms.sections[0].paragraphs[0],/Registration:|Tax\/VAT:/);
 assert.throws(()=>validation.assertPublishable(privateDraft.terms),/placeholders/);
});
test('public readers do not generate or leak drafts in any environment or via download',async()=>{
 const store=staticStore({});
 for(const kind of ['terms','privacy'])for(const version of [undefined,'draft-1'])assert.equal(await store.publicDocument(kind,version),null);
 const route=loadModule('app/api/public/legal/document/route.ts',{'@/lib/legal/store':{publicDocument:async()=>({draft:true,document:{operator:{address:'PRIVATE_FIXTURE'}}})},'@/lib/legal/validation':validation});
 const response=await route.GET(new Request('http://localhost/api/public/legal/document?kind=terms&version=draft-1'));
 assert.equal(response.status,404);assert.doesNotMatch(await response.text(),/PRIVATE_FIXTURE/);
});
test('static website policies remain independent of database publication state',async()=>{
 const store=staticStore(validEnv),first=await store.publicDocument('terms'),second=await store.publicDocument('terms');
 assert.equal(first.draft,false);assert.equal(first.document.id,second.document.id);assert.equal(first.history.length,0);
});

test('registration capability requires configuration and policies without an evidence trigger',async()=>{
 const configuration=loadModule('lib/account/registration.ts');assert.ok(configuration.registrationConfigurationIssues({}).includes('EMAIL_PROTECTION_SECRET'));
 const fixture={DATABASE_URL:'fixture',BETTER_AUTH_SECRET:'x'.repeat(32),RESEND_API_KEY:'fixture',EMAIL_PROTECTION_SECRET:'x'.repeat(32)};
 assert.equal(configuration.registrationConfigurationIssues(fixture).length,0);
 for(const [issues,current,expected] of [[[],bundle,true],[[],null,false],[['PRIVATE_MISSING_FIELD'],bundle,false]]){
  const route=loadModule('app/api/public/legal/route.ts',{'@/lib/legal/store':{publishedBundle:async()=>current},'@/lib/account/registration':{registrationConfigurationIssues:()=>issues}});
  const response=await route.GET(),result=await response.json();assert.equal(result.registrationAvailable,expected);assert.deepEqual(result.bundle,current);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_MISSING_FIELD/);assert.match(response.headers.get('cache-control'),/no-store/);
 }
});

function registrationFixture(available){
 const harness=hookHarness(),effects=[];
 const Form=loadModule('app/(auth)/auth/registration/reg-form.tsx',{react:{...harness.react,useCallback:fn=>fn,useEffect:fn=>effects.push(fn)},'react/jsx-runtime':jsxRuntime,'next/link':{__esModule:true,default:'Link'},'@/app/(main)/account/gym/GymUI':{Field:'Field',GymButton:'Button'},'@/app/components/ui/password-input':{PasswordInput:'Password'},'@/app/components/shared/account/EmailProofForm':{__esModule:true,default:'EmailProof'},'@/app/components/legal/LegalAgreementControl':{__esModule:true,default:'Agreement'},'@/lib/legal/types':legalTypes,'@/lib/account/email/signup-client':{}},{fetch:async()=>({ok:true,json:async()=>({bundle,registrationAvailable:available})})}).default;
 return {effects,render:()=>harness.render(()=>Form())};
}


test('registration unavailable state does not collect fields; ready state has no technical warning',async()=>{
 for(const ready of [false,true]){
  const f=registrationFixture(ready);f.render();f.effects[0]();await new Promise(r=>setTimeout(r,0));const tree=f.render();
  assert.equal(!!findNode(tree,n=>n.type==='EmailProof'),ready);
  assert.doesNotMatch(JSON.stringify(tree),/LEGAL_OPERATOR|Development review|provider setup|operator facts/i);
  if(!ready)assert.match(JSON.stringify(tree),/Registration is not available right now/);
  else assert.doesNotMatch(JSON.stringify(tree),/Registration is not available right now/);
  assert.ok(findNode(tree,n=>n.type==='Link'&&n.props.href==='/auth/login'));
 }
});
test('public error codes support required actions without technical prose or secret reflection',async()=>{
 const errors=loadModule('lib/account/errors.ts'),result=loadModule('lib/account/result.ts',{'./errors':errors});
 assert.equal((await result.actionResult(async()=>{throw new errors.PublicError('EMAIL_PROTECTION_SECRET is not configured');})).error,'Email verification is currently unavailable. Please try again later or contact support.');
 const changed=await result.actionResult(async()=>{throw new errors.PublicError('Review updated documents.','LEGAL_VERSIONS_CHANGED');});assert.equal(changed.code,'LEGAL_VERSIONS_CHANGED');assert.doesNotMatch(changed.error,/LEGAL_VERSIONS_CHANGED/);
 const error=await result.actionResult(async()=>{throw Error('PRIVATE_DB_SECRET');});assert.doesNotMatch(JSON.stringify(error),/PRIVATE_DB_SECRET/);
});
test('settings persist and reload with real isolated PostgreSQL semantics; stale writes retain stored state',async()=>{
 const pg=new PGlite();try{
  await pg.exec(`CREATE TABLE b1_account_settings(user_id text,product text,preferences jsonb,notifications jsonb,revision integer,updated_at timestamptz DEFAULT now(),PRIMARY KEY(user_id,product));`);
  const sql=async(parts,...values)=>(await pg.query(parts.map((part,i)=>part+(i<values.length?'$'+(i+1):'')).join(''),values)).rows;
  const preferences=loadModule('lib/account/preferences.ts'),configuration=loadModule('lib/account/config.ts');
  const database=loadModule('lib/db/http-sql.ts',{'@neondatabase/serverless':{neon:()=>sql}},{process:{env:{DATABASE_URL:'postgresql://fixture:fixture@database.invalid/fixture'}},URL});
  const store=loadModule('lib/account/store.ts',{'../db/http-sql':database,'./config':configuration,'./preferences':preferences});
  const action=loadModule('lib/actions/account.actions.ts',{'../db/drizzle':{},'drizzle-orm':{},'../db/schema':{},'next/cache':{revalidatePath(){}},'../session':{requireUserId:async()=> 'fixture-owner'},'../account/store':{...store,accountSql:sql}});
  const updated={...preferences.defaultPreferences,exerciseLoad:'lb',distance:'mi',financeDefaultCurrency:'EUR',weekStart:'sunday'};
  const saved=await action.saveAccountSettingsResult({section:'preferences',revision:0,value:updated});assert.equal(saved.ok,true);assert.deepEqual(plain((await store.accountSettings('fixture-owner')).preferences),plain(updated));
  const stale=await action.saveAccountSettingsResult({section:'preferences',revision:0,value:preferences.defaultPreferences});assert.equal(stale.ok,false);assert.match(stale.error,/edits are kept/);assert.deepEqual(plain((await store.accountSettings('fixture-owner')).preferences),plain(updated));
  const notifications={...preferences.defaultNotifications,eventReminders:false};assert.equal((await action.saveAccountSettingsResult({section:'notifications',revision:1,value:notifications})).ok,true);const refreshed=await store.accountSettings('fixture-owner');assert.equal(refreshed.revision,2);assert.equal(refreshed.notifications.eventReminders,false);assert.equal(refreshed.preferences.distance,'mi');
  assert.equal((await store.accountSettings('different-owner')).revision,0);
 }finally{await pg.close();}
});
const uiMocks={'react/jsx-runtime':jsxRuntime,'lucide-react':{ArrowUpRight:'ArrowUpRight'},'@/app/(main)/account/gym/GymUI':{Field:'Field',GymButton:'Button'},'./gym/GymUI':{Field:'Field',GymButton:'Button'},'@/app/components/ui/password-input':{PasswordInput:'Password'},'next/navigation':{useRouter:()=>({replace(){throw Error('Unexpected navigation');}})}};
const tick=()=>new Promise(r=>setTimeout(r,0));
function settingsFixture(actions){
 const harness=hookHarness(),p=loadModule('lib/account/preferences.ts');let snapshot={preferences:p.defaultPreferences,notifications:p.defaultNotifications,revision:0};
 const Component=loadModule('app/(main)/account/AccountSettingsClient.tsx',{...uiMocks,react:harness.react,'lucide-react':Object.fromEntries(['UserRound','SlidersHorizontal','ShieldCheck','Bell','CreditCard','LifeBuoy','BookOpen'].map(k=>[k,'Icon'])),'./finance/FinanceSelect':'Select','@/app/components/shared/account/AccountPreferencesProvider':{useAccountPreferences:()=>({settings:snapshot,replace:value=>{snapshot=value;}})},'@/lib/actions/account.actions':actions,'@/lib/account/format':loadModule('lib/account/format.ts'),'@/app/components/shared/account/EmailProofForm':'EmailProof','@/app/components/shared/account/SecuritySettings':'Security','@/app/components/shared/account/MembershipSettings':'Membership','@/app/components/shared/account/PrivacySettings':'Privacy','@/app/components/shared/account/AppGuide':'AppGuide'} ,{window:{confirm:()=>true}}).default;
 const props={user:{name:'Synthetic name',email:'fixture@example.invalid',emailVerified:true,createdAt:'2026-01-01T00:00:00Z'},initialMembership:null,trialDays:14,stripeAvailable:false,checkoutAvailable:false,version:'fixture',terms:'/terms',privacy:'/privacy',retention:null,legalBundle:null};
 return {render:()=>harness.render(()=>Component(props)),snapshot:()=>snapshot};
}
test('profile save prevents duplicate taps and preserves edits after a recoverable failure',async()=>{
 let calls=0,resolve;const f=settingsFixture({saveAccountNameResult:()=>{calls++;return new Promise(r=>{resolve=r;});}});
 let tree=f.render();findNode(tree,n=>n.type==='Field'&&n.props.label==='Display name').props.onChange({target:{value:'Keep this edit'}});tree=f.render();const submit=findNode(tree,n=>n.type==='form').props.onSubmit;
 submit({preventDefault(){}});submit({preventDefault(){}});assert.equal(calls,1);tree=f.render();assert.ok(findNode(tree,n=>n.type==='fieldset'&&n.props.disabled===true));
 resolve({ok:false,error:'Retry your save.'});await tick();tree=f.render();assert.equal(findNode(tree,n=>n.type==='Field').props.value,'Keep this edit');assert.match(JSON.stringify(tree),/Retry your save/);assert.doesNotMatch(JSON.stringify(tree),/Saved to your account/);
});
test('preference save updates the shared snapshot only after confirmed success',async()=>{
 const f=settingsFixture({saveAccountSettingsResult:async input=>({ok:true,value:{...f.snapshot(),preferences:input.value,revision:input.revision+1}})});
 let tree=f.render();findNode(tree,n=>n.type==='Button'&&n.props.children?.[1]==='Preferences').props.onClick();tree=f.render();findNode(tree,n=>n.props?.label==='Default for new expenses & revenue').props.onChange('EUR');tree=f.render();findNode(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});await tick();tree=f.render();assert.equal(f.snapshot().preferences.financeDefaultCurrency,'EUR');assert.equal(f.snapshot().revision,1);assert.match(JSON.stringify(tree),/Saved to your account/);
});
function membershipFixture(initial,statusResult){
 const harness=hookHarness();const Component=loadModule('app/components/shared/account/MembershipSettings.tsx',{...uiMocks,react:harness.react,'@/lib/account/format':loadModule('lib/account/format.ts'),'./AccountPreferencesProvider':{useAccountPreferences:()=>({settings:{preferences:loadModule('lib/account/preferences.ts').defaultPreferences}})},'@/lib/actions/billing.actions':{startMembershipTrial:async()=>({ok:true,value:{}}),membershipStatus:async()=>statusResult},'@/lib/landing/offer':{validBillingCurrency:value=>['PLN','EUR','GBP','USD'].includes(value)?value:null},'@/app/components/legal/LegalAgreementControl':'Agreement','@/lib/legal/types':legalTypes}).default;
 return ()=>harness.render(()=>Component({initial,trialDays:14,stripeAvailable:false,checkoutAvailable:false,legalBundle:null}));
}
test('failed membership loads are isolated and never fabricate free, active or updated status',async()=>{
 let render=membershipFixture(null,{ok:false,error:'failure'}),tree=render();assert.match(JSON.stringify(tree),/couldn't be loaded/);assert.doesNotMatch(JSON.stringify(tree),/Free|Annual membership active|Purchase annual membership/);
 render=membershipFixture({access:{state:'eligible',readOnly:true},trialStart:null,paidThrough:null},{ok:false,error:'fixture'});tree=render();await findNode(tree,n=>n.type==='Button'&&Array.isArray(n.props.children)&&n.props.children.join('')==='Start 14-day trial').props.onClick();tree=render();assert.match(JSON.stringify(tree),/Membership status couldn't be loaded/);assert.doesNotMatch(JSON.stringify(tree),/Membership updated/);
});
test('security failure retains password fields; failed logout does not navigate',async()=>{
 const harness=hookHarness();const Component=loadModule('app/components/shared/account/SecuritySettings.tsx',{...uiMocks,react:harness.react,'@/lib/actions/identity.actions':{changeAccountPassword:async()=>({ok:false,error:'Check your current password.'})},'@/lib/auth-client':{authClient:{signOut:async()=>({error:{message:'PRIVATE_PROVIDER'}})}},'./EmailProofForm':'EmailProof','./AccountPreferencesProvider':{useAccountPreferences:()=>({settings:{preferences:loadModule('lib/account/preferences.ts').defaultPreferences}})},'@/lib/account/format':loadModule('lib/account/format.ts')}).default;
 const render=()=>harness.render(()=>Component({}));let tree=render();findNode(tree,n=>n.type==='Password'&&n.props.autoComplete==='current-password').props.onChange({target:{value:'Synthetic current secret'}});tree=render();for(let i=0;i<2;i++){findNode(tree,n=>n.type==='Password'&&n.props.autoComplete==='new-password'&&n.props.value==='').props.onChange({target:{value:'Synthetic new secret 123'}});tree=render();}
 findNode(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});await tick();tree=render();assert.equal(findNode(tree,n=>n.type==='Password'&&n.props.autoComplete==='current-password').props.value,'Synthetic current secret');assert.match(JSON.stringify(tree),/Check your current password/);
 await findNode(tree,n=>n.type==='Button'&&n.props.children==='Sign out current device').props.onClick();tree=render();assert.match(JSON.stringify(tree),/Couldn't sign out/);assert.doesNotMatch(JSON.stringify(tree),/PRIVATE_PROVIDER/);
});
test('export network failure releases controls without claiming a download',async()=>{
 const harness=hookHarness();const Component=loadModule('app/components/shared/account/PrivacySettings.tsx',{...uiMocks,react:harness.react,'@/app/components/legal/LegalAccountRecords':'Records','@/lib/actions/privacy.actions':{exportAccountData:async()=>{throw Error('PRIVATE_PROVIDER');}}}).default;
 const render=()=>harness.render(()=>Component({version:'fixture',terms:'/terms',privacy:'/privacy',retention:null}));let tree=render();await findNode(tree,n=>n.type==='Button'&&n.props.children==='Export my data').props.onClick();tree=render();assert.match(JSON.stringify(tree),/couldn't be exported/);assert.doesNotMatch(JSON.stringify(tree),/export is ready|PRIVATE_PROVIDER/);assert.equal(findNode(tree,n=>n.type==='Button'&&n.props.children==='Export my data').props.disabled,false);
});

test('header logout waits for success, blocks repeated taps and does not navigate after failure',async()=>{
 const harness=hookHarness();let resolve,calls=0,navigations=0;
 const Component=loadModule('app/components/shared/layouts/log-button.tsx',{
  '@/app/components/shared/account/SessionProvider':{useAuthSession:()=>({data:{user:{name:'Synthetic'}},status:'authenticated'})},
  '@/app/components/shared/account/SessionButton':{__esModule:true,default:'SessionButton'},
  react:harness.react,'react/jsx-runtime':jsxRuntime,'@/app/components/ui/button':{Button:'Button'},'next/link':{default:'Link',__esModule:true},'lucide-react':{User:'Icon'},'next/navigation':{useRouter:()=>({push(){navigations++;}})},'@/app/components/notifications/NotificationBell':'Bell','@/lib/auth-client':{authClient:{useSession:()=>({data:{user:{name:'Synthetic'}},isPending:false}),signOut:()=>{calls++;return new Promise(r=>{resolve=r;});}}},
 }).default;
 const render=()=>harness.render(()=>Component({}));let tree=render(),click=findNode(tree,n=>n.type==='Button'&&n.props.variant==='secondary').props.onClick;
 const pending=click();await click();assert.equal(calls,1);assert.equal(navigations,0);resolve({error:{message:'PRIVATE_PROVIDER'}});await pending;tree=render();assert.equal(navigations,0);assert.match(JSON.stringify(tree),/Couldn't sign out/);assert.doesNotMatch(JSON.stringify(tree),/PRIVATE_PROVIDER/);
 click=findNode(tree,n=>n.type==='Button'&&n.props.variant==='secondary').props.onClick;const retry=click();resolve({});await retry;assert.equal(navigations,1);
});

test('email proof preserves correctable errors but central availability notices are shown only once',async()=>{
 const harness=hookHarness();let outcome={ok:false,error:'Registration is not available right now. Please try again later.',code:'REGISTRATION_UNAVAILABLE'},calls=0,handled=0;
 const Component=loadModule('app/components/shared/account/EmailProofForm.tsx',{...uiMocks,react:harness.react,'@/lib/actions/identity.actions':{},'@/lib/account/email/signup-client':{beginSignupProof:async()=>{calls++;return outcome;}}}).default;
 const render=()=>harness.render(()=>Component({purpose:'signup',signupReady:true,signupAgreement:legalTypes.agreementFor(bundle),onRequestError:(_message,code)=>{if(code==='REGISTRATION_UNAVAILABLE'){handled++;return true;}return false;}}));
 let tree=render();assert.equal(findNode(tree,n=>n.type==='Button'&&n.props.type==='submit').props.disabled,false);await findNode(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});tree=render();assert.equal(calls,1);assert.equal(handled,1);assert.doesNotMatch(JSON.stringify(tree),/Registration is not available/);assert.ok(findNode(tree,n=>n.type==='Field'&&n.props.label==='Email'));
 outcome={ok:false,error:'Please enter a valid email address.'};await findNode(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});tree=render();assert.match(JSON.stringify(tree),/Please enter a valid email address/);
});

test('legal readers render website copy and reject drafts without availability clutter',async()=>{
 for(const draft of [true,false]){
  const doc=document('terms');doc.contentMarker='PRIVATE_DRAFT_FIXTURE';
  const Component=loadModule('app/components/legal/LegalReader.tsx',{'react/jsx-runtime':jsxRuntime,'next/navigation':{notFound(){throw Error('404');}},'next/link':{default:'Link',__esModule:true},'../shared/Brand':'Brand','../landing/LandingFooter':'Footer','./LegalActions':'Actions','../../(root)/landing.css':{},'./legal.css':{},'@/lib/legal/store':{publicDocument:async()=>({draft,document:doc,hash:'PRIVATE_HASH_FIXTURE',history:[]})}}).default;
  if(draft){await assert.rejects(Component({kind:'terms'}),/404/);continue;}
  const tree=await Component({kind:'terms'}),serialized=JSON.stringify(tree);assert.doesNotMatch(serialized,/Development review|PRIVATE_HASH_FIXTURE|PRIVATE_DRAFT_FIXTURE|not available yet|No other published versions/);
  assert.match(serialized,/Synthetic published fixture/);assert.equal(findNode(tree,n=>n.type==='Actions'),undefined);assert.ok(findNode(tree,n=>n.type==='Link'&&n.props.href==='/privacy'));
 }
});

test('Privacy settings have direct public links without a legal-history loader or empty placeholders',()=>{
 const harness=hookHarness();const Component=loadModule('app/components/shared/account/PrivacySettings.tsx',{...uiMocks,react:harness.react,'@/lib/actions/privacy.actions':{}}).default;
 const tree=harness.render(()=>Component({version:'0.1.0',terms:null,privacy:null,retention:null}));
 for(const href of ['/terms','/privacy']){const link=findNode(tree,n=>n.type==='a'&&n.props.href===href);assert.equal(link.props.target,'_blank');}
 assert.doesNotMatch(JSON.stringify(tree),/No acceptance|Loading legal|not available yet|data retention, contact|app version/);
});
