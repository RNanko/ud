import { Suspense } from "react";
import FocusIndicator from "@/app/components/shared/account/FocusIndicator";
import AccountPreferencesProvider from "@/app/components/shared/account/AccountPreferencesProvider";
import AccountNotice from "@/app/components/shared/account/AccountNotice";
import Loader from "@/app/components/shared/loader";
import { accountSettings } from "@/lib/account/store";
import { requireUserId } from "@/lib/session";
export const metadata={title:"B1-Way",description:"Your personal development, connected."};
async function Preferences({children}:{children:React.ReactNode}){
 const owner=await requireUserId(),settings=await accountSettings(owner);
 return <AccountPreferencesProvider initial={settings}><Suspense fallback={null}><AccountNotice owner={owner}/></Suspense>{children}<FocusIndicator/></AccountPreferencesProvider>;
}
export default function Layout({children}:{children:React.ReactNode}){return <Suspense fallback={<Loader/>}><Preferences>{children}</Preferences></Suspense>;}
