import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadModule,hookHarness,jsxRuntime,findNode,plain} from './helpers.mjs';
import {legalBundle,legalTypes} from './legal-fixture.mjs';

test('birth dates reject invalid/future values and remain calendar dates across daylight-saving boundaries',()=>{
 const {dateOfBirthSchema,registrationToday}=loadModule('lib/account/birth-date.ts');
 assert.equal(dateOfBirthSchema.parse('1992-02-29'),'1992-02-29');
 for(const value of ['',undefined,'1991-02-29','2099-01-01','2026-01-01T00:00:00Z'])assert.equal(dateOfBirthSchema.safeParse(value).success,false);
 assert.equal(registrationToday(new Date('2026-10-24T22:30:00Z')),'2026-10-25');
 assert.equal(registrationToday(new Date('2026-10-25T23:30:00Z')),'2026-10-26');
});

test('registration collects details once and creates the account immediately after verification, retaining details on a save error',async()=>{
 const harness=hookHarness(),effects=[],calls=[];
 const Form=loadModule('app/(auth)/auth/registration/reg-form.tsx',{
  react:{...harness.react,useCallback:fn=>fn,useEffect:fn=>effects.push(fn)},'react/jsx-runtime':jsxRuntime,'next/link':{},
  '@/app/(main)/account/gym/GymUI':{Field:'Field',GymButton:'Button'},'@/app/components/ui/password-input':{PasswordInput:'Password',PasswordInputStrengthChecker:'Strength'},
  '@/app/components/shared/account/EmailProofForm':{__esModule:true,default:'EmailProof'},'@/app/components/legal/LegalAgreementControl':{__esModule:true,default:'Agreement'},
  '@/app/components/shared/account/BirthDateField':{__esModule:true,default:'BirthDate'},
  '@/lib/legal/types':legalTypes,'@/lib/account/email/signup-client':{completeVerifiedSignup:async input=>{calls.push(plain(input));return {ok:false,error:'Synthetic save retry'};}},
 },{fetch:async()=>({ok:true,json:async()=>({bundle:legalBundle,registrationAvailable:true})})}).default;
 const render=()=>harness.render(()=>Form());
 const pending=findNode(render(),n=>n.type==='EmailProof');
 assert.ok(pending);assert.equal(pending.props.signupReady,false);
 assert.equal(await pending.props.onVerified(),false);assert.equal(calls.length,0);
 effects[0]();await new Promise(resolve=>setImmediate(resolve));
 let tree=render(),proof=findNode(tree,n=>n.type==='EmailProof');
 const fields=proof.props.signupFields.props.children;
 assert.equal(fields[0].props.children[0],'Password');assert.equal(fields[1].props.children[0],'Confirm password');assert.equal(fields[2].props.label,'Date of birth');assert.equal(fields[2].props.required,true);
 assert.equal(findNode(proof.props.signupFields,n=>n.type==='Password').props.minLength,8);
 assert.equal(proof.props.agreementControl.props.accepted,false);
 findNode(proof.props.signupFields,n=>n.type==='Password'&&n.props.value==='').props.onChange({target:{value:'Synthetic passphrase!'}});
 tree=render();proof=findNode(tree,n=>n.type==='EmailProof');assert.equal(proof.props.validateSignup(),'Passwords do not match.');
 findNode(proof.props.signupFields,n=>n.type==='Password'&&n.props.value==='').props.onChange({target:{value:'Synthetic passphrase!'}});
 findNode(proof.props.signupFields,n=>n.type==='BirthDate').props.onChange('2099-01-01');
 tree=render();proof=findNode(tree,n=>n.type==='EmailProof');assert.match(proof.props.validateSignup(),/future/);
 findNode(proof.props.signupFields,n=>n.type==='BirthDate').props.onChange('1992-02-29');
 tree=render();proof=findNode(tree,n=>n.type==='EmailProof');assert.equal(proof.props.validateSignup(),null);
 proof.props.agreementControl.props.onChange(true);tree=render();proof=findNode(tree,n=>n.type==='EmailProof');
 assert.equal(await proof.props.onVerified('fixture@example.invalid'),false);
 tree=render();proof=findNode(tree,n=>n.type==='EmailProof');
 assert.equal(findNode(tree,n=>n.type==='form'),undefined);
 assert.equal(findNode(proof.props.signupFields,n=>n.type==='BirthDate').props.value,'1992-02-29');
 assert.deepEqual(calls.map(({password,dateOfBirth})=>({password,dateOfBirth})),[{password:'Synthetic passphrase!',dateOfBirth:'1992-02-29'}]);assert.equal(calls[0].legal.accepted,true);
 assert.match(JSON.stringify(render()),/Synthetic save retry/);
});

function registrationFlow({confirmResult={ok:true,value:{verified:true}},complete}={}) {
 const parent=hookHarness(),child=hookHarness(),effects=[],trace=[];
 const Form=loadModule('app/(auth)/auth/registration/reg-form.tsx',{
  react:{...parent.react,useCallback:fn=>fn,useEffect:fn=>effects.push(fn)},'react/jsx-runtime':jsxRuntime,'next/link':{},
  '@/app/components/shared/account/BirthDateField':{__esModule:true,default:'BirthDate'},
  '@/app/(main)/account/gym/GymUI':{Field:'Field',GymButton:'Button'},'@/app/components/ui/password-input':{PasswordInput:'Password',PasswordInputStrengthChecker:'Strength'},
  '@/app/components/shared/account/EmailProofForm':{__esModule:true,default:'EmailProof'},'@/app/components/legal/LegalAgreementControl':{__esModule:true,default:'Agreement'},
  '@/lib/legal/types':legalTypes,'@/lib/account/email/signup-client':{completeVerifiedSignup:async input=>{trace.push(['create',plain(input)]);return complete?complete(input):{ok:true,value:{redirect:'/account'}};}},
 },{fetch:async()=>({ok:true,json:async()=>({bundle:legalBundle,registrationAvailable:true})}),window:{location:{assign:path=>trace.push(['redirect',path])}}}).default;
 const Proof=loadModule('app/components/shared/account/EmailProofForm.tsx',{
  react:child.react,'react/jsx-runtime':jsxRuntime,'@/app/(main)/account/gym/GymUI':{Field:'Field',GymButton:'Button'},'@/app/components/ui/password-input':{PasswordInput:'Password'},
  '@/lib/actions/identity.actions':{},
  '@/lib/account/email/signup-client':{
   beginSignupProof:async input=>{trace.push(['request',plain(input)]);return {ok:true,value:{message:'Code queued.',seconds:60}};},
   confirmSignupCode:async code=>{trace.push(['confirm',code]);return confirmResult;},
  },
 }).default;
 const renderParent=()=>parent.render(()=>Form());
 const render=()=>child.render(()=>Proof(findNode(renderParent(),n=>n.type==='EmailProof').props));
 const event={preventDefault(){}};
 const ready=async()=>{
  renderParent();effects[0]();await new Promise(resolve=>setImmediate(resolve));
  findNode(render(),n=>n.type==='Field'&&n.props.label==='Email').props.onChange({target:{value:'fixture@example.invalid'}});
  for(let i=0;i<2;i++)findNode(render(),n=>n.type==='Password'&&n.props.value==='').props.onChange({target:{value:'Synthetic passphrase!'}});
  findNode(render(),n=>n.type==='BirthDate').props.onChange('1992-02-29');
  findNode(render(),n=>n.type==='Agreement').props.onChange(true);
  await findNode(render(),n=>n.type==='form').props.onSubmit(event);
  findNode(render(),n=>n.type==='Field'&&n.props.label==='Six-digit code').props.onChange({target:{value:'000123'}});
 };
 return {ready,render,renderParent,trace,submit:()=>findNode(render(),n=>n.type==='form').props.onSubmit(event)};
}

test('one code confirmation creates the account and redirects without repeating password, birth date or acceptance fields',async()=>{
 const f=registrationFlow();await f.ready();
 let tree=f.render();
 assert.equal(findNode(tree,n=>n.type==='Password'),undefined);
 assert.equal(findNode(tree,n=>n.type==='BirthDate'),undefined);
 assert.equal(findNode(tree,n=>n.type==='Agreement'),undefined);
 assert.equal(findNode(tree,n=>n.type==='Button'&&n.props.type==='submit').props.children,'Confirm code');
 await f.submit();
 assert.deepEqual(f.trace.map(call=>call[0]),['request','confirm','create','redirect']);
 assert.equal(f.trace[1][1],'000123');
 assert.equal(f.trace[2][1].password,'Synthetic passphrase!');
 assert.equal(f.trace[2][1].dateOfBirth,'1992-02-29');
 assert.equal(f.trace[2][1].legal.accepted,true);
 assert.equal(f.trace[3][1],'/account');
 tree=f.render();assert.equal(findNode(tree,n=>n.type==='Password'),undefined);
 assert.equal(findNode(tree,n=>n.type==='BirthDate'),undefined);
 assert.equal(findNode(tree,n=>n.type==='Button'&&n.props.type==='submit'),undefined);
});

test('an incorrect or expired code never calls account creation or navigation',async()=>{
 for(const error of ['Code is incorrect.','Code expired.']){
  const f=registrationFlow({confirmResult:{ok:false,error}});await f.ready();await f.submit();
  assert.deepEqual(f.trace.map(call=>call[0]),['request','confirm']);
  assert.match(JSON.stringify(f.render()),new RegExp(error.replaceAll('.','\\.')));
  assert.equal(findNode(f.render(),n=>n.type==='Password'),undefined);
 }
});

test('confirmation waits for account creation, blocks duplicate taps and retries a failed save without consuming the proof twice',async()=>{
 let resolve;let attempts=0;
 const f=registrationFlow({complete:()=>++attempts===1?new Promise(done=>{resolve=done;}):{ok:true,value:{redirect:'/account'}}});
 await f.ready();const pending=f.submit();await new Promise(done=>setImmediate(done));
 assert.equal(findNode(f.render(),n=>n.type==='Button'&&n.props.type==='submit').props.disabled,true);
 assert.equal(findNode(f.render(),n=>n.type==='Field'&&n.props.label==='Six-digit code').props.disabled,true);
 assert.doesNotMatch(JSON.stringify(f.render()),/Email verified/);
 await f.submit();assert.equal(attempts,1);
 resolve({ok:false,error:'Please retry saving your account.'});await pending;
 assert.match(JSON.stringify(f.renderParent()),/Please retry saving your account/);
 assert.equal(findNode(f.render(),n=>n.type==='Field'&&n.props.label==='Six-digit code').props.value,'000123');
 assert.equal(findNode(f.render(),n=>n.type==='Password'),undefined);
 await f.submit();assert.equal(attempts,2);
 assert.deepEqual(f.trace.map(call=>call[0]),['request','confirm','create','create','redirect']);
});

test('signup details validation prevents verification emails for mismatched credentials',async()=>{
 const harness=hookHarness();let calls=0;
 const Proof=loadModule('app/components/shared/account/EmailProofForm.tsx',{
  react:harness.react,'react/jsx-runtime':jsxRuntime,'@/app/(main)/account/gym/GymUI':{Field:'Field',GymButton:'Button'},'@/app/components/ui/password-input':{PasswordInput:'Password'},
  '@/lib/actions/identity.actions':{},'@/lib/account/email/signup-client':{beginSignupProof:async()=>{calls++;}},
 }).default;
 const render=()=>harness.render(()=>Proof({purpose:'signup',signupReady:true,validateSignup:()=> 'Passwords do not match.'}));
 await findNode(render(),n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(calls,0);assert.match(JSON.stringify(render()),/Passwords do not match/);
});

test('the real authentication adapter stores private birth dates atomically with the credential and preserves existing accounts',async()=>{
 const {PGlite}=await import('@electric-sql/pglite'),{drizzle}=await import('drizzle-orm/pglite'),orm=await import('drizzle-orm'),pg=await import('drizzle-orm/pg-core');
 const {betterAuth}=await import('better-auth'),{drizzleAdapter}=await import('better-auth/adapters/drizzle'),{createAuthMiddleware,APIError}=await import('better-auth/api');
 const schema=loadModule('lib/db/schema.ts',{'drizzle-orm':orm,'drizzle-orm/pg-core':pg});
 const db=await PGlite.create();
 try{
  await db.exec(`
   CREATE TABLE "user"(id text PRIMARY KEY,name text NOT NULL,email text NOT NULL UNIQUE,email_verified boolean NOT NULL DEFAULT false,image text,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now(),"groqKey" text DEFAULT 'NO Key');
   CREATE TABLE account(id text PRIMARY KEY,account_id text NOT NULL,provider_id text NOT NULL,user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,access_token text,refresh_token text,id_token text,access_token_expires_at timestamp,refresh_token_expires_at timestamp,scope text,password text,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now());
   CREATE TABLE session(id text PRIMARY KEY,expires_at timestamp NOT NULL,token text NOT NULL UNIQUE,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now(),ip_address text,user_agent text,user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE);
   CREATE TABLE verification(id text PRIMARY KEY,identifier text NOT NULL,value text NOT NULL,expires_at timestamp NOT NULL,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now());
   INSERT INTO "user"(id,name,email,email_verified) VALUES('existing','Existing fixture','existing@example.invalid',true);
  `);
  const migration=readFileSync('lib/db/0032_registration_birth_date.sql','utf8');await db.exec(migration);await db.exec(migration);
  assert.equal((await db.query("SELECT date_of_birth FROM \"user\" WHERE id='existing'")).rows[0].date_of_birth,null);
  let context,failCredential=false;
  const appAuth=loadModule('lib/auth.ts',{
   'better-auth':{betterAuth:options=>{options.secret='synthetic-auth-secret-over-thirty-two-characters';options.databaseHooks.account={create:{before:async()=>{if(failCredential)throw new APIError('BAD_REQUEST',{message:'Synthetic credential failure'});}}};options.logger={disabled:true};return betterAuth(options);}},
   'better-auth/adapters/drizzle':{drizzleAdapter},'better-auth/api':{createAuthMiddleware,APIError},'@better-auth/expo':{expo:()=>({})},'./db/auth-drizzle':{authDb:drizzle(db,{schema})},'better-auth/next-js':{nextCookies:()=>({id:'test-cookies'})},
   './account/identity-context':{identityContext:()=>context},'./account/password':{validateNewPassword:async()=>{}},'./account/email/recovery':{},
   './legal/store':{publishedBundle:async()=>legalBundle},'./legal/validation':{validateAgreement:input=>assert.equal(input.accepted,true)},'./account/signup':{assertVerifiedSignupProof:async(id,email)=>{assert.equal(id,'new-owned-id');assert.equal(email,'new@example.invalid');}},
  },{process:{env:{APP_URL:'http://localhost:3000'}}}).auth;
  const signup=()=>appAuth.api.signUpEmail({body:{name:'New fixture',email:'new@example.invalid',password:'Synthetic passphrase!'}});
  context={purpose:'signup',email:'new@example.invalid',userId:'new-owned-id',passwordValidated:true,legal:{accepted:true},dateOfBirth:'2099-01-01'};
  await assert.rejects(signup);assert.equal((await db.query('SELECT count(*)::int AS n FROM "user"')).rows[0].n,1);
  context.dateOfBirth='1992-02-29';failCredential=true;await assert.rejects(signup);assert.equal((await db.query('SELECT count(*)::int AS n FROM "user"')).rows[0].n,1);assert.equal((await db.query('SELECT count(*)::int AS n FROM account')).rows[0].n,0);
  failCredential=false;const created=await signup();assert.equal(created.user.id,'new-owned-id');assert.equal(Object.hasOwn(created.user,'dateOfBirth'),false);
  assert.equal((await db.query("SELECT date_of_birth::text AS dob,email_verified FROM \"user\" WHERE id='new-owned-id'")).rows[0].dob,'1992-02-29');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM account WHERE user_id='new-owned-id' AND provider_id='credential' AND password IS NOT NULL")).rows[0].n,1);
  await db.exec("SET TIME ZONE 'America/Los_Angeles'");assert.equal((await db.query("SELECT date_of_birth::text AS dob FROM \"user\" WHERE id='new-owned-id'")).rows[0].dob,'1992-02-29');
 }finally{await db.close();}
});
