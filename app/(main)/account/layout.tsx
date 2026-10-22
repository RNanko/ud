import { Suspense } from "react";
import AccountPreferencesProvider from "@/app/components/shared/account/AccountPreferencesProvider";
import AccountNotice from "@/app/components/shared/account/AccountNotice";
import DetachedSaveRecovery from "@/app/components/shared/DetachedSaveRecovery";
import Loader from "@/app/components/shared/loader";
import { accountSettings } from "@/lib/account/store";
import { requireUserId } from "@/lib/session";
// This shared layout needs the current session and saved preferences before
// rendering. Validate navigation between its pages, rather than entry to it.
export const instant = false;
export const metadata={title:"B1-Way",description:"Your personal development, connected."};
async function Preferences({children}:{children:React.ReactNode}){
 const owner=await requireUserId(),settings=await accountSettings(owner);
 return <AccountPreferencesProvider initial={settings}><DetachedSaveRecovery owner={owner}/><Suspense fallback={null}><AccountNotice owner={owner}/></Suspense>{children}</AccountPreferencesProvider>;
}
export default function Layout({children}:{children:React.ReactNode}){return <Suspense fallback={<Loader/>}><Preferences>{children}</Preferences></Suspense>;}
