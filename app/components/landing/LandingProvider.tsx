"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { validBillingCurrency, actionDestinations, type LandingAction } from "@/lib/landing/offer";
import type { BillingCurrency } from "@/lib/account/config";
type LandingState = { currency:BillingCurrency; paid:boolean; action:LandingAction; trialDays:number; availability:Partial<Record<BillingCurrency,boolean>> };
const LandingContext=createContext<LandingState|null>(null);
export function useLanding() { const state=useContext(LandingContext);if(!state)throw Error("Landing context missing");return state; }
export default function LandingProvider({trialDays,children}:{trialDays:number;children:ReactNode}) {
 const [currency,setCurrency]=useState<BillingCurrency>("EUR"),[paid,setPaid]=useState(false),[action,setAction]=useState<LandingAction>("signup"),[availability,setAvailability]=useState<Partial<Record<BillingCurrency,boolean>>>({});
 const paidRef=useRef(false);
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/public/offer",{cache:"no-store",signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(!controller.signal.aborted){if(!paidRef.current)setCurrency(validBillingCurrency(data.currency)??"EUR");setAvailability(data.availability??{});}}).catch(()=>{});
  fetch("/api/public/account",{cache:"no-store",signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
   if(controller.signal.aborted)return;
   if(data.action in actionDestinations)setAction(data.action);
   const recorded=validBillingCurrency(data.paidCurrency);if(recorded){paidRef.current=true;setPaid(true);setCurrency(recorded);}
  }).catch(()=>{});
  return()=>controller.abort();
 },[]);
 return <LandingContext value={{currency,paid,action,trialDays,availability}}>{children}</LandingContext>;
}
export function MainAction({compact=false}:{compact?:boolean}) {
 const {action,trialDays}=useLanding();
 const label=action==="open"?"Open app":action==="membership"?"View membership":action==="verify"?"Continue verification":action==="trial"?`Start ${trialDays}-day trial`:`Start your ${trialDays}-day trial`;
 return <Button asChild className={`mf-primary ${compact?"":"mf-main-action"}`}><Link prefetch={false} href={actionDestinations[action]}>{label}<ArrowUpRight size={18}/></Link></Button>;
}
