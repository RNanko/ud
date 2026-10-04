"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LegalAgreement } from "@/lib/legal/types";
import {
  beginEmailProof,
  confirmEmailCode,
  resendEmailProof,
  completeAccountEmail,
} from "@/lib/actions/identity.actions";
import { beginSignupProof, confirmSignupCode, resendSignupProof } from "@/lib/account/email/signup-client";
import { signupEmailLimitMessage } from "@/lib/account/email/send-status";
import { Field, GymButton } from "@/app/(main)/account/gym/GymUI";
import { PasswordInput } from "@/app/components/ui/password-input";
export default function EmailProofForm({
  purpose,
  initialEmail = "",
  className = "w-full max-w-lg space-y-4",
  onVerified,
  signupAgreement,
  signupReady = false,
  signupFields,
  signupCodeFields,
  validateSignup,
  agreementControl,
  onRequestError,
  onStarted,
}: {
  purpose: "signup" | "email-change" | "verify-account";
  initialEmail?: string;
  className?: string;
  onVerified?: (email: string) => void | boolean | Promise<void | boolean>;
  signupAgreement?: LegalAgreement;
  signupReady?: boolean;
  signupFields?: ReactNode;
  signupCodeFields?: ReactNode;
  validateSignup?: () => string | null;
  agreementControl?: ReactNode;
  onRequestError?: (message: string, code?: string) => boolean | void;
  onStarted?: () => void;
}) {
  const [email, setEmail] = useState(initialEmail),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [stage, setStage] = useState<"email" | "code" | "done">("email"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [wait, setWait] = useState(0),
    [resendAt, setResendAt] = useState(0),
    [sendLimited, setSendLimited] = useState(false);
  const submitting = useRef(false);
  const verifiedCode = useRef<string | null>(null);
  function reportError(message: string, code?: string) {
    // The signup parent owns availability/version notices, so show them once.
    if (!onRequestError?.(message, code)) setError(message);
  }
  function updateSendStatus(value: { seconds: number; blockedUntil?: unknown; sendLimited?: boolean }) {
    const limited = purpose === "signup" && value.sendLimited === true;
    setSendLimited(limited);
    setWait(limited ? 0 : value.seconds);
    setResendAt(Math.max(Date.now() + value.seconds * 1000,
      purpose !== "signup" && value.blockedUntil ? Date.parse(String(value.blockedUntil)) : 0));
  }
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(
      () => setWait(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000))),
      1000,
    );
    return () => clearTimeout(timer);
  }, [wait, resendAt]);
  async function confirm() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (purpose !== "signup" || verifiedCode.current !== code) {
        const result = purpose === "signup" ? await confirmSignupCode(code) : await confirmEmailCode(code);
        if (!result.ok) {
          reportError(result.error, result.code);
          return;
        }
        if (purpose === "signup") verifiedCode.current = code;
      }
      if (purpose !== "signup") {
        const completed = await completeAccountEmail(purpose);
        if (!completed.ok) {
          reportError(completed.error, completed.code);
          return;
        }
      }
      // Await signup completion before showing success. A failed save can retry
      // the already verified proof, including an interrupted sign-in after creation.
      if (purpose === "signup" && (await onVerified?.(email)) === false) return;
      setStage("done");
      setMessage(
        purpose === "email-change"
          ? "Email updated. Other devices signed out."
          : purpose === "signup" && onVerified
            ? "Account created. Opening your account…"
            : "Email verified.",
      );
      if (purpose !== "signup") onVerified?.(email);
    } catch {
      setError("We couldn't verify your email. Please try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      className={className}
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          submitting.current ||
          stage === "done" ||
          (purpose === "signup" && !signupReady)
        )
          return;
        if (stage === "code") {
          await confirm();
          return;
        }
        setBusy(true);
        submitting.current = true;
        setError("");
        setMessage("");
        const detailsError = purpose === "signup" ? validateSignup?.() : null;
        if (detailsError) {
          setBusy(false);
          submitting.current = false;
          setError(detailsError);
          return;
        }
        if (purpose === "signup" && !signupAgreement) {
          setBusy(false);
          submitting.current = false;
          setError(
            "Please agree to the Terms and acknowledge the Privacy Policy before requesting verification.",
          );
          return;
        }
        try {
          const result = purpose === "signup"
            ? await beginSignupProof({ email, legal: signupAgreement })
            : await beginEmailProof({ email, purpose, ...(purpose === "email-change" ? { currentPassword: password } : {}) });
          if (!result.ok) {
            reportError(result.error, result.code);
            return;
          }
          updateSendStatus(result.value);
          if ("codeAvailable" in result.value && result.value.codeAvailable === false) {
            setError(result.value.message);
            return;
          }
          setMessage(result.value.sendLimited ? "" : result.value.message);
          setStage("code");
          verifiedCode.current = null;
          onStarted?.();
          setPassword("");
        } catch {
          setError(
            "We couldn't request a verification code. Please try again.",
          );
        } finally {
          submitting.current = false;
          setBusy(false);
        }
      }}
    >
      <Field
        label={purpose === "email-change" ? "New login email" : "Email"}
        type="email"
        required
        autoComplete="email"
        value={email}
        disabled={
          busy ||
          stage !== "email" ||
          purpose === "verify-account" ||
          (purpose === "signup" && !signupReady)
        }
        onChange={(e) => { setEmail(e.target.value); setSendLimited(false); }}
      />
      {stage === "email" && (
        <>
          {purpose === "email-change" && (
            <label className="grid gap-2 text-sm font-medium">
              Current password
              <PasswordInput
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {purpose === "signup" && signupFields && (
            <fieldset
              disabled={busy || !signupReady}
              className="min-w-0 space-y-4"
            >
              <legend className="sr-only">Account details</legend>
              {signupFields}
            </fieldset>
          )}
          <fieldset
            disabled={busy || (purpose === "signup" && !signupReady)}
            className="min-w-0"
          >
            {agreementControl}
          </fieldset>
          <GymButton
            tone="blue"
            type="submit"
            disabled={busy || (purpose === "signup" && !signupReady)}
          >
            {busy ? "Requesting…" : "Send verification code"}
          </GymButton>
        </>
      )}
      {stage === "code" && (
        <>
          {purpose === "signup" && signupCodeFields && (
            <fieldset disabled={busy || !signupReady} className="min-w-0">
              {signupCodeFields}
            </fieldset>
          )}
          <Field
            label="Six-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            disabled={busy}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <p className="text-xs text-muted-foreground">
            The code expires after 10 minutes. Use the latest email.
          </p>
          {purpose === "signup" && sendLimited && (
            <div role="status" className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
              <p>{signupEmailLimitMessage}</p>
              <p className="mt-2 text-muted-foreground">You can still enter the latest code sent to this address.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <GymButton
              tone="blue"
              type="submit"
              disabled={busy || (purpose === "signup" && !signupReady)}
            >
              {busy
                ? "Confirming…"
                : purpose === "signup"
                  ? "Confirm code"
                  : "Verify email"}
            </GymButton>
            {!(purpose === "signup" && sendLimited) && <GymButton
              disabled={
                busy || wait > 0 || (purpose === "signup" && !signupReady)
              }
              onClick={async () => {
                if (submitting.current || wait > 0 || sendLimited) return;
                submitting.current = true;
                setBusy(true);
                setError("");
                setMessage("");
                try {
                  const result = purpose === "signup" ? await resendSignupProof() : await resendEmailProof();
                  if (result.ok) {
                    verifiedCode.current = null;
                    updateSendStatus(result.value);
                    setMessage(result.value.sendLimited && result.value.message === signupEmailLimitMessage ? "" : result.value.message);
                  } else reportError(result.error, result.code);
                } catch {
                  setError("The code couldn't be resent. Please try again.");
                } finally {
                  submitting.current = false;
                  setBusy(false);
                }
              }}
            >
              {wait > 0
                ? `Resend in ${purpose === "signup" ? `${wait}s` : wait >= 3600 ? `${Math.ceil(wait / 3600)}h` : wait >= 60 ? `${Math.ceil(wait / 60)}m` : `${wait}s`}`
                : "Resend code"}
            </GymButton>}
            <GymButton
              disabled={busy}
              onClick={() => {
                setStage("email");
                setCode("");
                if (purpose === "signup" && sendLimited) setEmail("");
                setSendLimited(false);
                setMessage("");
                setError("");
                verifiedCode.current = null;
              }}
            >
              {purpose === "signup" ? sendLimited ? "Use a different email" : "Edit details" : "Change email"}
            </GymButton>
          </div>
        </>
      )}
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm gym-error">
          {error}
        </p>
      )}
    </form>
  );
}
