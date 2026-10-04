"use client";
import { brand } from "@/lib/brand";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Field, GymButton } from "@/app/(main)/account/gym/GymUI";
import { PasswordInput, PasswordInputStrengthChecker } from "@/app/components/ui/password-input";
import EmailProofForm from "@/app/components/shared/account/EmailProofForm";
import { completeSignup } from "@/lib/actions/identity.actions";
import LegalAgreementControl from "@/app/components/legal/LegalAgreementControl";
import { agreementFor, type LegalBundle } from "@/lib/legal/types";
import { customerMessages } from "@/lib/account/customer-messages";
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_LENGTH_HINT } from "@/lib/account/password-policy";
import {dateOfBirthSchema,registrationToday} from "@/lib/account/birth-date";

export default function RegistrationForm() {
  const [verified, setVerified] = useState(false), [started, setStarted] = useState(false);
  const [email,setEmail]=useState(""),[dateOfBirth,setDateOfBirth]=useState(""),[password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [bundle, setBundle] = useState<LegalBundle | null>(null), [accepted, setAccepted] = useState(false);
  const [available, setAvailable] = useState(false), [loading, setLoading] = useState(true);
  const request = useRef(0), submitting = useRef(false);
  const refreshLegal = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setAccepted(false);
    try {
      const response = await fetch("/api/public/legal", { cache: "no-store" });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (id !== request.current) return;
      setBundle(data.bundle ?? null);
      setAvailable(data.registrationAvailable === true && !!data.bundle);
    } catch {
      if (id === request.current) setAvailable(false);
    } finally { if (id === request.current) setLoading(false); }
  }, []);
  const cancelRefresh = useCallback(() => { request.current++; }, []);
  useEffect(() => { void refreshLegal(); return cancelRefresh; }, [refreshLegal, cancelRefresh]);
  function handleRequestError(_message: string, code?: string) {
    if (code === "LEGAL_VERSIONS_CHANGED") {
      void refreshLegal(); setError(customerMessages.legalChanged);
      return true;
    } else if (code === "REGISTRATION_UNAVAILABLE") {
      setAvailable(false); setError("");
      return true;
    }
    return false;
  }
  const ready = available && !!bundle && !loading;
  const agreement = <LegalAgreementControl bundle={bundle} accepted={accepted} onChange={setAccepted} disabled={busy || !ready} />;
  function validateDetails(){
    if(password.length<PASSWORD_MIN_LENGTH||password.length>PASSWORD_MAX_LENGTH)return `Use ${PASSWORD_LENGTH_HINT}.`;
    if(password!==confirm)return "Passwords do not match.";
    const birth=dateOfBirthSchema.safeParse(dateOfBirth);
    return birth.success?null:birth.error.issues[0].message;
  }
  const details=<>
    <label className="grid gap-2 text-sm font-medium">Password<PasswordInput required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}><PasswordInputStrengthChecker /></PasswordInput></label>
    <label className="grid gap-2 text-sm font-medium">Confirm password<PasswordInput required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
    <Field label="Date of birth" type="date" required autoComplete="bday" max={registrationToday()} value={dateOfBirth} onChange={event=>setDateOfBirth(event.target.value)}/>
  </>;
  return <section className="gym-scope account-settings-panel min-w-0 space-y-5">
    <h1 className="text-2xl font-semibold">Create your {brand.productName} account</h1>
    <p className="text-sm text-muted-foreground">Enter your details, then verify your email to create your account.</p>
    {loading ? <p role="status" className="text-sm">Checking registration availability…</p> : !available && <div className="space-y-3">
      <p role="status" className="text-sm text-muted-foreground">{customerMessages.registrationUnavailable}</p>
      <GymButton onClick={() => void refreshLegal()}>Check again</GymButton>
    </div>}
    {(ready || started || verified) && (!verified ? <EmailProofForm purpose="signup" onVerified={address => {setEmail(address);setVerified(true);}} onStarted={() => setStarted(true)} signupAgreement={bundle && accepted ? agreementFor(bundle) : undefined} signupReady={ready} signupFields={details} validateSignup={validateDetails} agreementControl={agreement} onRequestError={handleRequestError} /> : <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); if (submitting.current || !ready) return;
      setError("");
      if (!accepted) { setError("Please accept the Terms & Conditions to continue."); return; }
      const detailsError=validateDetails();if(detailsError){setError(detailsError);return;}
      submitting.current = true; setBusy(true);
      try {
        const result = await completeSignup({password,dateOfBirth,legal:agreementFor(bundle!)});
        if (result.ok) window.location.assign(result.value.redirect);
        else { setError(result.error); handleRequestError(result.error, result.code); }
      } catch { setError("We couldn't complete registration. Please try again."); }
      finally { submitting.current = false; setBusy(false); }
    }}>
      <fieldset disabled={busy || !ready} className="min-w-0 space-y-4">
        <legend className="sr-only">Create account details</legend>
        <p className="text-sm text-primary">Email verified</p>
        <Field label="Email" type="email" readOnly autoComplete="email" value={email}/>
        {details}
        {agreement}
        <GymButton tone="blue" type="submit" disabled={busy || !ready}>{busy ? "Creating account…" : "Create account"}</GymButton>
      </fieldset>
    </form>)}
    {error && <p role="alert" className="gym-error text-sm">{error}</p>}
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm"><Link className="underline" href="/auth/login">Sign in</Link><a className="underline" href={"mailto:" + brand.supportEmail}>Contact support</a></div>
  </section>;
}
