"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { subscribeSessionChange } from "@/lib/account/session-signal";
import { publicSessionStatus, type PublicSessionStatus } from "@/lib/account/public-session";

type SessionState = ReturnType<typeof authClient.useSession> & { status: PublicSessionStatus };
const SessionContext = createContext<SessionState | null>(null);

export function useAuthSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Session provider missing");
  return session;
}

export default function SessionProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const { refetch } = session;
  useEffect(() => subscribeSessionChange(() => { void refetch().catch(() => {}); }), [refetch]);
  return <SessionContext value={{ ...session, status: publicSessionStatus(session) }}>{children}</SessionContext>;
}
