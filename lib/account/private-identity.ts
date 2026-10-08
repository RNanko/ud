export type PrivateIdentityStatus = "checking" | "same-owner" | "unauthenticated" | "different-owner" | "expired";
export type PrivateSessionSnapshot = {
  data: { user: { id: string }; session: { expiresAt: string | Date } } | null;
  isPending: boolean;
  isRefetching?: boolean;
  error?: { status?: number } | null;
};

export function privateIdentityStatus(owner: string, snapshot: PrivateSessionSnapshot, now: number): PrivateIdentityStatus {
  if (snapshot.error?.status === 401) return "unauthenticated";
  const expires = snapshot.data ? new Date(snapshot.data.session.expiresAt).getTime() : NaN;
  if (Number.isFinite(expires) && expires <= now) return "expired";
  if (snapshot.error || snapshot.isPending || snapshot.isRefetching) return "checking";
  if (!snapshot.data) return "unauthenticated";
  if (snapshot.data.user.id !== owner) return "different-owner";
  return Number.isFinite(expires) ? "same-owner" : "checking";
}

export const identityEnded = (status: PrivateIdentityStatus) =>
  status === "unauthenticated" || status === "different-owner" || status === "expired";
