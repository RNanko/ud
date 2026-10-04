import { PublicError } from "./account/errors";
import { headers } from "next/headers";
import { auth } from "./auth";

// Check before entering cached readers; never cache an authorization decision.
export async function requireUserId(requestedUserId?: string, intent: "read"|"write"="read",completion?:{kind:"workout"|"focus";id:string}) {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  const userId = session?.session.userId;
  if (!userId || (requestedUserId !== undefined && requestedUserId !== userId)) {
    throw new PublicError("Unauthorized");
  }
  if(intent==="write"){const {assertProductWrite}=await import("./account/access");await assertProductWrite(userId,completion);}
  return userId;
}
