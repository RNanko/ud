import { z } from 'zod';
import { stateSchema } from '../notifications/types';
export const inboxPreferencesSchema=z.object({eventReminders:z.boolean(),goalReminders:z.boolean(),weeklyReview:z.boolean(),workoutCompletion:z.boolean(),productUpdates:z.boolean(),quietHours:z.boolean(),quietFrom:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),quietTo:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)}).strict();
export const inboxQuerySchema=z.object({cursor:z.string().min(1).max(1000).optional()}).strict();
export const inboxDetailQuery=z.object({id:z.string().min(1).max(150)}).strict();
export const inboxCommandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('reconcile')}).strict(),
 z.object({type:z.literal('state'),change:stateSchema}).strict(),
 z.object({type:z.literal('read-all')}).strict(),
 z.object({type:z.literal('settings'),revision:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),data:inboxPreferencesSchema}).strict(),
]);
