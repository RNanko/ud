"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Field, GymButton } from "@/app/(main)/account/gym/GymUI";
import { requestRecovery } from "@/lib/actions/identity.actions";
export default function RecoveryForm() {
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const submitting = useRef(false);
  return (
    <form
      className="gym-scope account-settings-panel auth-card auth-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        setBusy(true);
        setError("");
        setMessage("");
        try {
          const result = await requestRecovery({ email });
          if (result.ok) setMessage(result.value.message);
          else setError(result.error);
        } catch {
          setError("We couldn't request a recovery link. Please try again.");
        } finally {
          submitting.current = false;
          setBusy(false);
        }
      }}
    >
      <header className="auth-form-header"><h1>Forgot password</h1><p>
        Enter your login email and we’ll send you a link to reset your password.
      </p></header>
      <Field
        label="Login email"
        type="email"
        required
        autoComplete="email"
        value={email}
        disabled={busy}
        onChange={(e) => setEmail(e.target.value)}
      />
      <GymButton tone="blue" type="submit" disabled={busy}>
        {busy ? "Requesting…" : "Send reset link"}
      </GymButton>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="gym-error text-sm">
          {error}
        </p>
      )}
      <p className="auth-card-footer">
        <Link className="auth-link" href="/auth/login">
          Back to sign in
        </Link>
        <a className="auth-link" href="mailto:support-mf@b1-way.pl">
          Contact support
        </a>
      </p>
    </form>
  );
}
