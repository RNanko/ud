"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { subscribeSessionChange } from "@/lib/account/session-signal";
import { publicSessionStatus, type PublicSessionStatus } from "@/lib/account/public-session";

type SessionState = ReturnType<typeof authClient.useSession> & { status: PublicSessionStatus; isInvalidating: boolean };
const SessionContext = createContext<SessionState | null>(null);

export function useAuthSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Session provider missing");
  return session;
}

export default function SessionProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const [isInvalidating, setInvalidating] = useState(false);
  const { refetch } = session;
  useEffect(() => {
    let live = true, generation = 0;
    const dispose = subscribeSessionChange(() => {
      const token = ++generation;
      // An explicit sign-in/out, credential or account change is different
      // from a routine poll: keep the old workspace hidden until it settles.
      setInvalidating(true);
      void refetch().finally(() => {
        if (live && token === generation) setInvalidating(false);
      }).catch(() => {});
    });
    return () => { live = false; dispose(); };
  }, [refetch]);
  const snapshot = { ...session, isInvalidating };
  return <SessionContext value={{ ...snapshot, status: publicSessionStatus(snapshot) }}>{children}</SessionContext>;
}
