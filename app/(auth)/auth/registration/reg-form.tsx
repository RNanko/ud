"use client";
import { brand } from "@/lib/brand";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Field,GymButton } from "@/app/(main)/account/gym/GymUI";
import { PasswordInput,PasswordInputStrengthChecker } from "@/app/components/ui/password-input";
import EmailProofForm from "@/app/components/shared/account/EmailProofForm";
import { completeSignup } from "@/lib/actions/identity.actions";
import LegalAgreementControl from "@/app/components/legal/LegalAgreementControl";
import { agreementFor, type LegalBundle } from "@/lib/legal/types";
export default function RegistrationForm(){
 const [verified,setVerified]=useState(false),[name,setName]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [bundle,setBundle]=useState<LegalBundle|null>(null),[accepted,setAccepted]=useState(false),[loading,setLoading]=useState(true),[legalError,setLegalError]=useState("");
 const refreshLegal=useCallback(async()=>{
  setLoading(true);setAccepted(false);setLegalError("");
  try{const response=await fetch('/api/public/legal',{cache:'no-store'});if(!response.ok)throw Error('Documents could not be loaded. Retry below.');const data=await response.json();setBundle(data.bundle??null);if(!data.bundle)setLegalError('Registration is awaiting publication of reviewed Terms and Privacy Policy. Existing account access remains available.');}
  catch(e){setBundle(null);setLegalError(e instanceof Error?e.message:'Documents could not be loaded.');}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refreshLegal();},[refreshLegal]);
 function handleLegalError(message:string){if(message.includes('LEGAL_VERSIONS_CHANGED')){void refreshLegal();setError('The documents changed. Review the new versions and agree again. Your verified mailbox and entered account details are preserved.');}}
 const agreement=<LegalAgreementControl bundle={bundle} accepted={accepted} onChange={setAccepted} disabled={busy||loading||!bundle}/>;
 return <section className="gym-scope account-settings-panel space-y-5">
  <h1 className="text-2xl font-semibold">Create your {brand.productName} account</h1><p className="text-sm text-muted-foreground">First verify your mailbox. Then choose your own password. Your trial starts only when you explicitly start it in Account & Settings.</p>
  {loading&&<p role="status" className="text-sm">Loading current documents…</p>}{legalError&&<div className="space-y-2"><p role="status" className="text-sm text-muted-foreground">{legalError}</p><GymButton disabled={loading} onClick={()=>void refreshLegal()}>Retry documents</GymButton></div>}
  {!verified?<EmailProofForm purpose="signup" onVerified={()=>setVerified(true)} signupAgreement={bundle&&accepted?agreementFor(bundle):undefined} signupReady={!!bundle&&!loading} agreementControl={agreement} onRequestError={handleLegalError}/>:<form className="space-y-4" onSubmit={async e=>{e.preventDefault();if(busy)return;setError("");if(!bundle||!accepted){setError('Please agree to the Terms and acknowledge the Privacy Policy to create an account.');return;}if(password!==confirm){setError('Passwords do not match');return;}setBusy(true);try{const result=await completeSignup({name,password,legal:agreementFor(bundle)});if(result.ok)window.location.assign(result.value.redirect);else{setError(result.error);handleLegalError(result.error);}}finally{setBusy(false);}}}>
   <p className="text-sm text-primary">Email verified</p><Field label="Display name" required maxLength={80} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/><label className="grid gap-2 text-sm font-medium">Password<PasswordInput required minLength={15} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}><PasswordInputStrengthChecker/></PasswordInput></label><label className="grid gap-2 text-sm font-medium">Confirm password<PasswordInput required minLength={15} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><p className="text-xs text-muted-foreground">15–128 characters. Long passphrases are welcome; common and compromised passwords are rejected.</p>{agreement}<GymButton tone="blue" type="submit" disabled={busy||loading||!bundle}>{busy?'Creating account…':'Create account'}</GymButton>
  </form>}{error&&<p role="alert" className="gym-error text-sm">{error}</p>}<p className="text-sm"><Link className="underline" href="/auth/login">Sign in</Link> · <Link className="underline" href="/auth/forgot-password">Recover existing account</Link></p>
 </section>;
}
