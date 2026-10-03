import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { productAccess } from "@/lib/account/access";
import { membershipFor } from "@/lib/account/store";
import { accountAction, validBillingCurrency } from "@/lib/landing/offer";
const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    if (!session) return NextResponse.json({ action: "signup", paidCurrency: null }, { headers });
    const [access, membership] = await Promise.all([productAccess(session.user.id), membershipFor(session.user.id)]);
    const paid = membership?.paid_confirmed && membership.paid_through && Date.parse(membership.paid_through) > Date.now();
    return NextResponse.json({ action: accountAction(access.state, session.user.emailVerified), paidCurrency: paid ? validBillingCurrency(membership.billing_currency) : null }, { headers });
  } catch {
    return NextResponse.json({ action: "signup", paidCurrency: null, unavailable: true }, { status: 503, headers });
  }
}
