import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule,jsxRuntime,findNode} from './helpers.mjs';

const now=Date.parse('2026-10-05T12:00:00Z');
const end=new Date(now+14*86400000).toISOString();
const display=loadModule('lib/account/membership-display.ts');
const trial={checkedAt:new Date(now).toISOString(),access:{state:'trial',end},trialEnd:end};

test('remaining time handles exact days, the final day, expiry and invalid dates without negative or fabricated values',()=>{
 for(const [time,expected] of [[14*86400000,'14 days left'],[86400000,'1 day left'],[86400000+1,'2 days left'],[5*60000,'Less than a day left'],[0,'Expired'],[-1,'Expired']]) {
   assert.equal(display.remainingMembershipTime(new Date(now+time).toISOString(),now),expected);
 }
 for(const value of [null,undefined,'invalid'])assert.equal(display.remainingMembershipTime(value,now),null);
});

test('trial and paid projections use their confirmed period, preserve renewal-off access and do not label blocked access as active',()=>{
 const t=display.membershipDisplay(trial,now);assert.equal(t.label,'Free trial');assert.equal(t.remaining,'14 days left');assert.match(t.note,/will not charge/);
 const paidEnd=new Date(now+200*86400000).toISOString();
 const paid={...trial,access:{state:'paid',end:paidEnd},paidThrough:paidEnd,renewalOff:false};
 const p=display.membershipDisplay(paid,now);assert.equal(p.label,'Paid membership');assert.equal(p.remaining,'200 days left');assert.equal(p.end,paidEnd);assert.equal(p.endLabel,'Renews');
 const canceled=display.membershipDisplay({...paid,access:{...paid.access,state:'paid-renewal-off'},renewalOff:true},now);
 assert.equal(canceled.remaining,'200 days left');assert.equal(canceled.endLabel,'Access ends');assert.match(canceled.note,/Renewal is off/);
 const ended=display.membershipDisplay(trial,Date.parse(end));assert.equal(ended.label,'Trial ended');assert.equal(ended.remaining,'Expired');
 for(const state of ['verification-required','deletion-pending','expired']) {
   const blocked=display.membershipDisplay({...paid,access:{state,end:null}},now);
   assert.equal(blocked.remaining,null);assert.doesNotMatch(blocked.label,/Free trial|Paid membership/);
 }
});

function summary(status,clock=now){
 const preferences=loadModule('lib/account/preferences.ts').defaultPreferences;
 const Component=loadModule('app/components/shared/account/MembershipAccessSummary.tsx',{
   react:{useSyncExternalStore:(_subscribe,getSnapshot,getServerSnapshot)=>{assert.equal(typeof getSnapshot,'function');assert.equal(getServerSnapshot(),status?.checkedAt?Date.parse(status.checkedAt):0);return clock;}},
   'react/jsx-runtime':jsxRuntime,'lucide-react':{BadgeCheck:'BadgeCheck',Clock3:'Clock3'},
   '@/app/(main)/account/gym/GymUI':{GymButton:'Button'},'@/lib/account/format':loadModule('lib/account/format.ts'),
   '@/lib/account/membership-display':display,'./AccountPreferencesProvider':{useAccountPreferences:()=>({settings:{preferences}})},
 }).default;
 let managed=0;
 return {tree:Component({status,onManage:()=>managed++}),managed:()=>managed};
}

test('membership card exposes days, preference-formatted end date and a management action; absent data never shows an active plan',()=>{
 const t=summary(trial);assert.match(JSON.stringify(t.tree),/Free trial|14 days left|Trial ends/);
 assert.match(JSON.stringify(t.tree),/19\/10\/2026/);
 findNode(t.tree,n=>n.type==='Button').props.onClick();assert.equal(t.managed(),1);
 const paid=summary({...trial,access:{state:'paid',end},paidThrough:end,renewalOff:true});
 assert.match(JSON.stringify(paid.tree),/Paid membership|14 days left|Renewal is off/);
 const unavailable=summary(null);assert.match(JSON.stringify(unavailable.tree),/couldn/);assert.doesNotMatch(JSON.stringify(unavailable.tree),/days left|Free trial|Paid membership/);
 const expired=summary(trial,Date.parse(end));assert.match(JSON.stringify(expired.tree),/Trial ended|Expired/);
});
