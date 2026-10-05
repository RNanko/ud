"use client";
import { useAccountPreferences } from "./AccountPreferencesProvider";
import { useState, useEffect, useRef } from "react";
import { GymButton } from "@/app/(main)/account/gym/GymUI";
import { membershipStatus, startMembershipTrial, createMembershipCheckout, openMembershipPortal, expireMembershipCheckout, refreshMembership } from "@/lib/actions/billing.actions";
import { annualPrices, type BillingCurrency } from "@/lib/account/config";
import { validBillingCurrency } from "@/lib/landing/offer";
import LegalAgreementControl from "@/app/components/legal/LegalAgreementControl";
import { agreementFor, type LegalBundle } from "@/lib/legal/types";
import { customerMessages } from "@/lib/account/customer-messages";
import MembershipAccessSummary from "./MembershipAccessSummary";
type Status = Extract<Awaited<ReturnType<typeof membershipStatus>>, {ok:true}>["value"];
export default function MembershipSettings({ initial, trialDays, stripeAvailable, checkoutAvailable, legalBundle, onStatusChange }: {initial:Status|null; trialDays:number; stripeAvailable:boolean; checkoutAvailable:boolean; legalBundle:LegalBundle|null; onStatusChange?:(status:Status)=>void}) {
 const {settings} = useAccountPreferences();
 const [status,setStatus] = useState(initial), [currency,setCurrency] = useState<BillingCurrency>(validBillingCurrency(initial?.billingCurrency) ?? "EUR");
 const [accept,setAccept] = useState(false), [acceptedLegal,setAcceptedLegal] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState(""), [message,setMessage] = useState("");
 const [offerReady,setOfferReady] = useState(false), [regionalFallback,setRegionalFallback] = useState(false);
 const [priceAvailability,setPriceAvailability] = useState<Partial<Record<BillingCurrency,boolean>>>({});
 const submitting = useRef(false);
 const paidActive = !!status?.paidThrough && Date.parse(status.paidThrough)>Date.now();
 const hasStatus = status !== null, billingCurrency = status?.billingCurrency;
 useEffect(() => {
  if (!hasStatus) return;
  const controller = new AbortController(), recorded = validBillingCurrency(billingCurrency);
  setOfferReady(false); setAccept(false); setAcceptedLegal(false); setRegionalFallback(false);
  if (paidActive && recorded) setCurrency(recorded);
  fetch("/api/public/offer",{cache:"no-store",signal:controller.signal}).then(r=>{if(!r.ok)throw Error(); return r.json();}).then(data=>{
   if(controller.signal.aborted)return;
   setPriceAvailability(data.availability??{});
   if(!paidActive)setCurrency(validBillingCurrency(data.currency)??"EUR");
   setOfferReady(true);
  }).catch(()=>{
   if(controller.signal.aborted)return;
   if(!paidActive){setCurrency("EUR");setRegionalFallback(true);}
   setOfferReady(true);
  });
  return ()=>controller.abort();
 },[paidActive,billingCurrency,hasStatus]);
 useEffect(()=>{
  if(!stripeAvailable||new URLSearchParams(window.location.search).get("billing")!=="confirming")return;
  let disposed=false,attempts=0;
  setMessage("Confirming your payment…");
  const poll=async()=>{
   try {
    const result=await refreshMembership();
    if(disposed)return;
    if(result.ok){
     const current=await membershipStatus();
     if(!disposed&&current.ok){setStatus(current.value);onStatusChange?.(current.value);if(current.value.access.state.startsWith("paid")||current.value.activeProviders?.length){setMessage("Payment confirmed. Annual access is active.");return;}}
    }
   } catch { /* A failed confirmation never replaces the last confirmed status. */ }
   if(!disposed&&++attempts<8)timer=setTimeout(poll,5000);
   else if(!disposed)setMessage("Payment confirmation is pending. Check again here before purchasing.");
  };
  let timer:ReturnType<typeof setTimeout>=setTimeout(poll,1000);
  return()=>{disposed=true;clearTimeout(timer);};
 },[stripeAvailable,onStatusChange]);
 async function reload(){
  const result=await membershipStatus();
  if(result.ok){setStatus(result.value);onStatusChange?.(result.value);return true;}
  setError("Membership status couldn't be loaded. Please retry.");return false;
 }
 async function act(run:()=>Promise<{ok:true;value:unknown}|{ok:false;error:string}>){
  if(submitting.current)return;
  submitting.current=true;setBusy(true);setError("");setMessage("");
  try {
   const result=await run();if(!result.ok){setError(result.error);return;}
   if(result.value&&typeof result.value==="object"&&"url" in result.value){window.location.assign(String(result.value.url));return;}
   if(await reload())setMessage("Membership updated.");
  } catch {setError("Membership request failed. Please retry.");}
  finally{submitting.current=false;setBusy(false);}
 }
 if(!status)return <div className="space-y-3"><p role="status" className="text-sm">Membership status couldn&apos;t be loaded. Your other account controls remain available.</p><GymButton disabled={busy} onClick={async()=>{if(submitting.current)return;submitting.current=true;setBusy(true);setError("");try{await reload();}catch{setError("Membership status couldn't be loaded. Please retry.");}finally{submitting.current=false;setBusy(false);}}}>{busy?"Loading…":"Retry membership"}</GymButton>{error&&<p role="alert" className="text-sm">{error}</p>}</div>;
 const canPurchase=checkoutAvailable&&!!legalBundle?.purchaseReady&&offerReady&&priceAvailability[currency]!==false&&!paidActive;
 return <div className="space-y-5">
  <MembershipAccessSummary status={status} />
  <div className="rounded-2xl border p-4 space-y-2">
   <p className="text-sm text-muted-foreground">Use the same ManForth account on web, iPhone and Android. One active membership covers all three.</p>
   {!!status.activeProviders?.length&&<p className="text-sm">Purchased through {status.activeProviders.map(provider=>({stripe:'Stripe',apple_app_store:'Apple App Store',google_play:'Google Play'})[provider]).join(' · ')}</p>}
   {status.multipleActiveSources&&<p role="status" className="text-sm">More than one subscription is active. Manage renewals with each provider to avoid duplicate charges. Access periods are not added together.</p>}
   {status.access.readOnly&&<p className="text-sm">Your records remain readable. Security, billing, support and data controls stay available.</p>}
   {status.access.operatorReview&&<p role="status" className="text-sm">A billing adjustment needs review. Contact support.</p>}
   {status.syncError&&<p role="status" className="text-sm">Membership confirmation needs attention. Retry or contact support.</p>}
  </div>
  {!status.trialStart&&!status.paidThrough&&<><p className="text-sm">New accounts start their {trialDays}-day trial automatically. This existing account can claim its unused trial here. No card needed.</p><GymButton tone="blue" disabled={busy} onClick={()=>act(startMembershipTrial)}>Start {trialDays}-day trial</GymButton></>}
  <section className="space-y-4 border-t pt-5">
   <h3 className="font-semibold">One annual membership</h3>
   <p className="text-sm text-muted-foreground">{paidActive?"Your subscription keeps its recorded billing currency.":!offerReady?"Checking regional pricing…":regionalFallback?"Region unavailable. EUR pricing is used.":"Membership currency follows your region."}</p>
   <p className="text-2xl font-semibold text-primary">{paidActive&&(!validBillingCurrency(status.billingCurrency)||status.recordedAmountMinor===null)?"Manage your recorded price with your provider":!offerReady?"Loading price…":new Intl.NumberFormat(settings.preferences.numberLocale,{style:"currency",currency}).format((paidActive&&status.recordedAmountMinor!=null?status.recordedAmountMinor:annualPrices[currency])/100)+" "+currency+" / year"}</p>
   <p className="text-sm text-muted-foreground">Full yearly charge. The displayed price includes configured applicable tax. Stripe charges the currency shown. Finance preferences do not change your subscription.</p>
   {canPurchase&&<><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5 accent-primary" disabled={busy} checked={accept} onChange={e=>setAccept(e.target.checked)}/><span>I understand the annual price is charged now. Membership renews annually unless I cancel renewal.</span></label><LegalAgreementControl bundle={legalBundle} accepted={acceptedLegal} onChange={setAcceptedLegal} disabled={busy}/></>}
   <div className="flex flex-wrap gap-3">
    {!paidActive&&<GymButton tone="orange" disabled={busy||!canPurchase||!accept||!acceptedLegal} onClick={()=>act(()=>createMembershipCheckout({currency,acceptImmediateCharge:true,legal:agreementFor(legalBundle!)}))}>Purchase annual membership</GymButton>}
    {status.hasCustomer&&<GymButton tone="blue" disabled={busy||!stripeAvailable} onClick={()=>act(openMembershipPortal)}>Manage payments, receipts & cancellation</GymButton>}
    {status.activeProviders?.includes('apple_app_store')&&<a className="gym-button gym-blue inline-flex min-h-11 items-center rounded-2xl border px-4 py-2 font-medium" href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noopener noreferrer">Manage Apple subscription</a>}
    {status.activeProviders?.includes('google_play')&&<a className="gym-button gym-blue inline-flex min-h-11 items-center rounded-2xl border px-4 py-2 font-medium" href="https://play.google.com/store/account/subscriptions" target="_blank" rel="noopener noreferrer">Manage Google Play subscription</a>}
    {status.checkoutPending&&<GymButton disabled={busy||!stripeAvailable} onClick={()=>act(expireMembershipCheckout)}>Close pending checkout</GymButton>}
    <GymButton disabled={busy||(!stripeAvailable&&!status.nativeConfigured)} onClick={()=>act(refreshMembership)}>Confirm membership status</GymButton>
   </div>
   {!paidActive&&(!checkoutAvailable||!legalBundle?.purchaseReady||priceAvailability[currency]===false)&&<p role="status" className="text-sm text-muted-foreground">{customerMessages.membershipUnavailable}</p>}
   <p className="text-sm text-muted-foreground">Cancellation turns renewal off and preserves paid access until its end date. Manage payment methods and invoices in the secure billing portal.</p>
  </section>
  {busy&&<p role="status">Confirming membership…</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="gym-error text-sm">{error}</p>}
 </div>;
}
