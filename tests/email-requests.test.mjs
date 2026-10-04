import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule, hookHarness, jsxRuntime, findNode, plain} from './helpers.mjs';
import {legalValidation, legalBundle, legalAgreement} from './legal-fixture.mjs';

const uiMocks = {'react/jsx-runtime':jsxRuntime, 'next/link':{__esModule:true,default:'Link'}, '@/app/(main)/account/gym/GymUI':{Field:'Field',GymButton:'Button'}, '@/app/components/ui/password-input':{PasswordInput:'Password'}};
const event = {preventDefault(){}};
function formFixture(file, actions, props) {
  const harness = hookHarness();
  const Component = loadModule(file, {...uiMocks,react:harness.react,'@/lib/actions/identity.actions':actions}).default;
  return () => harness.render(() => Component(props));
}
const emailForm = 'app/components/shared/account/EmailProofForm.tsx';
const recoveryForm = 'app/(auth)/auth/forgot-password/RecoveryForm.tsx';

test('ready signup requests a code without a widget, then requires explicit code confirmation', async () => {
  const calls = [];
  const render = formFixture(emailForm, {
    beginEmailProof:async input => {calls.push(plain(input));return {ok:true,value:{message:'Code queued.',seconds:60}};},
    confirmEmailCode:async code => {calls.push(code);return {ok:true,value:{verified:true}};},
  }, {purpose:'signup',initialEmail:'fixture@example.invalid',signupReady:true,signupAgreement:legalAgreement});
  let tree = render();
  assert.equal(findNode(tree,n=>n.type==='Button'&&n.props.type==='submit').props.disabled,false);
  await findNode(tree,n=>n.type==='form').props.onSubmit(event);
  assert.deepEqual(calls,[{email:'fixture@example.invalid',purpose:'signup',legal:plain(legalAgreement)}]);
  tree = render();assert.ok(findNode(tree,n=>n.type==='Field'&&n.props.label==='Six-digit code'));
  assert.ok(findNode(tree,n=>n.type==='Button'&&n.props.disabled&&String(n.props.children).includes('Resend in')));
  assert.doesNotMatch(JSON.stringify(tree),/Email verified/);
  findNode(tree,n=>n.type==='Field'&&n.props.label==='Six-digit code').props.onChange({target:{value:'000123'}});
  tree = render();await findNode(tree,n=>n.type==='form').props.onSubmit(event);
  assert.equal(calls[1],'000123');assert.match(JSON.stringify(render()),/Email verified/);
});

test('signup still requires agreement and unavailable registration cannot send', async () => {
  let calls = 0;
  for (const signupReady of [true,false]) {
    const render = formFixture(emailForm,{beginEmailProof:async()=>{calls++;}}, {purpose:'signup',signupReady});
    await findNode(render(),n=>n.type==='form').props.onSubmit(event);
    if (signupReady) assert.match(JSON.stringify(render()),/Please agree to the Terms/);
    else assert.equal(findNode(render(),n=>n.type==='Button'&&n.props.type==='submit').props.disabled,true);
  }
  assert.equal(calls,0);
});

test('account email changes continue to send the current password for server reauthentication', async () => {
  let input;
  const render = formFixture(emailForm,{beginEmailProof:async value=>{input=plain(value);return {ok:false,error:'Check your current password.'};}}, {purpose:'email-change',initialEmail:'new@example.invalid'});
  findNode(render(),n=>n.type==='Password').props.onChange({target:{value:'Synthetic current password'}});
  await findNode(render(),n=>n.type==='form').props.onSubmit(event);
  assert.deepEqual(input,{email:'new@example.invalid',purpose:'email-change',currentPassword:'Synthetic current password'});
  assert.match(JSON.stringify(render()),/Check your current password/);
});

test('recovery sends email and migration choice without a widget and prevents repeated pending taps', async () => {
  let resolve;const calls=[];
  const render = formFixture(recoveryForm,{requestRecovery:input=>{calls.push(plain(input));return new Promise(r=>{resolve=r;});}});
  let tree=render();assert.equal(findNode(tree,n=>n.type==='Button'&&n.props.type==='submit').props.disabled,false);
  findNode(tree,n=>n.type==='Field').props.onChange({target:{value:'fixture@example.invalid'}});
  findNode(tree,n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});
  const submit=findNode(render(),n=>n.type==='form').props.onSubmit;
  const pending=submit(event);await submit(event);
  assert.deepEqual(calls,[{email:'fixture@example.invalid',migration:true}]);
  assert.equal(findNode(render(),n=>n.type==='Button'&&n.props.type==='submit').props.disabled,true);
  resolve({ok:true,value:{message:'If eligible, a link will arrive.'}});await pending;
  assert.match(JSON.stringify(render()),/If eligible/);
  assert.equal(findNode(render(),n=>n.type==='Button'&&n.props.type==='submit').props.disabled,false);
});

test('recovery network failure retains input and permits retry without a fabricated success', async () => {
  let calls=0;
  const render = formFixture(recoveryForm,{requestRecovery:async()=>{calls++;if(calls===1)throw Error('PRIVATE_PROVIDER');return {ok:true,value:{message:'If eligible, a link will arrive.'}};}});
  findNode(render(),n=>n.type==='Field').props.onChange({target:{value:'fixture@example.invalid'}});
  await findNode(render(),n=>n.type==='form').props.onSubmit(event);
  let tree=render();assert.match(JSON.stringify(tree),/Please try again/);assert.doesNotMatch(JSON.stringify(tree),/PRIVATE_PROVIDER|a link will arrive/);
  assert.equal(findNode(tree,n=>n.type==='Field').props.value,'fixture@example.invalid');
  assert.equal(findNode(tree,n=>n.type==='Button'&&n.props.type==='submit').props.disabled,false);
  await findNode(tree,n=>n.type==='form').props.onSubmit(event);assert.match(JSON.stringify(render()),/a link will arrive/);assert.equal(calls,2);
});

function actionFixture({origin='http://localhost:3000', budget=true, owner={id:'owner',email:'owner@example.invalid'}}={}) {
  const trace=[], requestHeaders=new Headers({origin});
  const config=loadModule('lib/account/config.ts',{}, {process:{env:{APP_URL:'http://localhost:3000'}}});
  const policy=loadModule('lib/account/email/policy.ts',{'../store':{},'./crypto':{},'../config':config});
  let proof;
  const actions=loadModule('lib/actions/identity.actions.ts',{
    'next/headers':{headers:async()=>requestHeaders,cookies:async()=>({get:()=>proof?{value:proof}:undefined,set(_key,value){proof=value;trace.push('cookie');}})},
    '../auth':{auth:{api:{getSession:async()=>({user:owner}),signInEmail:async()=>trace.push('reauthenticate'),requestPasswordReset:async()=>trace.push('reset')}}},
    'better-auth/api':{},'../account/store':{accountSql:async()=>{trace.push('lookup');return [{id:owner.id,credential:true}];}},'../account/config':config,
    '../account/identity-context':{withIdentity:async(_context,fn)=>fn()},
    '../account/email/policy':{...policy,requestBudget:async()=>{trace.push('budget');return budget;}},
    '../account/email/challenges':{createChallenge:async()=>{trace.push('challenge');return {token:'synthetic-proof',message:'Code queued',seconds:60};},challengeState:async()=>({email:'fixture@example.invalid',purpose:'signup',owner_id:null,expires_at:'2099-01-01T00:00:00Z',wait_seconds:60})},
    '../account/email/delivery':{resendClient:()=>trace.push('configured-mail'),processMailQueue:async()=>trace.push('delivery')},
    '../account/email/templates':{},'../account/email/crypto':{},'../account/password':{},'../session':{},
    '../legal/validation':legalValidation,'../legal/store':{publishedBundle:async()=>legalBundle},'../account/signup':{},
  });
  return {actions,trace};
}

test('signup action accepts email plus current agreement, rejects a foreign origin and reuses proof on retry', async () => {
  const input={email:'fixture@example.invalid',purpose:'signup',legal:legalAgreement};
  const denied=actionFixture({origin:'https://foreign.invalid'});
  assert.equal((await denied.actions.beginEmailProof(input)).ok,false);assert.deepEqual(denied.trace,[]);
  const f=actionFixture();assert.equal((await f.actions.beginEmailProof(input)).ok,true);
  assert.equal((await f.actions.beginEmailProof(input)).ok,true);
  assert.deepEqual(f.trace,['challenge','cookie','delivery']);
});

test('recovery action keeps origin enforcement and source budgets before account lookup or email delivery', async () => {
  const input={email:'fixture@example.invalid'};
  let f=actionFixture({origin:'https://foreign.invalid'});assert.equal((await f.actions.requestRecovery(input)).ok,false);assert.deepEqual(f.trace,[]);
  f=actionFixture({budget:false});const limited=await f.actions.requestRecovery(input);assert.equal(limited.ok,true);assert.deepEqual(f.trace,['configured-mail','budget']);assert.match(limited.value.message,/If this address/);
  f=actionFixture();const allowed=await f.actions.requestRecovery(input);assert.equal(allowed.ok,true);assert.deepEqual(f.trace,['configured-mail','budget','lookup','reset','delivery']);assert.equal(allowed.value.message,limited.value.message);
});

test('email change reauthenticates before requesting proof and cannot verify someone else’s login email', async () => {
  let f=actionFixture();assert.equal((await f.actions.beginEmailProof({email:'new@example.invalid',purpose:'email-change',currentPassword:'Synthetic current password'})).ok,true);
  assert.deepEqual(f.trace,['reauthenticate','challenge','cookie','delivery']);
  f=actionFixture();assert.equal((await f.actions.beginEmailProof({email:'someone@example.invalid',purpose:'verify-account'})).ok,false);assert.deepEqual(f.trace,[]);
});
