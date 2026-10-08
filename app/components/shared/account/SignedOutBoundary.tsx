"use client";

import { Activity, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "./SessionProvider";
import SessionButton from "./SessionButton";

export function AuthSessionLoading({ failed = false, onRetry }: { failed?: boolean; onRetry?: () => void }) {
  return <div className="auth-page"><section className="gym-scope account-settings-panel auth-card auth-session-card" role="status">
    <div className="auth-form-header"><h1>{failed ? "Let’s reconnect" : "Opening your account"}</h1>
      <p>{failed ? "We couldn’t check your account. Try again to continue." : "Just a moment while we check your session."}</p>
    </div>
    <SessionButton className="auth-session-button" status={failed ? "error" : "loading"} onRetry={onRetry} />
  </section></div>;
}

export default function SignedOutBoundary({ children }: { children: ReactNode }) {
  const { status, refetch } = useAuthSession();
  const router = useRouter();
  useEffect(() => {
    if (status === "authenticated") router.replace("/account");
  }, [router, status]);
  // Background revalidation hides the form without losing its fields or code step.
  return <>
    {status !== "guest" && <AuthSessionLoading failed={status === "error"} onRetry={() => { void refetch().catch(() => {}); }} />}
    <Activity mode={status === "guest" ? "visible" : "hidden"}>{children}</Activity>
  </>;
}
