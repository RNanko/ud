import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';
const { mobileWebsiteOrigin } = loadModule('lib/mobile/web-origin.ts');
test('native website override preserves the fallback and uses only explicit plain trusted origins',()=>{
  assert.equal(mobileWebsiteOrigin('http://localhost:3000',undefined,true),'http://localhost:3000');
  assert.equal(mobileWebsiteOrigin('http://localhost:3000','https://b1-way-mf.vercel.app',true),'https://b1-way-mf.vercel.app');
  assert.equal(mobileWebsiteOrigin('https://example.test',undefined,false),'https://example.test');
  for(const bad of ['http://external.test','https://owner:secret@example.test','https://example.test/path','https://example.test/?token=private','https://example.test/#token','javascript:alert(1)']) assert.throws(()=>mobileWebsiteOrigin('http://localhost:3000',bad,true));
  assert.throws(()=>mobileWebsiteOrigin('http://localhost:3000',undefined,false));
});
