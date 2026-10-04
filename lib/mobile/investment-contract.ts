import { z } from 'zod';
import { investmentFields } from '../investments';
const id=z.string().min(1).max(200),revision=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const investmentWriteSchema=z.object({operationId:z.uuid(),revision,data:z.discriminatedUnion('kind',[
 z.object({kind:z.literal('position'),id,create:z.boolean(),position:investmentFields.strict()}).strict(),
 z.object({kind:z.literal('archive'),id,archived:z.boolean()}).strict(),
])}).strict().superRefine((value,ctx)=>{if(value.data.kind==='position'&&value.data.create&&!z.uuid().safeParse(value.data.id).success)ctx.addIssue({code:'custom',message:'New positions require a stable UUID.',path:['data','id']});});
export const investmentMarketQuery=z.object({ids:z.string().max(4000).transform(text=>text?text.split(','):[]).pipe(z.array(id).max(20)).refine(ids=>new Set(ids).size===ids.length,'Duplicate positions')}).strict();
