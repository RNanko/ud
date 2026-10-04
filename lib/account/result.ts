import { ZodError } from "zod";
import { PublicError, publicErrorMessage } from "./errors";
export type ActionResult<T>={ok:true;value:T}|{ok:false;error:string;code?: "LEGAL_VERSIONS_CHANGED" | "REGISTRATION_UNAVAILABLE"};
export async function actionResult<T>(run:()=>Promise<T>):Promise<ActionResult<T>>{
 try{return {ok:true,value:await run()};}
 catch(error){
  // Do not log or return raw error objects: provider errors can contain credentials or PII.
  if(!(error instanceof PublicError)&&!(error instanceof ZodError))console.error("Account action failed unexpectedly; retry or contact support.");
  return {ok:false,error:publicErrorMessage(error),...(error instanceof PublicError && error.code ? {code:error.code} : {})};
 }
}
