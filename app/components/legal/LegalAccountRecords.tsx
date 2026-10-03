"use client";
import { useEffect, useState } from "react";
import { getMyLegalHistory } from "@/lib/actions/legal.actions";
import { GymButton } from "@/app/(main)/account/gym/GymUI";
import { downloadLegal } from "./LegalActions";
type History = Extract<Awaited<ReturnType<typeof getMyLegalHistory>>, { ok: true }>["value"];
export default function LegalAccountRecords() {
 const [data,setData]=useState<History|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){setLoading(true);setError("");try{const result=await getMyLegalHistory();if(!result.ok)throw Error(result.error);if(result.value.unavailable)throw Error('Legal records could not be loaded. Your account controls remain available.');setData(result.value);}catch(e){setError(e instanceof Error?e.message:'Legal records could not be loaded.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 const stamp=(value:unknown)=>new Date(String(value)).toLocaleString();
 const version=(id:unknown)=>String(id).split(':').at(-1);
 return <section className="space-y-4">
  <h3 className="font-semibold">Documents & your acceptance records</h3>
  <div className="flex flex-wrap gap-4 text-sm"><a href={data?.bundle?.terms.href||'/terms'} target="_blank" rel="noopener noreferrer" className="text-primary underline">Current Terms & Conditions</a><a href={data?.bundle?.privacy.href||'/privacy'} target="_blank" rel="noopener noreferrer" className="text-primary underline">Current Privacy Policy</a></div>
  {loading&&<p role="status" className="text-sm">Loading legal records…</p>}
  {error&&<div><p role="alert" className="text-sm">{error}</p><GymButton onClick={()=>void load()}>Retry records</GymButton></div>}
  {data&&!loading&&<>
   {!data.bundle&&<p className="text-sm text-muted-foreground">No reviewed document bundle has been published yet.</p>}
   {!data.records.length&&<p className="text-sm text-muted-foreground">No acceptance record is available for this account. Earlier registrations have not been assigned a fabricated acceptance.</p>}
   {data.records.map(row=><article key={String(row.id)} className="rounded-2xl border p-4 space-y-3 text-sm"><p className="font-semibold">{row.context==='purchase'?'Purchase agreement':'Registration agreement'}</p><p>Terms agreed: {stamp(row.terms_accepted_at)}<br/>Privacy notice acknowledged: {stamp(row.privacy_acknowledged_at)}</p><p>{String(row.statement)}</p><div className="flex flex-wrap gap-4"><a className="underline" href={`/terms/${version(row.terms_id)}`} target="_blank" rel="noopener noreferrer">Terms {version(row.terms_id)}</a><a className="underline" href={`/privacy/${version(row.privacy_id)}`} target="_blank" rel="noopener noreferrer">Privacy {version(row.privacy_id)}</a></div><p className="text-xs text-muted-foreground">English · Web · Privacy acknowledgement is not marketing consent.</p><GymButton onClick={()=>downloadLegal(row,`manforth-agreement-${row.id}.json`)}>Download exact accepted copy</GymButton></article>)}
   {data.purchases.map(row=><article key={String(row.operation)} className="rounded-2xl border p-4 space-y-3 text-sm"><p className="font-semibold">Annual purchase information</p><p>{String(row.currency)} {(Number(row.amount)/100).toFixed(2)} / year · Presented {stamp(row.presented_at)}</p><p className="text-muted-foreground">This is the information accepted before checkout; payment confirmation remains in Membership & billing.</p><GymButton onClick={()=>downloadLegal(row,`manforth-purchase-${row.operation}.json`)}>Download purchase information</GymButton></article>)}
  </>}
 </section>;
}
