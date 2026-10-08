import { Suspense } from "react";
import ResetForm from "./ResetForm";
import Loader from "@/app/components/shared/loader";
// The auth layout waits for a session before showing a guest form.
export const instant = false;
async function Form({searchParams}:{searchParams:Promise<{token?:string}>}){const query=await searchParams;return <ResetForm token={query.token??""}/>;}
export default function Page({searchParams}:{searchParams:Promise<{token?:string}>}){return <div className="px-5 py-8"><Suspense fallback={<Loader/>}><Form searchParams={searchParams}/></Suspense></div>;}
