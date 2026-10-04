import { z } from 'zod';
import { commandSchema } from '../momentum/validation';
export const momentumQuerySchema=z.object({week:z.iso.date().optional()}).strict();
export const momentumWriteSchema=z.object({operationId:z.uuid(),revision:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),intent:z.enum(['create','edit']).optional(),command:commandSchema.refine(c=>c.type!=='delete-all','Account-wide deletion is outside this checkpoint')}).strict();
// Upserts require an explicit intent: a removed record cannot become a create.
export function momentumIdentity(command:z.infer<typeof commandSchema>){
 switch(command.type){
 case 'journey':return {collection:'journeys',id:command.value.id};
 case 'savings':return {collection:'savings',id:command.value.id};
 case 'entry':return {collection:'entries',id:command.value.id};
 case 'review':return {collection:'reviews',id:command.id};
 case 'focus-start':return {collection:'focus',id:command.id};
 case 'goal-save':return {collection:'goals',id:command.id};
 case 'goal-scope':return {collection:'scopes',id:command.id};
 case 'goal-record':return {collection:'records',id:command.value.id};
 default:return null;
 }
}
