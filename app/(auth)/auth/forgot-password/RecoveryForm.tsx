"use client";
import { brand } from "@/lib/brand";
import { useRef, useState } from "react";
import Link from "next/link";
import { Field, GymButton } from "@/app/(main)/account/gym/GymUI";
import { requestRecovery } from "@/lib/actions/identity.actions";
export default function RecoveryForm() {
  const [email, setEmail] = useState(""),
    [migration, setMigration] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const submitting = useRef(false);
  return (
    <form
      className="gym-scope account-settings-panel mx-auto max-w-md space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        setBusy(true);
        setError("");
        setMessage("");
        try {
          const result = await requestRecovery({ email, migration });
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
      <h1 className="text-2xl font-semibold">Recover your {brand.productName} account</h1>
      <p className="text-sm text-muted-foreground">
        A mailbox link lets you choose a new password. Existing GitHub/Discord
        users keep the same account and saved history.
      </p>
      <Field
        label="Login email"
        type="email"
        required
        autoComplete="email"
        value={email}
        disabled={busy}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label className="flex items-start gap-3 text-sm">
        <input
          className="size-5 mt-0.5"
          type="checkbox"
          checked={migration}
          disabled={busy}
          onChange={(e) => setMigration(e.target.checked)}
        />
        I previously used GitHub or Discord and need to set a password.
      </label>
      <GymButton tone="blue" type="submit" disabled={busy}>
        {busy ? "Requesting…" : "Send recovery link"}
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
      <p className="text-sm">
        <Link className="underline" href="/auth/login">
          Back to sign in
        </Link>{" "}
        ·{" "}
        <a className="underline" href="mailto:support-mf@b1-way.pl">
          Contact support
        </a>
      </p>
    </form>
  );
}
