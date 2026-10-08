"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link, { useLinkStatus } from "next/link";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  validBillingCurrency,
  actionDestinations,
  type LandingAction,
} from "@/lib/landing/offer";
import type { BillingCurrency } from "@/lib/account/config";
import { useAuthSession } from "@/app/components/shared/account/SessionProvider";
import SessionButton from "@/app/components/shared/account/SessionButton";
import type { PublicSessionStatus } from "@/lib/account/public-session";
type LandingState = {
  currency: BillingCurrency;
  paid: boolean;
  action: LandingAction;
  trialDays: number;
  availability: Partial<Record<BillingCurrency, boolean>>;
  sessionStatus: PublicSessionStatus;
  retrySession: () => void;
};
const LandingContext = createContext<LandingState | null>(null);
export function useLanding() {
  const state = useContext(LandingContext);
  if (!state) throw Error("Landing context missing");
  return state;
}
export default function LandingProvider({
  trialDays,
  children,
}: {
  trialDays: number;
  children: ReactNode;
}) {
  const session = useAuthSession();
  const [regionalCurrency, setRegionalCurrency] =
      useState<BillingCurrency>("EUR"),
    [availability, setAvailability] = useState<
      Partial<Record<BillingCurrency, boolean>>
    >({});
  const [subscription, setSubscription] = useState<{
    owner: string;
    currency: BillingCurrency;
  } | null>(null);
  const owner =
    session.status === "authenticated" ? session.data?.user.id : null;
  const paid = !!owner && subscription?.owner === owner;
  const currency = paid ? subscription!.currency : regionalCurrency;
  const action: LandingAction =
    session.status === "authenticated" ? "open" : "signup";
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/offer", { cache: "no-store", signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setRegionalCurrency(validBillingCurrency(data.currency) ?? "EUR");
          setAvailability(data.availability ?? {});
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    // Membership currency can load in the background; it must not delay app entry.
    fetch("/api/public/account", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const recorded = validBillingCurrency(data.paidCurrency);
        setSubscription(recorded ? { owner, currency: recorded } : null);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [owner]);
  return (
    <LandingContext
      value={{
        currency,
        paid,
        action,
        trialDays,
        availability,
        sessionStatus: session.status,
        retrySession: () => {
          void session.refetch().catch(() => {});
        },
      }}
    >
      {children}
    </LandingContext>
  );
}
export function MainAction({ compact = false }: { compact?: boolean }) {
  const { action, trialDays, sessionStatus, retrySession } = useLanding();
  const className = `mf-primary mf-session-action ${compact ? "" : "mf-main-action"}`;
  if (sessionStatus === "loading" || sessionStatus === "error")
    return (
      <SessionButton
        className={className}
        status={sessionStatus}
        onRetry={retrySession}
      />
    );
  const label =
    action === "open"
      ? "Open app"
      : action === "membership"
        ? "View membership"
        : action === "verify"
          ? "Continue verification"
          : action === "trial"
            ? `Start ${trialDays}-day trial`
            : `Start your ${trialDays}-day trial`;
  return (
    <Button asChild className={className}>
      <Link href={actionDestinations[action]} aria-label={label}>
        <LandingActionLabel label={label} />
      </Link>
    </Button>
  );
}

export function LandingActionLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span
        className="mf-action-label"
        style={pending ? { visibility: "hidden" } : undefined}
      >
        {label}
        <ArrowUpRight size={18} aria-hidden="true" />
      </span>
      {pending && (
        <LoaderCircle
          size={20}
          className="mf-action-spinner motion-safe:animate-spin"
          role="status"
          aria-label="Opening app"
        />
      )}
    </>
  );
}

export function LandingAuthLink() {
  const { status, refetch } = useAuthSession();
  if (status === "loading" || status === "error")
    return (
      <SessionButton
        className="mf-session-link"
        status={status}
        onRetry={() => {
          void refetch().catch(() => {});
        }}
      />
    );
  return (
    <Link
      href={
        status === "authenticated"
          ? actionDestinations.open
          : "/auth/login?redirect=%2Faccount"
      }
    >
      {status === "authenticated" ? "Open app" : "Sign in"}
    </Link>
  );
}
