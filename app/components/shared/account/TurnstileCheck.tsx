"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { brand } from "@/lib/brand";
type Turnstile={render:(element:HTMLElement,options:{sitekey:string;action:string;callback:(token:string)=>void;"expired-callback":()=>void;"error-callback":()=>void;theme:string})=>string;remove:(id:string)=>void;};
declare global{interface Window{turnstile?:Turnstile;}}
export default function TurnstileCheck({action,onToken}:{action:string;onToken:(token:string)=>void}){
 const root=useRef<HTMLDivElement>(null),callback=useRef(onToken),[ready,setReady]=useState(false),[error,setError]=useState("");useEffect(()=>{callback.current=onToken;},[onToken]);
 const key=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
 useEffect(()=>{if(!ready||!root.current||!key||!window.turnstile)return;const id=window.turnstile.render(root.current,{sitekey:key,action,theme:"auto",callback:token=>{setError("");callback.current(token);},"expired-callback":()=>callback.current(""),"error-callback":()=>{callback.current("");setError("Verification check failed. Reload to retry.");}});return()=>{window.turnstile?.remove(id);};},[ready,key,action]);
 if(!key)return <p role="status" className="text-sm text-muted-foreground">Email requests are unavailable until delivery and bot protection are configured. Contact <a className="underline" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.</p>;
 return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={()=>setReady(true)} onError={()=>setError("Verification check could not load. Reload to retry.")}/><div ref={root}/>{error&&<p role="alert">{error}</p>}</>;
}
