import { z } from 'zod';
import { recordId, calendarDay, timezoneSchema, blueprintSchema, definitionSchema, sessionSchema } from '../gym/validation';
const editable = { id: recordId, revision: z.number().int().nonnegative().nullable() };
export const gymCommandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('template'), ...editable, data: blueprintSchema }).strict(),
  z.object({ kind: z.literal('exercise'), ...editable, data: definitionSchema }).strict(),
  z.object({ kind: z.literal('plan'), ...editable, date: calendarDay, timezone: timezoneSchema, data: blueprintSchema }).strict(),
  z.object({ kind: z.literal('start'), id: recordId, planId: recordId.nullable(), data: blueprintSchema.nullable(), date: calendarDay, timezone: timezoneSchema, logged: z.boolean() }).strict(),
  z.object({ kind: z.literal('session'), ...editable, data: sessionSchema }).strict(),
  z.object({ kind: z.literal('reopen'), id: recordId, revision: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal('archive'), id: recordId, revision: z.number().int().nonnegative(), resource: z.enum(['plan', 'session', 'entity']) }).strict(),
  z.object({ kind: z.literal('rest'), date: calendarDay, timezone: timezoneSchema, rest: z.boolean(), previous: z.boolean() }).strict(),
]);
export const gymWriteSchema = z.object({ operationId: z.uuid(), data: gymCommandSchema }).strict();
