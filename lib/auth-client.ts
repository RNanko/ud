"use client";

import { createAuthClient } from "better-auth/react";
import { announceSessionChange } from "./account/session-signal";

export const authClient = createAuthClient({
  // Use Better Auth's single session atom, including its broadcast, focus,
  // cancellation and stale-response handling, for long-lived private tabs.
  sessionOptions: { refetchInterval: 60, refetchWhenOffline: true },
  fetchOptions: {
    onSuccess(context) {
      if (typeof window === "undefined") return;
      const path = new URL(context.request.url, window.location.origin).pathname;
      if (/\/(sign-in\/email|sign-up\/email|sign-out|verify-email|change-email|change-password|delete-user|revoke-sessions|revoke-session|revoke-other-sessions)$/.test(path)) {
        announceSessionChange();
      }
    },
  },
});

