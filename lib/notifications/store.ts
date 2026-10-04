import "server-only";
import {accountSql,accountSettings} from "../account/store";
import {PERSONAL_PRODUCT} from "../account/config";
import {defaultNotifications,defaultPreferences,notificationSchema,preferenceSchema} from "../account/preferences";
import {emptyMomentum,type MomentumData,type Sources} from "../momentum/types";
import {emptyTodoBoard} from "../todo";
import {produceMessages} from "./produce";
import {announcementSchema,targetSchema,listSchema,stateSchema,type InboxMessage,type InboxPage,type Candidate} from "./types";
import z from "zod";

const stamp=(value:unknown)=>new Date(String(value)).toISOString();
const message=(row:Record<string,unknown>):InboxMessage=>({id:String(row.id),schemaVersion:1,category:row.category as InboxMessage["category"],title:String(row.title),body:String(row.body),target:targetSchema.parse(row.target),createdAt:stamp(row.created_at),occurredAt:stamp(row.occurred_at),availableAt:stamp(row.published_at),expiresAt:row.expires_at?stamp(row.expires_at):null,readAt:row.read_at?stamp(row.read_at):null,archivedAt:row.archived_at?stamp(row.archived_at):null,revision:Number(row.revision)});
function cursorValue(value:string|null){if(!value)return null;try{return z.tuple([z.iso.datetime(),z.string().min(1).max(150)]).parse(JSON.parse(Buffer.from(value,"base64url").toString("utf8")));}catch{throw new Error("Choose a valid notification page");}}

export async function listInbox(owner:string,input:unknown={}):Promise<InboxPage>{
 const data=listSchema.parse(input),cursor=cursorValue(data.cursor);
 const rows=await accountSql`WITH eligible AS (
  SELECT * FROM b1_notifications WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}
  AND published_at IS NOT NULL AND available_at<=statement_timestamp() AND (expires_at IS NULL OR expires_at>statement_timestamp())
  AND invalidated_at IS NULL AND archived_at IS NULL AND NOT suppressed
 ), page AS (
  SELECT * FROM eligible WHERE (${data.filter}='all' OR read_at IS NULL)
  AND (${cursor===null} OR (published_at,id)<(${cursor?.[0]??"9999-01-01T00:00:00Z"}::timestamptz,${cursor?.[1]??""}))
  ORDER BY published_at DESC,id DESC LIMIT 21
 ) SELECT COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY published_at DESC,id DESC) FROM page),'[]'::jsonb) AS messages,
 (SELECT count(*) FROM eligible WHERE read_at IS NULL) AS unread_count,statement_timestamp() AS as_of`;
 const entries=(rows[0].messages as Record<string,unknown>[]).map(message),more=entries.length>20,last=entries[19];
 const settings=await accountSettings(owner);
 return {messages:entries.slice(0,20),unreadCount:Number(rows[0].unread_count),asOf:stamp(rows[0].as_of),nextCursor:more?Buffer.from(JSON.stringify([last.availableAt,last.id])).toString("base64url"):null,timezone:settings.preferences.timezone,locale:settings.preferences.numberLocale};
}
export async function setInboxState(owner:string,input:unknown){
 const data=stateSchema.parse(input);
 const rows=data.read!==undefined?await accountSql`UPDATE b1_notifications SET read_at=CASE WHEN ${data.read} THEN now() END,revision=revision+1
 WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND id=${data.id} AND revision=${data.revision}
 AND published_at IS NOT NULL AND available_at<=now() AND (expires_at IS NULL OR expires_at>now()) AND invalidated_at IS NULL AND NOT suppressed RETURNING id`:
 await accountSql`UPDATE b1_notifications SET archived_at=CASE WHEN ${data.archived!} THEN now() END,revision=revision+1
 WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND id=${data.id} AND revision=${data.revision}
 AND published_at IS NOT NULL AND available_at<=now() AND (expires_at IS NULL OR expires_at>now()) AND invalidated_at IS NULL AND NOT suppressed RETURNING id`;
 if(!rows[0]){
  const current=await accountSql`SELECT read_at,archived_at FROM b1_notifications WHERE id=${data.id} AND user_id=${owner} AND product=${PERSONAL_PRODUCT} AND published_at IS NOT NULL AND available_at<=now() AND invalidated_at IS NULL AND NOT suppressed AND (expires_at IS NULL OR expires_at>now())`;
  const already=current[0]&&(data.read!==undefined?Boolean(current[0].read_at)===data.read:Boolean(current[0].archived_at)===data.archived);
  if(!already)throw new Error("This message changed or is no longer available. Refresh before retrying.");
 }
 return {saved:true as const};
}
export async function markAvailableRead(owner:string){
 // A single statement captures the MVCC + availability snapshot. A future row
 // created yesterday still stays unread when it becomes available tomorrow.
 const rows=await accountSql`UPDATE b1_notifications SET read_at=statement_timestamp(),revision=revision+1
 WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND published_at IS NOT NULL
 AND available_at<=statement_timestamp() AND (expires_at IS NULL OR expires_at>statement_timestamp())
 AND invalidated_at IS NULL AND archived_at IS NULL AND NOT suppressed AND read_at IS NULL RETURNING id`;
 return {saved:true as const,count:rows.length};
}
export async function inboxDetail(owner:string,id:string){
 z.string().min(1).max(150).parse(id);
 const rows=await accountSql`SELECT n.*,a.body AS full_body FROM b1_notifications n LEFT JOIN b1_app_messages a ON n.category='product_update' AND a.id=n.target->>'id' AND a.product=n.product
 WHERE n.user_id=${owner} AND n.product=${PERSONAL_PRODUCT} AND n.id=${id} AND n.published_at IS NOT NULL AND n.available_at<=now()
 AND (n.expires_at IS NULL OR n.expires_at>now()) AND n.invalidated_at IS NULL AND NOT n.suppressed`;
 if(!rows[0])throw new Error("This message is no longer available");
 return {...message(rows[0]),body:String(rows[0].full_body??rows[0].body)};
}

const leases=new Map<string,Promise<void>>();
export async function reconcileInbox(owner:string){
 const existing=leases.get(owner);if(existing)return existing;
 const work=reconcile(owner);leases.set(owner,work);
 try{await work;}finally{if(leases.get(owner)===work)leases.delete(owner);}
}
async function reconcile(owner:string){
 const token=crypto.randomUUID();
 await accountSql`INSERT INTO b1_inbox_state(user_id,product) SELECT id,${PERSONAL_PRODUCT} FROM "user" WHERE id=${owner}
 AND NOT EXISTS(SELECT 1 FROM b1_deletions WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}) ON CONFLICT DO NOTHING`;
 const claim=await accountSql`UPDATE b1_inbox_state SET lease_id=${token},lease_until=now()+interval '30 seconds',checked_at=now()
 WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND (lease_until IS NULL OR lease_until<now())
 AND (checked_at IS NULL OR checked_at<now()-interval '3 seconds' OR reconciled_revision<>source_revision)
 AND NOT EXISTS(SELECT 1 FROM b1_deletions WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}) RETURNING source_revision`;
 if(!claim[0]){
  const running=await accountSql`SELECT 1 FROM b1_inbox_state WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND lease_until>now()`;
  if(running[0])throw new Error("Notifications are being refreshed. Retry in a moment.");
  return;
 }
 try{
  // One database snapshot; a subsequent source mutation bumps the generation.
  const rows=await accountSql`SELECT s.*,statement_timestamp() AS clock,
   (SELECT to_jsonb(a) FROM b1_account_settings a WHERE a.user_id=s.user_id AND a.product=s.product) AS settings,
   (SELECT data FROM kanban_board WHERE user_id=s.user_id) AS todo,
   (SELECT data FROM momentum_state WHERE user_id=s.user_id) AS momentum,
   COALESCE((SELECT jsonb_agg(jsonb_build_object('week',week,'data',data)) FROM user_events WHERE user_id=s.user_id AND week ~ '^[0-9]{4}-WK[0-9]{1,2}$'),'[]') AS weeks,
   COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'data',data,'date',date,'timezone',timezone,'revision',revision)) FROM gym_plans WHERE user_id=s.user_id AND NOT archived),'[]') AS plans,
   COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'data',data,'planId',plan_id,'revision',revision)) FROM gym_sessions WHERE user_id=s.user_id AND NOT archived),'[]') AS sessions,
   COALESCE((SELECT jsonb_agg(date) FROM gym_rest_days WHERE user_id=s.user_id AND rest),'[]') AS rests,
   COALESCE((SELECT jsonb_agg(dedup_key) FROM b1_notifications WHERE user_id=s.user_id AND product=s.product AND category<>'product_update'),'[]') AS known
   FROM b1_inbox_state s WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}`;
  const row=rows[0];if(!row)return;
  const sources:Sources={todo:row.todo??emptyTodoBoard(),weeks:row.weeks,gym:{templates:[],customExercises:[],plans:row.plans,sessions:row.sessions,restDays:row.rests}};
  const candidates=produceMessages({sources,momentum:row.momentum as MomentumData??emptyMomentum(),preferences:preferenceSchema.parse(row.settings?.preferences??defaultPreferences),notifications:notificationSchema.parse(row.settings?.notifications??defaultNotifications),initializedAt:stamp(row.initialized_at),first:!row.reconciled_at,known:new Set(row.known),now:stamp(row.clock)})
   .map((item):Candidate=>({...item,title:item.title.slice(0,160),body:item.body.slice(0,600),target:targetSchema.parse(item.target)}));
  if(candidates.length>5000)throw new Error("Notification source history needs operator review");
  const applied=await accountSql`SELECT b1_apply_inbox_snapshot(${owner},${PERSONAL_PRODUCT},${Number(row.source_revision)},${token},${JSON.stringify(candidates)}::jsonb) AS applied`;
  if(!applied[0]?.applied)throw new Error("Notification sources changed; retry reconciliation");
 }finally{await accountSql`UPDATE b1_inbox_state SET lease_id=NULL,lease_until=NULL WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT} AND lease_id=${token}`;}
}
// Post-commit hooks are best-effort. The database's durable generation remains
// available to retry after failure; a saved workout must not become a failed save.
export async function afterNotificationSourceChange(owner:string){try{await reconcileInbox(owner);}catch{/* No private payloads in logs. App/worker retries the durable source hook. */}}
export async function reconcileInboxQueue(){const rows=await accountSql`SELECT s.user_id FROM b1_inbox_state s JOIN "user" u ON u.id=s.user_id WHERE product=${PERSONAL_PRODUCT}
 AND NOT EXISTS(SELECT 1 FROM b1_deletions d WHERE d.user_id=s.user_id AND d.product=s.product)
 AND (checked_at IS NULL OR checked_at<now()-interval '1 minute') AND (lease_until IS NULL OR lease_until<now()) ORDER BY checked_at NULLS FIRST LIMIT 20`;
 for(const row of rows)await afterNotificationSourceChange(row.user_id);return rows.length;}

// Server-only operator service. No client action or HTTP publishing endpoint.
export async function publishAppMessage(input:unknown){
 const data=announcementSchema.parse(input),allowed=(process.env.NOTIFICATION_OPERATOR_IDS??"").split(",").map(x=>x.trim()).filter(Boolean);
 if(!allowed.includes(data.actor))throw new Error("Authorized notification operator required");
 const actor=await accountSql`SELECT id FROM "user" WHERE id=${data.actor}`;if(!actor[0])throw new Error("Operator account unavailable");
 const recipients=[...new Set(data.recipients)],target=data.target??{kind:"announcement" as const,id:data.id};
 // Immutable published identity: retries return the same recipients/messages.
 await accountSql.transaction([
  accountSql`INSERT INTO b1_app_messages(id,product,actor_id,title,body,status,available_at,expires_at,target) VALUES(${data.id},${data.product},${data.actor},${data.title},${data.body},'published',${data.availableAt},${data.expiresAt},${JSON.stringify(target)}::jsonb) ON CONFLICT DO NOTHING`,
  accountSql`INSERT INTO b1_notifications(id,user_id,product,category,dedup_key,source_key,title,body,target,occurred_at,available_at,published_at,expires_at,suppressed)
   SELECT md5(u.id||a.product||'app:'||a.id),u.id,a.product,'product_update','app:'||a.id,'app:'||a.id,a.title,left(a.body,600),a.target,a.available_at,a.available_at,a.available_at,a.expires_at,
    NOT COALESCE((s.notifications->>'productUpdates')::boolean,true)
   FROM "user" u JOIN b1_app_messages a ON a.id=${data.id} AND a.product=${PERSONAL_PRODUCT} AND a.actor_id=${data.actor}
   LEFT JOIN b1_account_settings s ON s.user_id=u.id AND s.product=a.product
   WHERE u.id=ANY(${recipients}) AND NOT EXISTS(SELECT 1 FROM b1_deletions d WHERE d.user_id=u.id AND d.product=a.product)
   AND (EXISTS(SELECT 1 FROM b1_account_settings WHERE user_id=u.id AND product=a.product) OR EXISTS(SELECT 1 FROM b1_memberships WHERE user_id=u.id AND product=a.product))
   ON CONFLICT(user_id,product,dedup_key) DO NOTHING`
 ]);
 const rows=await accountSql`SELECT count(*) AS count FROM b1_notifications WHERE product=${PERSONAL_PRODUCT} AND dedup_key=${`app:${data.id}`} AND user_id=ANY(${recipients})`;
 return {recipients:Number(rows[0].count),id:data.id};
}
