"use server";
import {headers} from "next/headers";
import {requireUserId} from "../session";
import {appOrigin,PERSONAL_PRODUCT} from "../account/config";
import {takeQuota} from "../account/email/policy";
import {listInbox,setInboxState,markAvailableRead,inboxDetail,reconcileInbox} from "../notifications/store";

async function ownerForWrite(){const owner=await requireUserId(),h=await headers(),origin=h.get("origin");if(origin&&origin!==appOrigin())throw new Error("Unauthorized origin");
 if(!await takeQuota(`inbox:${PERSONAL_PRODUCT}:${owner}`,200,60))throw new Error("Please wait a moment before retrying");return owner;}
async function result<T>(operation:()=>Promise<T>){try{return {success:true as const,data:await operation()};}catch(error){const message=error instanceof Error&&/^(Choose|This message|Please wait|Unauthorized)/.test(error.message)?error.message:"Notifications could not be saved or refreshed. Retry.";return {success:false as const,message};}}
export async function getNotifications(input:unknown={}){return result(async()=>listInbox(await requireUserId(),input));}
export async function reconcileNotifications(){return result(async()=>{await reconcileInbox(await ownerForWrite());return {reconciled:true};});}
export async function changeNotificationState(input:unknown){return result(async()=>setInboxState(await ownerForWrite(),input));}
export async function readAllNotifications(){return result(async()=>markAvailableRead(await ownerForWrite()));}
export async function getNotificationDetail(id:string){return result(async()=>inboxDetail(await requireUserId(),id));}
