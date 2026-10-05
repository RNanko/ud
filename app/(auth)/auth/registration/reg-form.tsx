"use client";
import { brand } from "@/lib/brand";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GymButton } from "@/app/(main)/account/gym/GymUI";
import BirthDateField from "@/app/components/shared/account/BirthDateField";
import {
  PasswordInput,
  PasswordInputStrengthChecker,
} from "@/app/components/ui/password-input";
import EmailProofForm from "@/app/components/shared/account/EmailProofForm";
import { completeVerifiedSignup } from "@/lib/account/email/signup-client";
import LegalAgreementControl from "@/app/components/legal/LegalAgreementControl";
import { agreementFor, type LegalBundle } from "@/lib/legal/types";
import { customerMessages } from "@/lib/account/customer-messages";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  passwordValidationError,
} from "@/lib/account/password-policy";
import { dateOfBirthSchema } from "@/lib/account/birth-date";

export default function RegistrationForm() {
  const [started, setStarted] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [bundle, setBundle] = useState<LegalBundle | null>(null),
    [accepted, setAccepted] = useState(false);
  const [available, setAvailable] = useState(false),
    [loading, setLoading] = useState(true);
  const [needsAgreement, setNeedsAgreement] = useState(false);
  const request = useRef(0),
    submitting = useRef(false);
  const refreshLegal = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setAccepted(false);
    try {
      const response = await fetch("/api/public/legal", { cache: "no-store" });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (id !== request.current) return;
      setBundle(data.bundle ?? null);
      setAvailable(data.registrationAvailable === true && !!data.bundle);
    } catch {
      if (id === request.current) setAvailable(false);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);
  const cancelRefresh = useCallback(() => {
    request.current++;
  }, []);
  useEffect(() => {
    void refreshLegal();
    return cancelRefresh;
  }, [refreshLegal, cancelRefresh]);
  function handleRequestError(_message: string, code?: string) {
    if (code === "LEGAL_VERSIONS_CHANGED") {
      setNeedsAgreement(true);
      void refreshLegal();
      setError(customerMessages.legalChanged);
      return true;
    } else if (code === "REGISTRATION_UNAVAILABLE") {
      setAvailable(false);
      setError("");
      return true;
    }
    return false;
  }
  const ready = available && !!bundle && !loading;
  const agreement = (
    <LegalAgreementControl
      bundle={bundle}
      accepted={accepted}
      onChange={setAccepted}
      disabled={busy || !ready}
    />
  );
  function validateDetails() {
    const passwordError = passwordValidationError(password);
    if (passwordError) return passwordError;
    if (password !== confirm) return "Passwords do not match.";
    const birth = dateOfBirthSchema.safeParse(dateOfBirth);
    return birth.success ? null : birth.error.issues[0].message;
  }
  async function createAccount() {
    if (submitting.current || !ready) return false;
    setError("");
    if (!accepted) {
      setError("Please accept the Terms & Conditions to continue.");
      return false;
    }
    const detailsError = validateDetails();
    if (detailsError) {
      setError(detailsError);
      return false;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const result = await completeVerifiedSignup({
        password,
        dateOfBirth,
        legal: agreementFor(bundle!),
      });
      if (!result.ok) {
        setError(result.error);
        handleRequestError(result.error, result.code);
        return false;
      }
      setPassword("");
      setConfirm("");
      window.location.assign(result.value.redirect);
      return true;
    } catch {
      setError("We couldn't complete registration. Please try again.");
      return false;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const details = (
    <>
      <label className="grid gap-2 text-sm font-medium">
        Password
        <PasswordInput
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        >
          <PasswordInputStrengthChecker />
        </PasswordInput>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Confirm password
        <PasswordInput
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      <BirthDateField
        label="Date of birth"
        required
        value={dateOfBirth}
        onChange={setDateOfBirth}
      />
    </>
  );
  return (
    <section className="gym-scope account-settings-panel auth-card auth-form" aria-busy={loading || busy}>
      <header className="auth-form-header">
        <h1>Create your account</h1>
        <p>
          Enter your details, then verify your email. Your free 14-day trial starts when your account is created. No card required.
        </p>
      </header>
      {loading ? (
        <p role="status" className="sr-only">
          Loading registration form…
        </p>
      ) : (
        !available && (
          <div className="space-y-3">
            <p role="status" className="text-sm text-muted-foreground">
              {customerMessages.registrationUnavailable}
            </p>
            <GymButton onClick={() => void refreshLegal()}>
              Check again
            </GymButton>
          </div>
        )
      )}
      {(loading || ready || started) && (
        <EmailProofForm
          purpose="signup"
          className="auth-form"
          onVerified={createAccount}
          onStarted={() => setStarted(true)}
          signupAgreement={
            bundle && accepted ? agreementFor(bundle) : undefined
          }
          signupReady={ready}
          signupFields={details}
          signupCodeFields={needsAgreement ? agreement : undefined}
          validateSignup={validateDetails}
          agreementControl={agreement}
          onRequestError={handleRequestError}
        />
      )}
      {busy && (
        <p role="status" className="text-sm text-primary">
          Creating your account…
        </p>
      )}
      {error && (
        <p role="alert" className="gym-error text-sm">
          {error}
        </p>
      )}
      <div className="auth-card-footer">
        <Link className="auth-link" href="/auth/login">
          Sign in
        </Link>
        <Link className="auth-link" href={"mailto:" + brand.supportEmail}>
          Contact support
        </Link>
        <Link
          href="/help"
          target="_blank"
          rel="noopener noreferrer"
          className="auth-link"
          aria-label="Help & Q&A (opens in a new tab)"
        >
          Help & Q&A
        </Link>
      </div>
    </section>
  );
}
