"use client";
import { useEffect, useState } from "react";
import {
  beginEmailProof,
  confirmEmailCode,
  resendEmailProof,
  completeAccountEmail,
} from "@/lib/actions/identity.actions";
import { Field, GymButton } from "@/app/(main)/account/gym/GymUI";
import { PasswordInput } from "@/app/components/ui/password-input";
import TurnstileCheck from "./TurnstileCheck";
export default function EmailProofForm({
  purpose,
  initialEmail = "",
  onVerified,
}: {
  purpose: "signup" | "email-change" | "verify-account";
  initialEmail?: string;
  onVerified?: (email: string) => void;
}) {
  const [email, setEmail] = useState(initialEmail),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [stage, setStage] = useState<"email" | "code" | "done">("email"),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [wait, setWait] = useState(0),
    [resendAt, setResendAt] = useState(0);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(
      () => setWait(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000))),
      1000,
    );
    return () => clearTimeout(timer);
  }, [wait, resendAt]);
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const result = await confirmEmailCode(code);
      if (!result.ok) throw new Error(result.error);
      if (purpose !== "signup") {
        const completed = await completeAccountEmail(purpose);
        if (!completed.ok) throw new Error(completed.error);
      }
      setStage("done");
      setMessage(
        purpose === "email-change"
          ? "Email updated. Other devices signed out."
          : "Email verified.",
      );
      onVerified?.(email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        if (stage === "code") {
          await confirm();
          return;
        }
        setBusy(true);
        setError("");
        try {
          const result = await beginEmailProof({
            email,
            purpose,
            botToken: token,
            ...(purpose === "email-change"
              ? { currentPassword: password }
              : {}),
          });
          if (!result.ok) throw new Error(result.error);
          setMessage(result.value.message);
          setWait(result.value.seconds);
          setResendAt(
            Math.max(
              Date.now() + result.value.seconds * 1000,
              "blockedUntil" in result.value && result.value.blockedUntil
                ? Date.parse(String(result.value.blockedUntil))
                : 0,
            ),
          );
          setStage("code");
          setPassword("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Email request failed");
        } finally {
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
        disabled={stage !== "email" || purpose === "verify-account"}
        onChange={(e) => setEmail(e.target.value)}
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
          <TurnstileCheck
            action={`b1_${purpose.replaceAll("-", "_")}`}
            onToken={setToken}
          />
          <GymButton tone="blue" type="submit" disabled={busy || !token}>
            {busy ? "Requesting…" : "Send verification code"}
          </GymButton>
        </>
      )}
      {stage === "code" && (
        <>
          <Field
            label="Six-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <p className="text-xs text-muted-foreground">
            Codes expire after 10 minutes. Use the latest message. Signup allows
            one resend; after the second accepted send, the address is blocked
            from more signup mail for 24 hours.
          </p>
          <div className="flex flex-wrap gap-3">
            <GymButton tone="blue" type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Verify email"}
            </GymButton>
            <GymButton
              disabled={busy || wait > 0}
              onClick={async () => {
                setBusy(true);
                const result = await resendEmailProof();
                if (result.ok) {
                  setMessage(result.value.message);
                  setWait(result.value.seconds);
                  setResendAt(
                    Math.max(
                      Date.now() + result.value.seconds * 1000,
                      "blockedUntil" in result.value &&
                        result.value.blockedUntil
                        ? Date.parse(String(result.value.blockedUntil))
                        : 0,
                    ),
                  );
                } else setError(result.error);
                setBusy(false);
              }}
            >
              {wait > 0
                ? `Resend in ${wait >= 3600 ? `${Math.ceil(wait / 3600)}h` : wait >= 60 ? `${Math.ceil(wait / 60)}m` : `${wait}s`}`
                : "Resend code"}
            </GymButton>
            <GymButton
              disabled={busy}
              onClick={() => {
                setStage("email");
                setCode("");
                setToken("");
              }}
            >
              Change email
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
