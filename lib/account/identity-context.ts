import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
type IdentityContext={purpose:"signup"|"recovery"|"migration"|"email-change"|"verify-account"|"deletion";email?:string;userId?:string;passwordValidated?:boolean;};
const context=new AsyncLocalStorage<IdentityContext>();
export const identityContext=()=>context.getStore();
export const withIdentity=<T>(value:IdentityContext,run:()=>Promise<T>)=>context.run(value,run);
