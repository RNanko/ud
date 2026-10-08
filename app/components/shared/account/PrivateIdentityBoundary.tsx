"use client";

import { Activity, useEffect, useState, type ReactNode } from "react";
import { useAuthSession } from "./SessionProvider";
import { identityEnded, privateIdentityStatus, type PrivateIdentityStatus } from "@/lib/account/private-identity";
import Loader from "@/app/components/shared/loader";

export default function PrivateIdentityBoundary({ owner, children }: { owner: string; children: ReactNode }) {
  const session = useAuthSession();
  const [closed, setClosed] = useState<PrivateIdentityStatus | null>(null);
  const [offline, setOffline] = useState(false);
  const [clock, tick] = useState(() => Date.now());
  const { refetch } = session;
  const status = privateIdentityStatus(owner, session, clock);
  // Latch confirmed identity loss during render: a late response may never
  // remount the old owner's server tree, even before effects have run.
  if (!closed && identityEnded(status)) setClosed(status);
  const ended = closed ?? (identityEnded(status) ? status : null);

  useEffect(() => {
    const disconnected = () => setOffline(true);
    const connected = () => {
      // Keep drafts hidden until the existing session atom has checked again.
      void refetch().then(() => setOffline(false), () => {});
    };
    if (!navigator.onLine) disconnected();
    window.addEventListener("offline", disconnected);
    window.addEventListener("online", connected);
    return () => {
      window.removeEventListener("offline", disconnected);
      window.removeEventListener("online", connected);
    };
  }, [refetch]);

  useEffect(() => {
    if (!session.data || ended) return;
    const expiry = new Date(session.data.session.expiresAt).getTime();
    if (!Number.isFinite(expiry)) return;
    const timer = setTimeout(() => tick(Date.now()), Math.max(0, Math.min(2_147_483_647, expiry - Date.now())));
    return () => clearTimeout(timer);
  }, [session.data, ended, status, clock]);

  if (ended) return (
    <section role="status" className="mx-auto max-w-lg space-y-4 p-8">
      <p>{ended === "different-owner" ? "Your account changed. Open a fresh workspace to continue." : "Your session ended. Sign in again to continue."}</p>
      {/* A document navigation discards the old router cache and all private providers. */}
      <a className="underline" href={ended === "different-owner" ? "/account" : "/auth/login"}>
        {ended === "different-owner" ? "Open workspace" : "Sign in"}
      </a>
    </section>
  );

  const visible = status === "same-owner" && !offline;
  return <>
    {!visible && <section role="status" className="mx-auto max-w-lg space-y-4 p-8">
      {session.error || offline ? <p>We couldn&apos;t verify your session. Your draft is kept here while you reconnect.</p> : <Loader />}
      {(session.error || offline) && <button type="button" className="underline" disabled={session.isPending || session.isRefetching} onClick={() => {
        void refetch().then(() => setOffline(!navigator.onLine), () => {});
      }}>Retry session check</button>}
    </section>}
    <Activity mode={visible ? "visible" : "hidden"}>{children}</Activity>
  </>;
}
