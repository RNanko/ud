export type MembershipDisplayStatus = {
  checkedAt?: string;
  access: { state: string; end?: string | null };
  trialEnd?: string | null;
  paidThrough?: string | null;
  renewalOff?: boolean;
};

export function remainingMembershipTime(end: string | null | undefined, now: number) {
  const timestamp = end ? Date.parse(end) : NaN;
  if (!Number.isFinite(timestamp)) return null;
  const remaining = timestamp - now;
  if (remaining <= 0) return "Expired";
  if (remaining < 86400000) return "Less than a day left";
  const days = Math.ceil(remaining / 86400000);
  return `${days} ${days === 1 ? "day" : "days"} left`;
}

export function membershipDisplay(status: MembershipDisplayStatus, now: number) {
  const state = status.access.state;
  const paid = ["paid", "paid-renewal-off"].includes(state);
  const trial = state === "trial";
  const end = (paid ? status.paidThrough : trial ? status.trialEnd : status.access.end) ?? status.access.end ?? null;
  const remaining = remainingMembershipTime(end, now);
  const ended = remaining === "Expired";
  const labels: Record<string, string> = {
    "launch-transition": "Account access available", "migration-window": "Access period",
    eligible: "Trial available", "renewal-grace": "Payment needs attention", expired: "Membership expired",
    "verification-required": "Verify your email", "deletion-pending": "Account deletion pending",
  };
  return {
    paid, trial, end,
    label: paid ? ended ? "Paid membership ended" : "Paid membership" : trial ? ended ? "Trial ended" : "Free trial" : labels[state] ?? "Membership status",
    remaining: (paid || trial || ["migration-window", "renewal-grace"].includes(state)) ? remaining : null,
    endLabel: paid ? status.renewalOff || ended ? "Access ends" : "Renews" : trial ? "Trial ends" : "Access ends",
    note: paid ? status.renewalOff ? "Renewal is off. Your paid access lasts until the end date." : "Your annual membership renews automatically unless you cancel."
      : trial ? "No card required. Your trial will not charge you automatically." : null,
  };
}
