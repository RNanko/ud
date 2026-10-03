import "server-only";
import { createHash } from "node:crypto";
import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as common from "@zxcvbn-ts/language-common";
import * as english from "@zxcvbn-ts/language-en";
zxcvbnOptions.setOptions({translations:english.translations,graphs:common.adjacencyGraphs,dictionary:{...common.dictionary,...english.dictionary},maxLength:128});
export async function validateNewPassword(password:unknown,email=""){
 if(typeof password!=="string"||password.length<15||password.length>128) throw new Error("Use a password or passphrase with 15–128 characters");
 if(zxcvbn(password,[email,email.split("@")[0],"B1-Way"]).score<3) throw new Error("Choose a less predictable password or passphrase");
 // k-anonymity: only the SHA-1 prefix leaves this server, never the password or full hash.
 const hash=createHash("sha1").update(password).digest("hex").toUpperCase();
 let response:Response;
 try{response=await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0,5)}`,{headers:{"Add-Padding":"true"},signal:AbortSignal.timeout(8000)});}catch{throw new Error("Password safety check is temporarily unavailable. Retry before saving.");}
 if(!response.ok) throw new Error("Password safety check is temporarily unavailable. Retry before saving.");
 if((await response.text()).split(/\r?\n/).some(row=>row.split(":")[0]===hash.slice(5)&&Number(row.split(":")[1])>0)) throw new Error("This password appears in known breaches. Choose a different passphrase.");
}
