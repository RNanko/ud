import "server-only";
import { timingSafeEqual } from "node:crypto";
export function authorizedJob(headers:Headers){
 const secret=process.env.CRON_SECRET;if(!secret||secret.length<32)return false;
 const given=headers.get("authorization")??"",expected=`Bearer ${secret}`;
 return Buffer.byteLength(given)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(given),Buffer.from(expected));
}
