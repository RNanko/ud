export const billingProviders = ["stripe", "apple_app_store", "google_play"] as const;
export type BillingProvider = typeof billingProviders[number];
export type BillingSource = {
  provider: BillingProvider; environment: "production" | "test" | "sandbox" | "unknown";
  subscriptionId: string; status: string; confirmed: boolean; paidThrough: string | null;
  graceUntil: string | null; renewalOff: boolean; currency: string | null; amountMinor: number | null;
};
export function sourceEntitlement(sources: BillingSource[], environment: "production" | "test", now = new Date()) {
  const future = (value: string | null) => !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) > now.getTime();
  const scoped = sources.filter(source => environment === "production" ? source.environment === "production" : ["test", "sandbox"].includes(source.environment));
  const paid = scoped.filter(source => source.confirmed && !["revoked", "pending"].includes(source.status) && future(source.paidThrough));
  const grace = scoped.filter(source => source.confirmed && source.status === "grace" && future(source.graceUntil));
  const available = paid.length ? paid : grace;
  const endOf = (source: BillingSource) => paid.length ? source.paidThrough! : source.graceUntil!;
  const selected = [...available].sort((a,b) => Date.parse(endOf(b)) - Date.parse(endOf(a)))[0];
  const active = [...new Map([...paid, ...grace].map(source => [`${source.provider}:${source.subscriptionId}`, source])).values()];
  return {
    paidConfirmed: scoped.some(source => source.confirmed),
    paidThrough: selected && paid.length ? selected.paidThrough : scoped.filter(source=>source.confirmed && source.status !== "revoked").map(source=>source.paidThrough).filter((date): date is string=>!!date && Number.isFinite(Date.parse(date)) && Date.parse(date)<=now.getTime()).sort((a,b)=>Date.parse(b)-Date.parse(a))[0] ?? null,
    graceUntil: selected && !paid.length ? selected.graceUntil : null,
    renewalOff: !!selected && active.every(source=>source.renewalOff),
    activeProviders: [...new Set(active.map(source=>source.provider))],
    multipleActiveSources: active.length > 1,
    selected: selected ?? null,
  };
}
