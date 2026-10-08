import type { PrivateSessionSnapshot } from "./private-identity";

export type PublicSessionStatus = "loading" | "error" | "guest" | "authenticated";

// Public controls must not assume a failed or unfinished check means signed out.
export function publicSessionStatus(snapshot: PrivateSessionSnapshot, now?: number): PublicSessionStatus {
  if (snapshot.error?.status === 401) return "guest";
  if (snapshot.isPending || (!snapshot.data && snapshot.isRefetching)) return "loading";
  if (snapshot.error) return "error";
  if (!snapshot.data) return "guest";
  const expiry = new Date(snapshot.data.session.expiresAt).getTime();
  if (!Number.isFinite(expiry)) return "error";
  return expiry > (now ?? Date.now()) ? "authenticated" : "guest";
}
