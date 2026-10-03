export type AccessProjection = {
  emailVerified: boolean; deleting?: boolean; transition?: boolean; legacyUntil?: string | null;
  trialStart?: string | null; trialEnd?: string | null; paidThrough?: string | null; paidConfirmed?: boolean;
  graceUntil?: string | null; renewalOff?: boolean; operatorReview?: boolean;
};
export function evaluateAccess(record: AccessProjection, now = new Date()) {
  const timestamp = now.getTime();
  const future = (date?: string | null) => !!date && Number.isFinite(Date.parse(date)) && Date.parse(date) > timestamp;
  const result = (state: string, canWrite: boolean, end: string | null = null) => ({ state, canWrite, end, readOnly: !canWrite, operatorReview: !!record.operatorReview });
  if (record.deleting) return result("deletion-pending", false);
  if (record.transition) return result("launch-transition", true);
  if (future(record.legacyUntil)) return result("migration-window", true, record.legacyUntil!);
  if (!record.emailVerified) return result("verification-required", false);
  if (record.paidConfirmed && future(record.paidThrough)) return result(record.renewalOff ? "paid-renewal-off" : "paid", true, record.paidThrough!);
  if (record.paidConfirmed && future(record.graceUntil)) return result("renewal-grace", true, record.graceUntil!);
  if (future(record.trialEnd)) return result("trial", true, record.trialEnd!);
  const expiredEnd = [record.trialEnd, record.paidConfirmed ? record.paidThrough : null, record.paidConfirmed ? record.graceUntil : null].filter((value): value is string => !!value && Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  return result(record.trialStart || record.paidConfirmed ? "expired" : "eligible", false, expiredEnd);
}
export function completionAllowed(expiry: string | null, created: string, active: boolean, now = new Date(), hours = 24) {
  if (!expiry || !active) return false;
  const end = Date.parse(expiry), start = Date.parse(created), current = now.getTime();
  return Number.isFinite(end) && Number.isFinite(start) && start <= end && current >= end && current < end + hours * 3600000;
}
