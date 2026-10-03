import { Suspense } from "react";
import Loader from "@/app/components/shared/loader";
import GetAccountData from "@/lib/actions/account.actions";
import { requireUserId } from "@/lib/session";
import { membershipStatus } from "@/lib/actions/billing.actions";
import { launchPolicy } from "@/lib/account/config";
import AccountSettingsClient from "./AccountSettingsClient";
import packageInfo from "@/package.json";
async function Account(){
 const owner=await requireUserId();const [user,status]=await Promise.all([GetAccountData(owner),membershipStatus()]);
 if(!user||!status.ok)throw new Error("Account settings could not load. Please retry.");
 return <AccountSettingsClient user={{...user,createdAt:user.createdAt.toISOString()}} initialMembership={status.value} trialDays={launchPolicy().trialDays} stripeAvailable={!!process.env.STRIPE_SECRET_KEY} version={packageInfo.version} terms={process.env.POLICY_TERMS_URL??null} privacy={process.env.POLICY_PRIVACY_URL??null} retention={process.env.POLICY_RETENTION_NOTICE??null}/>;
}
export default function Page(){return <Suspense fallback={<Loader/>}><Account/></Suspense>;}
