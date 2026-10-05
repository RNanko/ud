"use client";
import { useSyncExternalStore } from "react";
import { BadgeCheck, Clock3 } from "lucide-react";
import { GymButton } from "@/app/(main)/account/gym/GymUI";
import { formatAccountTimestamp } from "@/lib/account/format";
import { membershipDisplay, type MembershipDisplayStatus } from "@/lib/account/membership-display";
import { useAccountPreferences } from "./AccountPreferencesProvider";

function subscribe(listener: () => void) {
  const timer = setInterval(listener, 60000);
  window.addEventListener("focus", listener);
  document.addEventListener("visibilitychange", listener);
  return () => {
    clearInterval(timer);
    window.removeEventListener("focus", listener);
    document.removeEventListener("visibilitychange", listener);
  };
}
const clockSnapshot = () => Math.floor(Date.now() / 60000) * 60000;

export default function MembershipAccessSummary({ status, onManage }: {
  status: MembershipDisplayStatus | null;
  onManage?: () => void;
}) {
  const { settings } = useAccountPreferences();
  const checkedAt = status?.checkedAt ? Date.parse(status.checkedAt) : 0;
  const clock = useSyncExternalStore(subscribe, clockSnapshot, () => Number.isFinite(checkedAt) ? checkedAt : 0);
  if (!status) return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm">
    <p>Membership status couldn&apos;t be loaded.</p>
    {onManage && <GymButton onClick={onManage}>View membership</GymButton>}
  </div>;
  const info = membershipDisplay(status, Math.max(clock, Number.isFinite(checkedAt) ? checkedAt : 0));
  const Icon = info.paid ? BadgeCheck : Clock3;
  return <section aria-label="Your membership" className="rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Icon size={18} aria-hidden="true" />{info.label}</p>
        {info.remaining && <p className="text-2xl font-semibold tracking-tight sm:text-3xl">{info.remaining}</p>}
        {info.end && <p className="text-sm text-muted-foreground">{info.endLabel} {formatAccountTimestamp(info.end, settings.preferences)}</p>}
      </div>
      {onManage && <GymButton tone="blue" onClick={onManage}>Manage membership</GymButton>}
    </div>
    {info.note && <p className="mt-4 text-sm text-muted-foreground">{info.note}</p>}
  </section>;
}
