import { z } from 'zod';
const password=z.string().min(1).max(128),proof=z.string().min(16).max(512);
export const accountCommandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('name'),name:z.string().trim().min(1).max(80)}).strict(),
 z.object({type:z.literal('password'),currentPassword:password,newPassword:z.string().min(8).max(128)}).strict(),
 z.object({type:z.literal('revoke-session'),id:z.string().min(1).max(100)}).strict(),
 z.object({type:z.literal('revoke-others')}).strict(),
 z.object({type:z.literal('proof-begin'),purpose:z.enum(['verify-account','email-change']),email:z.string().trim().max(254).email(),currentPassword:password.optional(),proof:proof.optional()}).strict(),
 z.object({type:z.literal('proof-resend'),proof}).strict(),
 z.object({type:z.literal('proof-confirm'),proof,code:z.string().regex(/^\d{6}$/)}).strict(),
 z.object({type:z.literal('delete'),password,confirmation:z.literal('DELETE MY ACCOUNT'),stopRenewals:z.literal(true)}).strict(),
]);
export type AccountCommand=z.infer<typeof accountCommandSchema>;
