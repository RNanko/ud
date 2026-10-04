import { z } from 'zod';
import { cashMinor, cashString } from '../account/decimal';
const revision=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const amount=z.string().trim().max(30).regex(/^\d+(\.\d{1,2})?$/).refine(value=>{try{const n=cashMinor(value);return n>0n&&n<=99999999999900n;}catch{return false;}}).transform(value=>cashString(cashMinor(value)));
export const financeEntryInput=z.object({type:z.enum(['+','-']),date:z.iso.date(),amount,currency:z.string().min(1).max(20).nullable(),category:z.string().trim().min(1).max(200),subcategory:z.string().trim().max(200).default(''),comment:z.string().trim().max(5000).default('')}).strict();
export const financeWriteSchema=z.object({operationId:z.uuid(),revision,data:z.discriminatedUnion('kind',[
 z.object({kind:z.literal('entry'),id:z.string().min(1).max(200),create:z.boolean(),entry:financeEntryInput}).strict(),
 z.object({kind:z.literal('delete'),id:z.string().min(1).max(200)}).strict(),
 z.object({kind:z.literal('category'),name:z.string().trim().min(1).max(200),type:z.enum(['+','-']),hidden:z.boolean()}).strict(),
])}).strict().superRefine((value,ctx)=>{if(value.data.kind==='entry'&&value.data.create){if(!z.uuid().safeParse(value.data.id).success)ctx.addIssue({code:'custom',message:'New record needs a stable UUID.',path:['data','id']});if(!['PLN','EUR','USD'].includes(value.data.entry.currency??''))ctx.addIssue({code:'custom',message:'Choose a supported new-record currency.',path:['data','entry','currency']});}});
export const financeQuerySchema=z.object({currency:z.string().min(1).max(20).optional(),month:z.string().regex(/^(all|\d{4}-(0[1-9]|1[0-2]))$/).default('all'),search:z.string().max(100).default(''),type:z.enum(['all','+','-']).default('all'),category:z.string().max(200).default(''),sort:z.enum(['newest','oldest','highest','lowest','category']).default('newest'),page:z.coerce.number().int().min(1).max(20000).default(1),size:z.coerce.number().int().min(1).max(100).default(20),expected:z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional()}).strict();
