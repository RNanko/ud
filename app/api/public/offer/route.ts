import { NextRequest, NextResponse } from "next/server";
import { resolveBillingCurrency } from "@/lib/landing/offer";
import { billingCurrencies } from "@/lib/account/config";
import { checkoutConfigurationReady, configuredPrice } from "@/lib/account/billing/stripe";
import { publishedBundle } from "@/lib/legal/store";
const uncached = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  const currency = resolveBillingCurrency({ country: request.headers.get("x-vercel-ip-country"), trusted: process.env.VERCEL === "1" });
  const ready = checkoutConfigurationReady() && !!(await publishedBundle())?.purchaseReady;
  const availability = Object.fromEntries(billingCurrencies.map(code => { try { configuredPrice(code); return [code, ready]; } catch { return [code, false]; } }));
  return NextResponse.json({ currency, availability }, { headers: uncached });
}
