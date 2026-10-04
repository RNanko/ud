"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PasswordInput } from "@/app/components/ui/password-input";
import { GymButton } from "@/app/(main)/account/gym/GymUI";
import { changeAccountPassword, accountSessions, revokeAccountSession, revokeOtherAccountSessions } from "@/lib/actions/identity.actions";
import { authClient } from "@/lib/auth-client";
import EmailProofForm from "./EmailProofForm";
import { useAccountPreferences } from "./AccountPreferencesProvider";
import { formatAccountTimestamp } from "@/lib/account/format";
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_LENGTH_HINT } from "@/lib/account/password-policy";
type Sessions=Extract<Awaited<ReturnType<typeof accountSessions>>,{ok:true}>["value"];
export default function SecuritySettings({onEmailVerified}:{onEmailVerified?:(email:string)=>void}) {
 const router=useRouter(),{settings}=useAccountPreferences();
 const [current,setCurrent]=useState(""),[password,setPassword]=useState(""),[confirmation,setConfirmation]=useState("");
 const [message,setMessage]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[sessions,setSessions]=useState<Sessions|null>(null);
 const submitting=useRef(false);
 async function loadSessions(){const result=await accountSessions();if(result.ok)setSessions(result.value);else setError(result.error);}
 async function run(action:()=>Promise<void>){if(submitting.current)return;submitting.current=true;setBusy(true);setError("");setMessage("");try{await action();}catch{setError("Security request failed. Please retry.");}finally{submitting.current=false;setBusy(false);}}
 return <div className="space-y-5"><fieldset disabled={busy} className="min-w-0 space-y-8"><legend className="sr-only">Account security controls</legend>
  <section><h3 className="font-semibold">Change password</h3><p className="mt-2 text-sm text-muted-foreground">Use a unique passphrase of {PASSWORD_LENGTH_HINT}.</p>
   <form className="account-half-form mt-4 grid gap-4" onSubmit={event=>{event.preventDefault();if(password!==confirmation){setMessage("");setError("Passwords do not match.");return;}void run(async()=>{const result=await changeAccountPassword({currentPassword:current,newPassword:password});if(!result.ok){setError(result.error);return;}setMessage(result.value.message);setCurrent("");setPassword("");setConfirmation("");await loadSessions();});}}>
    {[["Current password",current,setCurrent],["New password",password,setPassword],["Confirm new password",confirmation,setConfirmation]].map(([label,value,set],index)=><label key={String(label)} className="grid min-w-0 gap-2 text-sm font-medium">{String(label)}<PasswordInput required autoComplete={index===0?"current-password":"new-password"} minLength={index?PASSWORD_MIN_LENGTH:1} maxLength={PASSWORD_MAX_LENGTH} value={String(value)} onChange={event=>(set as (value:string)=>void)(event.target.value)}/></label>)}
    <GymButton type="submit" tone="blue" className="justify-self-start" disabled={busy}>Change password & sign out other devices</GymButton>
   </form>
  </section>
  <section className="space-y-4 border-t pt-6"><h3 className="font-semibold">Change login email</h3><p className="text-sm text-muted-foreground">Your current email stays active until the new mailbox is verified. Your account records stay with the same account.</p><EmailProofForm purpose="email-change" className="account-half-form space-y-4" onVerified={onEmailVerified}/></section>
  <section className="space-y-4 border-t pt-6"><h3 className="font-semibold">Active devices</h3>
   <div className="flex flex-wrap gap-3"><GymButton disabled={busy} onClick={()=>run(loadSessions)}>Load active sessions</GymButton><GymButton disabled={busy} onClick={()=>run(async()=>{const result=await revokeOtherAccountSessions();if(!result.ok){setError(result.error);return;}setMessage(result.value.message);await loadSessions();})}>Sign out other devices</GymButton></div>
   {sessions?.map(session=><article key={session.id} className="rounded-2xl border p-4 space-y-2"><p className="text-sm wrap-anywhere">{session.device}{session.current?" · Current device":""}</p><p className="text-xs text-muted-foreground wrap-anywhere">IP: {session.ip} · Last seen {formatAccountTimestamp(session.lastSeen,settings.preferences)}</p>{!session.current&&<GymButton disabled={busy} onClick={()=>run(async()=>{const result=await revokeAccountSession(session.id);if(!result.ok){setError(result.error);return;}await loadSessions();setMessage(result.value.message);})}>Sign out this device</GymButton>}</article>)}
   {sessions?.length===0&&<p>No active sessions found.</p>}
   <GymButton disabled={busy} onClick={()=>run(async()=>{const result=await authClient.signOut();if(result.error){setError("Couldn't sign out. Please retry.");return;}router.replace("/auth/login");})}>Sign out current device</GymButton>
  </section>
 </fieldset>{busy&&<p role="status" className="text-sm">Processing…</p>}{message&&<p role="status" className="text-sm">{message}</p>}{error&&<p role="alert" className="gym-error text-sm">{error}</p>}</div>;
}
