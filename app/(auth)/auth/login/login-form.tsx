"use client";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { signInErrorMessage } from "@/lib/account/login-error";
import { Field, GymButton } from "@/app/(main)/account/gym/GymUI";
import { PasswordInput } from "@/app/components/ui/password-input";
export function LoginForm({
  className,
  redirectLink,
  ...props
}: React.ComponentProps<"div"> & { redirectLink?: string }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const target =
    redirectLink?.startsWith("/") && !redirectLink.startsWith("//") && !redirectLink.includes("\\")
      ? redirectLink
      : "/account";
  return (
    <div
      className={cn("gym-scope account-settings-panel auth-card", className)}
      {...props}
    >
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const result = await authClient.signIn.email({ email, password });
            if (result.error) {
              setError(signInErrorMessage(result.error));
              return;
            }
            window.location.assign(target);
          } catch {
            setError("Could not connect to sign in. Check your connection and try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <header className="auth-form-header"><h1>Welcome back</h1><p>Sign in to your ManForth account.</p></header>
        <Field
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="grid gap-2 text-sm font-medium">
          Password
          <PasswordInput
            required
            autoComplete="current-password"
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <p className="auth-password-actions"><Link className="auth-link" href="/auth/forgot-password">Forgot password</Link></p>
        <GymButton tone="blue" type="submit" disabled={busy} aria-busy={busy} aria-label={busy ? "Signing in" : "Sign in"}>
          {busy ? <LoaderCircle size={20} className="motion-safe:animate-spin" aria-hidden="true" /> : "Sign in"}
        </GymButton>
        {error && (
          <p role="alert" className="gym-error text-sm">
            {error}
          </p>
        )}
        <p className="auth-card-footer">
          <span>New to ManForth?</span><Link className="auth-link" href="/auth/registration">
            Create account
          </Link>
        </p>
      </form>
    </div>
  );
}
