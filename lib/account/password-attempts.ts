import "server-only";
import { takeQuota } from "./email/policy";
import { protectedKey } from "./email/crypto";
import { PublicError } from "./errors";

// One account budget across all direct API callers: changing the action cannot
// multiply guesses. Successful attempts also count; the fixed window expires.
export async function takePasswordAttempt(owner:string){
 if(!await takeQuota(`sensitive-password:${protectedKey(owner)}`,5,900))
  throw new PublicError("Too many password attempts. Wait 15 minutes before trying again.");
}
