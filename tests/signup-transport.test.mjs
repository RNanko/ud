import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule, plain, hookHarness, findNode, jsxRuntime} from './helpers.mjs';
import {legalAgreement} from './legal-fixture.mjs';

function endpointFixture() {
  const calls=[];
  const success={ok:true,value:{message:'Code queued.',seconds:60}};
  const actions={
    beginEmailProof:async input=>{calls.push(['request',plain(input)]);return success;},
    resendEmailProof:async()=>{calls.push(['resend']);return success;},
    confirmEmailCode:async code=>{calls.push(['confirm',code]);return {ok:true,value:{verified:true}};},
    completeSignup:async input=>{calls.push(['complete',plain(input)]);return {ok:true,value:{redirect:'/account'}};},
  };
  const {POST}=loadModule('app/api/public/signup/route.ts',{
    '@/lib/account/config':{appOrigin:()=> 'https://fixture.example'},
    '@/lib/account/result':loadModule('lib/account/result.ts'),
    '@/lib/actions/identity.actions':actions,
  });
  const post=(body,headers={})=>POST(new Request('https://fixture.example/api/public/signup',{
    method:'POST',headers:{origin:'https://fixture.example','content-type':'application/json',...headers},
    body:typeof body==='string'?body:JSON.stringify(body),
  }));
  return {calls,actions,post};
}

test('signup JSON requests reuse the existing proof, verification and account-creation actions without returning a route refresh',async()=>{
  const f=endpointFixture();
  const client=loadModule('lib/account/email/signup-client.ts',{}, {fetch:async(url,options)=>{
    assert.equal(url,'/api/public/signup');
    assert.equal(options.method,'POST');assert.equal(options.credentials,'same-origin');
    assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
    assert.deepEqual(plain(options.headers),{'Content-Type':'application/json'});
    const response=await f.post(options.body);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(response.headers.get('x-action-revalidated'),null);
    return response;
  }});
  await client.beginSignupProof({email:'fixture@example.invalid',legal:legalAgreement});
  await client.resendSignupProof();await client.confirmSignupCode('000123');
  const completed=await client.completeVerifiedSignup({password:'Synthetic passphrase!',dateOfBirth:'1992-02-29',legal:legalAgreement});
  assert.deepEqual(plain(completed),{ok:true,value:{redirect:'/account'}});
  assert.deepEqual(f.calls.map(call=>call[0]),['request','resend','confirm','complete']);
  assert.deepEqual(f.calls[0][1],{email:'fixture@example.invalid',legal:plain(legalAgreement),purpose:'signup'});
  assert.deepEqual(f.calls[3][1],{password:'Synthetic passphrase!',dateOfBirth:'1992-02-29',legal:plain(legalAgreement)});
});

test('signup endpoint rejects foreign or missing origins, cross-site requests, invalid JSON and attempts to invoke another email flow',async()=>{
  const f=endpointFixture(),body={operation:'request',email:'fixture@example.invalid',legal:legalAgreement};
  for(const headers of [{origin:'https://foreign.invalid'},{origin:''},{'sec-fetch-site':'cross-site'},{'content-type':'text/plain'}]) {
    assert.equal((await (await f.post(body,headers)).json()).ok,false);
  }
  for(const invalid of ['{', {...body,purpose:'email-change'}, {operation:'confirm',code:'123'}, {operation:'complete',password:'fixture',dateOfBirth:'1992-02-29',legal:legalAgreement,userId:'someone-else'}, {operation:'unknown'}]) {
    assert.equal((await (await f.post(invalid)).json()).ok,false);
  }
  assert.deepEqual(f.calls,[]);
});

test('signup endpoint preserves recoverable proof and legal errors instead of reporting successful verification',async()=>{
  const f=endpointFixture();
  f.actions.confirmEmailCode=async()=>({ok:false,error:'Code expired.'});
  assert.deepEqual(await (await f.post({operation:'confirm',code:'000123'})).json(),{ok:false,error:'Code expired.'});
  f.actions.completeSignup=async()=>({ok:false,error:'Review updated documents.',code:'LEGAL_VERSIONS_CHANGED'});
  assert.deepEqual(await (await f.post({operation:'complete',password:'Synthetic passphrase!',dateOfBirth:'1992-02-29',legal:legalAgreement})).json(),
    {ok:false,error:'Review updated documents.',code:'LEGAL_VERSIONS_CHANGED'});
});

test('signup transport never treats an HTML redirect or failed HTTP response as a requested code',async()=>{
  for(const response of [new Response('<form>Registration</form>',{headers:{'content-type':'text/html'}}),new Response('Unavailable',{status:503})]) {
    const client=loadModule('lib/account/email/signup-client.ts',{}, {fetch:async()=>response});
    await assert.rejects(client.beginSignupProof({email:'fixture@example.invalid',legal:legalAgreement}),/could not be completed/);
  }
});

test('after a JSON code request, resend and confirmation failures retain the code step and entered code',async()=>{
  const harness=hookHarness();let fail=false;const calls=[];
  const client=loadModule('lib/account/email/signup-client.ts',{}, {fetch:async(_url,options)=>{
    const command=JSON.parse(options.body);calls.push(command.operation);
    if(fail)throw Error('Disconnected');
    return Response.json({ok:true,value:{message:'Code queued.',seconds:0}});
  }});
  const Proof=loadModule('app/components/shared/account/EmailProofForm.tsx',{
    react:harness.react,'react/jsx-runtime':jsxRuntime,
    '@/app/(main)/account/gym/GymUI':{Field:'Field',GymButton:'Button'},
    '@/app/components/ui/password-input':{PasswordInput:'Password'},
    '@/lib/account/email/signup-client':client,
    '@/lib/actions/identity.actions':new Proxy({}, {get(){throw Error('Signup must not invoke a route-refreshing Server Action');}}),
  }).default;
  const render=()=>harness.render(()=>Proof({purpose:'signup',initialEmail:'fixture@example.invalid',signupReady:true,signupAgreement:legalAgreement}));
  await findNode(render(),n=>n.type==='form').props.onSubmit({preventDefault(){}});
  findNode(render(),n=>n.props.label==='Six-digit code').props.onChange({target:{value:'000123'}});
  fail=true;
  await findNode(render(),n=>n.type==='Button'&&n.props.children==='Resend code').props.onClick();
  assert.equal(findNode(render(),n=>n.props.label==='Six-digit code').props.value,'000123');
  assert.equal(findNode(render(),n=>n.type==='Button'&&n.props.children==='Send verification code'),undefined);
  await findNode(render(),n=>n.type==='form').props.onSubmit({preventDefault(){}});
  assert.equal(findNode(render(),n=>n.props.label==='Six-digit code').props.value,'000123');
  assert.equal(findNode(render(),n=>n.type==='Button'&&n.props.children==='Confirm code').props.disabled,false);
  assert.deepEqual(calls,['request','resend','confirm']);
});
