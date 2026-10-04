"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { GymButton, Field } from "@/app/(main)/account/gym/GymUI";
import { PasswordInput } from "@/app/components/ui/password-input";
import {
  exportAccountData,
  deletePersonalAccount,
} from "@/lib/actions/privacy.actions";
export default function PrivacySettings({
  retention,
}: {
  version: string;
  terms: string | null;
  privacy: string | null;
  retention: string | null;
}) {
  const router = useRouter();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [open, setOpen] = useState(false),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [accept, setAccept] = useState(false);
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="font-semibold">Policies</h3>
        <p className="text-sm text-muted-foreground">Read how ManForth works and how your information is handled. These pages are available to everyone.</p>
        <div className="flex flex-wrap gap-3">
          <a className="gym-button gym-blue inline-flex min-h-11 items-center rounded-2xl border px-4 py-2 font-medium" href="/privacy" target="_blank" rel="noopener noreferrer" aria-label="Privacy Policy (opens in a new tab)">Privacy Policy<ArrowUpRight aria-hidden="true" className="ml-2 size-4" /></a>
          <a className="gym-button gym-blue inline-flex min-h-11 items-center rounded-2xl border px-4 py-2 font-medium" href="/terms" target="_blank" rel="noopener noreferrer" aria-label="Terms & Conditions (opens in a new tab)">Terms & Conditions<ArrowUpRight aria-hidden="true" className="ml-2 size-4" /></a>
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold">Your data</h3>
        <p className="text-sm text-muted-foreground">
          Download your owned records, preferences, currency labels and
          membership status. Passwords, tokens, provider secrets and other
          people’s records are excluded.
        </p>
        <GymButton
          tone="blue"
          disabled={busy}
          onClick={async () => {
            if (submitting.current) return;
            submitting.current = true;
            setBusy(true);
            setError("");
            setMessage("");
            try {
            const result = await exportAccountData();
            if (result.ok) {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(result.value, null, 2)], {
                  type: "application/json",
                }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = `b1-way-export-${new Date().toISOString().slice(0, 10)}.json`;
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              setMessage("Your data export is ready.");
            } else setError(result.error);
            } catch { setError("Your data couldn't be exported. Please retry."); }
            finally { submitting.current = false; setBusy(false); }
          }}
        >
          Export my data
        </GymButton>
      </section>
      <section className="space-y-3 border-t pt-6">
        <h3 className="font-semibold">Support & policies</h3>
        <a className="text-primary underline" href="mailto:support-mf@b1-way.pl">
          support-mf@b1-way.pl
        </a>
        {retention && <p className="text-sm text-muted-foreground">{retention}</p>}
      </section>
      <section className="space-y-4 border-t pt-6">
        <h3 className="font-semibold">Delete account</h3>
        <p className="text-sm">
          Deletion requires your current password. We resolve pending checkouts
          and stop Stripe renewal charges before removing your identity and
          owned application records. Provider or legal records may remain under
          the applicable policy. Deleting the account does not automatically
          issue a refund.
        </p>
        <p className="text-sm text-muted-foreground">Apple and Google subscriptions must be canceled in your store account first. Confirm membership status after cancellation, then return here to delete the account.</p>
        <GymButton tone="orange" disabled={busy} onClick={() => setOpen(!open)}>
          {open ? "Cancel deletion" : "Review account deletion"}
        </GymButton>
        {open && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (submitting.current) return;
              submitting.current = true;
              setBusy(true);
              setError("");
              setMessage("");
              try {
              const result = await deletePersonalAccount({
                password,
                confirmation,
                stopRenewals: accept,
              });
              if (result.ok) router.replace("/auth/login?deleted=1");
              else setError(result.error);
              } catch { setError("Account deletion couldn't be completed. Please retry."); }
              finally { submitting.current = false; setBusy(false); }
            }}
          >
            <div className="account-fields-grid">
              <label className="grid min-w-0 gap-2 text-sm font-medium">
                Current password
                <PasswordInput
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <Field
                label="Type DELETE MY ACCOUNT"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </div>
            <label className="flex gap-3 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={accept}
                onChange={(e) => setAccept(e.target.checked)}
              />
              <span>
                I authorize stopping future charges and deleting my application
                data.
              </span>
            </label>
            <GymButton
              tone="orange"
              type="submit"
              disabled={busy || !accept || confirmation !== "DELETE MY ACCOUNT"}
            >
              Confirm account deletion
            </GymButton>
          </form>
        )}
      </section>
      {busy && <p role="status">Processing…</p>}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="gym-error text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
