import { PublicError } from "./account/errors";
import { headers } from "next/headers";
import { auth } from "./auth";
import { cache } from "react";

// React shares this lookup only within one server render, never across requests.
export const getRequestSession = cache(async () => {
  // Establish request context before the auth library reads its clock.
  const requestHeaders = await headers();
  return auth.api.getSession({ headers: requestHeaders, query: { disableCookieCache: true } });
});

// Check before entering cached readers; never cache an authorization decision.
export async function requireUserId(requestedUserId?: string, intent: "read"|"write"="read",completion?:{kind:"workout"|"focus";id:string}) {
  const session = await getRequestSession();
  const userId = session?.session.userId;
  if (!userId || (requestedUserId !== undefined && requestedUserId !== userId)) {
    throw new PublicError("Unauthorized");
  }
  if(intent==="write"){const {assertProductWrite}=await import("./account/access");await assertProductWrite(userId,completion);}
  return userId;
}
