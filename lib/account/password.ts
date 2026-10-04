import { PublicError } from "./errors";
import "server-only";
import { createHash } from "node:crypto";
import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as common from "@zxcvbn-ts/language-common";
import * as english from "@zxcvbn-ts/language-en";
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_LENGTH_HINT } from "./password-policy";
zxcvbnOptions.setOptions({translations:english.translations,graphs:common.adjacencyGraphs,dictionary:{...common.dictionary,...english.dictionary},maxLength:PASSWORD_MAX_LENGTH});
export async function validateNewPassword(password:unknown,email=""){
 if(typeof password!=="string"||password.length<PASSWORD_MIN_LENGTH||password.length>PASSWORD_MAX_LENGTH) throw new PublicError(`Use a password or passphrase with ${PASSWORD_LENGTH_HINT}`);
 // A random eight-character password can score 2; requiring 3 would impose
 // an undisclosed longer minimum. Predictable and breached values stay blocked.
 if(zxcvbn(password,[email,email.split("@")[0],"B1-Way"]).score<2) throw new PublicError("Choose a less predictable password or passphrase");
 // k-anonymity: only the SHA-1 prefix leaves this server, never the password or full hash.
 const hash=createHash("sha1").update(password).digest("hex").toUpperCase();
 let response:Response;
 try{response=await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0,5)}`,{headers:{"Add-Padding":"true"},signal:AbortSignal.timeout(8000)});}catch{throw new PublicError("Password safety check is temporarily unavailable. Retry before saving.");}
 if(!response.ok) throw new PublicError("Password safety check is temporarily unavailable. Retry before saving.");
 if((await response.text()).split(/\r?\n/).some(row=>row.split(":")[0]===hash.slice(5)&&Number(row.split(":")[1])>0)) throw new PublicError("This password appears in known breaches. Choose a different passphrase.");
}
