"use client";
import { formatAccountTimestamp } from "@/lib/account/format";
import { useAccountPreferences } from "./AccountPreferencesProvider";
import { useState, useEffect } from "react";
import { GymButton } from "@/app/(main)/account/gym/GymUI";
import { membershipStatus, startMembershipTrial, createMembershipCheckout, openMembershipPortal, expireMembershipCheckout, refreshMembership } from "@/lib/actions/billing.actions";
import { annualPrices, type BillingCurrency } from "@/lib/account/config";
import { validBillingCurrency } from "@/lib/landing/offer";
import LegalAgreementControl from "@/app/components/legal/LegalAgreementControl";
import { agreementFor, type LegalBundle } from "@/lib/legal/types";
type Status=Extract<Awaited<ReturnType<typeof membershipStatus>>,{ok:true}>["value"];
export default function MembershipSettings({initial,trialDays,stripeAvailable,checkoutAvailable,legalBundle}:{initial:Status;trialDays:number;stripeAvailable:boolean;checkoutAvailable:boolean;legalBundle:LegalBundle|null}){
 const {settings}=useAccountPreferences();
 const date=(value:string)=>formatAccountTimestamp(value,settings.preferences);
 const [status,setStatus]=useState(initial),[currency,setCurrency]=useState<BillingCurrency>(validBillingCurrency(initial.billingCurrency) ?? "EUR"),[accept,setAccept]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [offerReady,setOfferReady]=useState(false),[regionalFallback,setRegionalFallback]=useState(false);
 const [priceAvailability,setPriceAvailability]=useState<Partial<Record<BillingCurrency,boolean>>>({});
 const [acceptedLegal,setAcceptedLegal]=useState(false);
 const paidActive=!!status.paidThrough&&Date.parse(status.paidThrough)>Date.now();
 useEffect(()=>{
  const controller=new AbortController(),recorded=validBillingCurrency(status.billingCurrency);
  setOfferReady(false);setAccept(false);setAcceptedLegal(false);setRegionalFallback(false);
  if(paidActive&&recorded)setCurrency(recorded);
  fetch('/api/public/offer',{cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
   if(controller.signal.aborted)return;
   setPriceAvailability(data.availability??{});
   if(!paidActive)setCurrency(validBillingCurrency(data.currency)??'EUR');
   setOfferReady(true);
  }).catch(()=>{
   if(controller.signal.aborted)return;
   if(!paidActive){setCurrency('EUR');setRegionalFallback(true);}
   setOfferReady(true);
  });
  return()=>controller.abort();
 },[paidActive,status.billingCurrency]);
 useEffect(()=>{if(!stripeAvailable||new URLSearchParams(window.location.search).get('billing')!=='confirming')return;let disposed=false,attempts=0;setMessage('Payment is awaiting provider confirmation. Return URLs do not grant access.');const poll=async()=>{const result=await refreshMembership();if(disposed)return;if(result.ok){const current=await membershipStatus();if(!disposed&&current.ok){setStatus(current.value);if(current.value.access.state.startsWith('paid')){setMessage('Payment confirmed. Annual access is active.');return;}}}if(++attempts<8)timer=setTimeout(poll,5000);else setMessage('Confirmation is pending. You can retry here; no duplicate purchase is needed.');};let timer:ReturnType<typeof setTimeout>=setTimeout(poll,1000);return()=>{disposed=true;clearTimeout(timer);};},[stripeAvailable]);
 async function reload(){const result=await membershipStatus();if(result.ok)setStatus(result.value);else setError(result.error);}
 async function act(run:()=>Promise<{ok:true;value:unknown}|{ok:false;error:string}>){if(busy)return;setBusy(true);setError("");try{const result=await run();if(!result.ok)throw new Error(result.error);if(result.value&&typeof result.value==="object"&&"url"in result.value){window.location.assign(String(result.value.url));return;}setMessage("Membership updated.");await reload();}catch(e){setError(e instanceof Error?e.message:"Membership request failed");}finally{setBusy(false);}}
 return <div className="space-y-5"><div className="rounded-2xl border p-4 space-y-2"><p className="font-semibold capitalize">{status.access.state.replaceAll("-"," ")}</p>{status.access.end&&<p className="text-sm">Access until {date(status.access.end)}</p>}{status.trialEnd&&<p className="text-sm">Trial ends {date(status.trialEnd)}</p>}{status.paidThrough&&<p className="text-sm">Paid access through {date(status.paidThrough)} · {status.renewalOff?"Renewal off":"Annual renewal on"} · {status.billingCurrency}</p>}{status.access.state==="launch-transition"&&<p className="text-sm text-muted-foreground">Membership enforcement is awaiting the configured launch cutover. Existing records and access are preserved during migration.</p>}{status.access.readOnly&&<p className="text-sm">Your saved records remain readable. Settings, security, support, billing, export and deletion remain available.</p>}{status.access.operatorReview&&<p role="status" className="text-sm">A billing adjustment requires operator review. Contact support.</p>}{status.syncError&&<p className="text-sm">{status.syncError}</p>}</div>
 {!status.trialStart&&!status.paidThrough&&<><p className="text-sm">One {trialDays}-day trial per account. No card needed. It starts only when you choose the action below.</p><GymButton tone="blue" disabled={busy} onClick={()=>act(startMembershipTrial)}>Start {trialDays}-day trial</GymButton></>}
 <section className="space-y-4 border-t pt-5"><h3 className="font-semibold">One annual membership</h3><p className="text-sm text-muted-foreground">{paidActive?"Your subscription keeps its recorded billing currency.":!offerReady?"Checking regional pricing…":regionalFallback?"Region unavailable. EUR pricing is used.":"Membership currency is selected automatically for your region."}</p><p className="text-2xl font-semibold text-primary">{new Intl.NumberFormat(settings.preferences.numberLocale,{style:"currency",currency}).format(annualPrices[currency]/100)} {currency} / year</p><p className="text-sm text-muted-foreground">Full yearly charge. Displayed price includes configured applicable tax. Stripe charges the currency shown here. Finance preferences never change your subscription.</p><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5 accent-primary" disabled={busy||!offerReady||paidActive} checked={accept} onChange={e=>setAccept(e.target.checked)}/><span>I understand this charges the annual price now and begins a paid annual period after payment. No second trial or deferred charge. This membership renews annually unless you cancel renewal.</span></label><LegalAgreementControl bundle={legalBundle} accepted={acceptedLegal} onChange={setAcceptedLegal} disabled={busy||!legalBundle||paidActive}/><div className="flex flex-wrap gap-3"><GymButton tone="orange" disabled={busy||!offerReady||!accept||!acceptedLegal||!legalBundle?.purchaseReady||!checkoutAvailable||priceAvailability[currency]===false||paidActive} onClick={()=>act(()=>createMembershipCheckout({currency,acceptImmediateCharge:true,legal:agreementFor(legalBundle!)}))}>Purchase annual membership</GymButton>{status.hasCustomer&&<GymButton tone="blue" disabled={busy} onClick={()=>act(openMembershipPortal)}>Manage payments, receipts & cancellation</GymButton>}{status.checkoutPending&&<GymButton disabled={busy} onClick={()=>act(expireMembershipCheckout)}>Close pending checkout</GymButton>}<GymButton disabled={busy||!stripeAvailable} onClick={()=>act(refreshMembership)}>Confirm membership status</GymButton></div>{(!checkoutAvailable||priceAvailability[currency]===false)&&<p role="status" className="text-sm text-muted-foreground">Checkout is unavailable until reviewed legal documents and consumer-rights processes, annual prices, signed webhooks, the billing portal and applicable launch checks are configured. No payment has been requested.</p>}<p className="text-sm text-muted-foreground">Cancellation turns renewal off and preserves paid access until its end date. Use the secure billing portal to manage payment methods and invoices.</p></section>{busy&&<p role="status">Confirming membership…</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="gym-error text-sm">{error}</p>}</div>;
}
