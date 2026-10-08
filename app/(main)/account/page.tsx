import { Suspense } from "react";
import Loader from "@/app/components/shared/loader";
import GetAccountData from "@/lib/actions/account.actions";
import { requireUserId } from "@/lib/session";
import { membershipStatus } from "@/lib/actions/billing.actions";
import { launchPolicy } from "@/lib/account/config";
import { checkoutConfigurationReady } from "@/lib/account/billing/stripe";
import AccountSettingsClient from "./AccountSettingsClient";
import packageInfo from "@/package.json";
import { publishedBundle } from "@/lib/legal/store";
// The private workspace waits for a verified session before rendering this page.
export const instant = false;
async function Account() {
  const owner = await requireUserId();
  const [user, status, legalBundle] = await Promise.all([
    GetAccountData(owner),
    membershipStatus(),
    publishedBundle(),
  ]);
  if (!user)
    throw new Error("Account settings could not load. Please retry.");
  return (
    <AccountSettingsClient
      user={{ ...user, createdAt: user.createdAt.toISOString() }}
      initialMembership={status.ok ? status.value : null}
      trialDays={launchPolicy().trialDays}
      stripeAvailable={!!process.env.STRIPE_SECRET_KEY}
      checkoutAvailable={checkoutConfigurationReady() && !!legalBundle?.purchaseReady}
      legalBundle={legalBundle}
      version={packageInfo.version}
      terms={process.env.POLICY_TERMS_URL || "/terms"}
      privacy={process.env.POLICY_PRIVACY_URL || "/privacy"}
      retention={process.env.POLICY_RETENTION_NOTICE ?? null}
    />
  );
}
export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Account />
    </Suspense>
  );
}
