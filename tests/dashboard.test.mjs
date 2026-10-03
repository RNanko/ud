import test from "node:test";
import assert from "node:assert/strict";
import {loadModule,jsxRuntime} from './helpers.mjs';
test('account loads owned settings and exposes no avatar uploader or mixed dashboard',async()=>{
 let seen;
 const Page=loadModule('app/(main)/account/page.tsx',{'react/jsx-runtime':jsxRuntime,react:{Suspense:'Suspense'},'@/app/components/shared/loader':'Loader','@/lib/session':{requireUserId:async()=>'alice'},'@/lib/actions/account.actions':{__esModule:true,default:async owner=>{seen=owner;return {name:'Fixture',email:'fixture@example.invalid',emailVerified:true,createdAt:new Date('2026-10-03T00:00:00Z')};}},'@/lib/actions/billing.actions':{membershipStatus:async()=>({ok:true,value:{access:{state:'launch-transition'}}})},'./AccountSettingsClient':'Settings','@/package.json':{version:'0.1.0'}}).default;
 const tree=await Page().props.children.type();assert.equal(seen,'alice');assert.equal(tree.type,'Settings');assert.equal(tree.props.user.createdAt,'2026-10-03T00:00:00.000Z');assert.equal(tree.props.trialDays,14);assert.equal(tree.props.user.image,undefined);
});
