import z from "zod";
import { PERSONAL_PRODUCT } from "../account/config";

const id = z.string().min(1).max(150);
export const targetSchema = z.discriminatedUnion("kind", [
  z.object({kind:z.literal("event"),id,week:z.string().regex(/^\d{4}-WK\d{1,2}$/),date:z.iso.date()}).strict(),
  z.object({kind:z.literal("workout"),id,date:z.iso.date(),record:z.enum(["plan","session"])}).strict(),
  z.object({kind:z.literal("goal"),id}).strict(),
  z.object({kind:z.literal("journey"),id}).strict(),
  z.object({kind:z.literal("review"),week:z.iso.date()}).strict(),
  z.object({kind:z.literal("account"),section:z.enum(["account","notifications","security","membership","privacy"])}).strict(),
  z.object({kind:z.literal("announcement"),id}).strict(),
]);
export type NotificationTarget = z.infer<typeof targetSchema>;
export const categories = ["event_reminder","workout_completed","goal_milestone","journey_milestone","goal_reminder","weekly_review","product_update"] as const;
export type Category = typeof categories[number];
export type InboxMessage = {id:string;schemaVersion:1;category:Category;title:string;body:string;target:NotificationTarget;createdAt:string;occurredAt:string;availableAt:string;expiresAt:string|null;readAt:string|null;archivedAt:string|null;revision:number};
export type InboxPage = {messages:InboxMessage[];unreadCount:number;nextCursor:string|null;asOf:string;timezone:string;locale:string};
export type Candidate = {key:string;category:Category;sourceKey:string;title:string;body:string;target:NotificationTarget;occurredAt:string;availableAt:string;expiresAt:string|null;suppressed:boolean};
export const listSchema = z.object({filter:z.enum(["all","unread"]).default("all"),cursor:z.string().max(1000).nullable().default(null)}).strict();
export const stateSchema = z.object({id,revision:z.number().int().positive(),read:z.boolean().optional(),archived:z.boolean().optional()}).strict().refine(x=>Number(x.read!==undefined)+Number(x.archived!==undefined)===1,"Choose one state change");
const text = (max:number) => z.string().trim().min(1).max(max).refine(x=>!/<[a-z!\/]/i.test(x),"Use plain text");
export const announcementSchema = z.object({id:z.uuid(),product:z.literal(PERSONAL_PRODUCT),actor:id,recipients:z.array(id).min(1).max(100),title:text(120),body:text(4000),availableAt:z.iso.datetime(),expiresAt:z.iso.datetime().nullable(),target:targetSchema.nullable()}).strict().refine(x=>!x.expiresAt||x.expiresAt>x.availableAt,"Expiry must follow publication");

// Web and future native clients map the same structured target independently.
export function targetHref(target:NotificationTarget, messageId:string):string {
  const e=encodeURIComponent;
  switch(target.kind){
    case "event":return `/account/events?date=${target.date}&event=${e(target.id)}&week=${e(target.week)}`;
    case "workout":return `/account/gym?${target.record}=${e(target.id)}&date=${target.date}`;
    case "goal":return `/account/momentum?goal=${e(target.id)}#goal-${e(target.id)}`;
    case "journey":return `/account/momentum?view=journeys&journey=${e(target.id)}#journey-${e(target.id)}`;
    case "review":return `/account/momentum?view=review&week=${target.week}`;
    case "account":return `/account?section=${target.section}`;
    case "announcement":return `/account/notifications?message=${e(messageId)}`;
  }
}
