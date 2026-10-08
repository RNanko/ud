import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
import {dates,events,blueprint,logic as gymLogic} from './gym-fixture.mjs';
import {types,logic,goalEvaluation,emptySources,content} from './momentum-fixture.mjs';
const prefs=loadModule('lib/account/preferences.ts');
export const contract=loadModule('lib/notifications/types.ts');
export const producer=loadModule('lib/notifications/produce.ts',{'../gym/dates':dates,'../events':events,'../momentum/logic':logic,'../momentum/goals/evaluate':goalEvaluation});
const input=()=>({sources:emptySources(),momentum:types.emptyMomentum(),preferences:{...prefs.defaultPreferences,timezone:'Europe/Warsaw'},notifications:{...prefs.defaultNotifications,quietHours:false},initializedAt:'2026-10-03T00:00:00.000Z',first:false,known:new Set(),now:'2026-10-03T15:59:00.000Z'});
const timedEvent=(value,patch={})=>{value.sources.weeks=[{week:'2026-WK40',data:events.weekdays.map(day=>({day,tasks:[]})).map(day=>({...day,tasks:day.day==='Saturday'?[{id:'event-1',title:'Fixture event',timing:{start:'18:30',duration:null,overnight:false,reminderMinutes:30},...patch}]:[]}))}];return value;};
test('disabled money tracking withdraws money notifications while retaining recorded goals and contributions',()=>{
 const v=input(),scopeId=crypto.randomUUID(),id=crypto.randomUUID(),goal={id,name:'Contribution fixture',lifecycle:'active',hidden:false,pinned:false,order:0,createdAt:v.now,updatedAt:v.now,reminder:{enabled:false,days:[6],time:'09:00',leadDays:null},versions:[{revision:1,effectiveFrom:'2026-10-01',rule:{metric:'investment',target:10000,currency:'USD',period:'monthly',start:'2026-10-01',end:null,timezone:'Europe/Warsaw',scopeId,sources:[],journeyId:null,throughout:false,freshnessDays:7}}]};
 v.momentum.tracker={...loadModule('lib/momentum/goals/types.ts').emptyTracker(),goals:[goal],scopes:[{id:scopeId,name:'Fixture',kind:'investment',currency:'USD',createdAt:v.now}],records:[{id:crypto.randomUUID(),scopeId,kind:'contribution',reference:'fixture',date:'2026-10-03',occurredAt:'2026-10-03T10:00:00Z',value:10000,note:'',linkedFocusId:null,confirmedThrough:null,updatedAt:v.now}]};
 v.momentum.preferences.money=true;assert.ok(producer.produceMessages(v).some(x=>x.target?.kind==='goal'));
 v.momentum.preferences.money=false;assert.equal(producer.produceMessages(v).some(x=>x.target?.kind==='goal'),false);assert.equal(v.momentum.tracker.records.length,1);
 v.momentum.preferences.money=true;assert.ok(producer.produceMessages(v).some(x=>x.target?.kind==='goal'));
});
test('18:30 reminder is pending before its lead time, appears once when due and stays available after start',()=>{
 const v=timedEvent(input());let result=producer.produceMessages(v);assert.equal(result.length,1);assert.ok(result[0].availableAt>v.now);
 v.now='2026-10-03T16:00:00.000Z';result=producer.produceMessages(v);assert.equal(result[0].availableAt,v.now);assert.equal(result[0].expiresAt,'2026-10-04T16:30:00.000Z');assert.equal(result[0].suppressed,false);
 assert.equal(producer.produceMessages(v)[0].key,result[0].key);
 v.now='2026-10-03T16:30:00.000Z';result=producer.produceMessages(v);assert.equal(result.length,1);assert.match(result[0].body,/start.*passed/);assert.equal(result[0].key,'reminder:event:event-1');
 v.now='2026-10-04T16:29:00.000Z';assert.equal(producer.produceMessages(v).filter(m=>m.category==='event_reminder').length,1);
 v.now='2026-10-04T16:30:00.000Z';assert.equal(producer.produceMessages(v).filter(m=>m.category==='event_reminder').length,0);
});
test('completion, removal, untimed and Off never produce a fabricated reminder; rescheduling updates the same key',()=>{
 for(const patch of [{completed:true},{timing:{start:null,reminderMinutes:null}},{timing:{start:'18:30',reminderMinutes:null}}])assert.equal(producer.produceMessages(timedEvent(input(),patch)).length,0);
 const v=timedEvent(input()),before=producer.produceMessages(v)[0];v.sources.weeks[0].data[5].tasks[0].timing.start='19:00';const after=producer.produceMessages(v)[0];assert.equal(after.key,before.key);assert.notEqual(after.availableAt,before.availableAt);
 v.sources.weeks[0].data[5].tasks=[];assert.equal(producer.produceMessages(v).length,0);
});
test('Gym and its linked Events card share one reminder; active or completed sessions remove it',()=>{
 const v=input(),routine={...blueprint(),timing:{start:'18:30',reminderMinutes:30}};
 v.sources.gym.plans.push({id:'plan-1',date:'2026-10-03',timezone:'Europe/Warsaw',revision:0,data:routine});
 timedEvent(v,{kind:'training',workout:{planId:'plan-1'}});assert.equal(producer.produceMessages(v).length,1);assert.equal(producer.produceMessages(v)[0].key,'reminder:workout:plan-1');
 const session={id:'session-1',planId:'plan-1',data:{...gymLogic.newSession(routine,'2026-10-03','Europe/Warsaw',false,true),status:'active'},revision:0};v.sources.gym.sessions.push(session);assert.equal(producer.produceMessages(v).length,0);
});
test('completion confirmation preserves no-measurements language, edits keep identity, old history is not seeded',()=>{
 const v=input();v.sources.gym.sessions.push({id:'s',planId:null,revision:0,data:{...gymLogic.newSession(blueprint(),'2026-10-03','Europe/Warsaw',true,false),status:'completed',finishedAt:'2026-10-03T15:00:00.000Z',completionMode:'confirmation'}});
 let m=producer.produceMessages(v)[0];assert.equal(m.key,'completed:s');assert.match(m.body,/no measurements/);assert.doesNotMatch(m.body,/sets|kg|minutes/);
 v.sources.gym.sessions[0].data.name='Renamed by user';assert.equal(producer.produceMessages(v)[0].key,m.key);
 v.sources.gym.sessions[0].data.finishedAt='2026-09-01T10:00:00.000Z';assert.equal(producer.produceMessages(v).length,0);
 v.known.add('completed:s');assert.equal(producer.produceMessages(v).length,1);
});
test('preferences and quiet hours suppress the due occurrence but do not invent missed catch-up messages',()=>{
 const v=timedEvent(input());v.now='2026-10-03T16:00:00.000Z';v.notifications.eventReminders=false;assert.equal(producer.produceMessages(v)[0].suppressed,true);
 v.notifications={...prefs.defaultNotifications,quietHours:true,quietFrom:'17:00',quietTo:'19:00'};assert.equal(producer.produceMessages(v)[0].suppressed,true);
 v.now='2026-11-03T16:00:00.000Z';assert.equal(producer.produceMessages(v).length,0);
});
test('DST gap is skipped, repeated time chooses first instant, non-hour offset and week boundaries remain local',()=>{
 assert.equal(producer.localTimeInstant('2026-03-29','02:30','Europe/Warsaw'),null);
 assert.equal(new Date(producer.localTimeInstant('2026-10-25','02:30','Europe/Warsaw')).toISOString(),'2026-10-25T00:30:00.000Z');
 assert.equal(new Date(producer.localTimeInstant('2026-10-03','18:30','Asia/Kathmandu')).toISOString(),'2026-10-03T12:45:00.000Z');
 const v=timedEvent(input());v.sources.weeks[0].week='2026-WK1';v.now='2026-01-03T16:00:00.000Z';assert.equal(producer.produceMessages(v)[0].target.date,'2026-01-03');
});
test('weekly review appears only in its current availability window and disappears when submitted',()=>{
 const v=input();v.now='2026-10-04T16:00:00.000Z';let result=producer.produceMessages(v);assert.equal(result[0].category,'weekly_review');assert.equal(result[0].target.week,'2026-09-28');
 v.momentum.reviews.push({week:'2026-09-28',draft:false});assert.equal(producer.produceMessages(v).length,0);
 v.momentum.reviews=[];v.now='2026-10-05T00:00:00.000Z';assert.equal(producer.produceMessages(v).length,0);
});
test('journey milestones use actual criteria; initial old awards are suppressed and corrections withdraw them',()=>{
 const v=input(),journey=content.journeyDraft('project',()=>crypto.randomUUID());journey.chapters[0].confirmedAt='2026-10-03T10:00:00.000Z';v.momentum.journeys.push(journey);
 const key=`chapter:${journey.id}:${journey.chapters[0].id}`;v.momentum.awards.push({key,at:'2026-10-03T10:00:00.000Z'});assert.equal(producer.produceMessages(v)[0].key,`milestone:${key}`);
 v.first=true;v.momentum.awards[0].at='2026-09-01T10:00:00.000Z';assert.equal(producer.produceMessages(v)[0].suppressed,true);
 journey.chapters[0].confirmedAt=null;assert.equal(producer.produceMessages(v).length,0);
});
test('Momentum achievements require confirmed actual sources and retain period identity through corrections',()=>{
 const v=input(),id=crypto.randomUUID(),goal={id,name:'Three workouts',lifecycle:'active',hidden:false,pinned:false,order:0,createdAt:v.now,updatedAt:v.now,reminder:{enabled:false,days:[6],time:'09:00',leadDays:null},versions:[{revision:1,effectiveFrom:'2026-10-01',rule:{metric:'sessions',target:3,currency:null,period:'weekly',start:'2026-10-01',end:null,timezone:'Europe/Warsaw',scopeId:null,sources:[],journeyId:null,throughout:false,freshnessDays:7}}]};
 v.momentum.tracker={...loadModule('lib/momentum/goals/types.ts').emptyTracker(),goals:[goal]};
 for(let i=0;i<3;i++)v.sources.gym.plans.push({id:`p${i}`,date:'2026-10-03',timezone:'Europe/Warsaw',revision:0,data:blueprint()});assert.equal(producer.produceMessages(v).length,0);
 for(let i=0;i<3;i++)v.sources.gym.sessions.push({id:`s${i}`,planId:`p${i}`,revision:0,data:{...gymLogic.newSession(blueprint(),'2026-10-03','Europe/Warsaw',false,true),status:'completed',completionMode:'confirmation',finishedAt:'2026-10-03T15:00:00.000Z'}});
 const achievement=producer.produceMessages(v).find(m=>m.category==='goal_milestone');assert.ok(achievement);assert.equal(achievement.target.id,id);
 v.sources.gym.sessions.pop();assert.equal(producer.produceMessages(v).some(m=>m.category==='goal_milestone'),false);
});
test('announcement and state contracts reject forged scope, unsafe text, targets and retry-sensitive toggles',()=>{
 const a={id:crypto.randomUUID(),product:'b1-way-personal',actor:'operator',recipients:['test-only'],title:'Release note',body:'Plain text',availableAt:'2026-10-03T10:00:00.000Z',expiresAt:null,target:null};assert.equal(contract.announcementSchema.parse(a).recipients.length,1);
 for(const patch of [{product:'language'},{body:'<script>alert(1)</script>'},{target:{kind:'url',url:'https://evil.invalid'}},{expiresAt:'2026-10-02T10:00:00.000Z'}])assert.throws(()=>contract.announcementSchema.parse({...a,...patch}));
 assert.throws(()=>contract.stateSchema.parse({id:'n',revision:1}));assert.throws(()=>contract.stateSchema.parse({id:'n',revision:1,read:true,archived:true}));assert.throws(()=>contract.stateSchema.parse({id:'n',revision:1,read:true,userId:'bob'}));
 assert.match(contract.targetHref({kind:'event',id:'id/with?',date:'2026-10-03',week:'2026-WK40'},'n'),/id%2Fwith%3F/);
});
test('private actions derive ownership from the session and reject cross-origin mutations without invoking storage',async()=>{
 let origin='https://evil.invalid',owner='alice',calls=[];
 const actions=loadModule('lib/actions/notifications.actions.ts',{'next/headers':{headers:async()=>new Headers({origin})},'../session':{requireUserId:async()=>{if(!owner)throw Error('Unauthorized');return owner;}},'../account/email/policy':{takeQuota:async()=>true},'../notifications/store':{listInbox:async(o,i)=>{calls.push([o,i]);return {messages:[]};},setInboxState:async(o,i)=>{calls.push([o,i]);return {saved:true};},reconcileInbox:async o=>{calls.push(o);}}});
 assert.equal((await actions.changeNotificationState({id:'n',revision:1,read:true})).success,false);assert.equal(calls.length,0);
 origin='http://localhost:3000';assert.equal((await actions.changeNotificationState({id:'n',revision:1,read:true})).success,true);assert.equal(calls[0][0],'alice');
 owner=null;assert.equal((await actions.getNotifications()).success,false);assert.equal(calls.length,1);
});
