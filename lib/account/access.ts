import { PublicError } from "./errors";
import "server-only";
import { accountSql, membershipFor } from "./store";
import { launchPolicy, PERSONAL_PRODUCT } from "./config";
import { completionAllowed, evaluateAccess } from "./access-policy";
import { billingSources, billingSourcesEnabled, billingEnvironment } from "./billing/sources";
import { sourceEntitlement } from "./billing/entitlement";
export async function productAccess(owner: string) {
  const [users, membership, deleted] = await Promise.all([
    accountSql`SELECT email_verified, created_at FROM "user" WHERE id=${owner}`, membershipFor(owner),
    accountSql`SELECT 1 FROM b1_deletions WHERE user_id=${owner} AND product=${PERSONAL_PRODUCT}`,
  ]);
  if (!users[0]) throw new PublicError("Unauthorized");
  const policy = launchPolicy();
  const sources = await billingSources(owner);
  const entitlement = sourceEntitlement(sources, billingEnvironment());
  // With normalized billing enabled, only environment-scoped provider evidence
  // grants paid access. Unknown legacy mappings require provider reconciliation.
  const normalized = billingSourcesEnabled();
  const access = evaluateAccess({ emailVerified: users[0].email_verified, deleting: !!deleted[0], transition: !policy.enforceMembership,
    legacyUntil: policy.legacyCreatedBefore && Date.parse(users[0].created_at) < Date.parse(policy.legacyCreatedBefore) ? policy.legacyAccessUntil : null,
    trialStart: membership?.trial_started_at, trialEnd: membership?.trial_ends_at, paidThrough: normalized?entitlement.paidThrough:membership?.paid_through,
    paidConfirmed: normalized?entitlement.paidConfirmed:!!membership?.paid_confirmed, graceUntil: normalized?entitlement.graceUntil:membership?.grace_until, renewalOff: normalized?entitlement.renewalOff:!!membership?.renewal_off,
    operatorReview: !!membership?.operator_review || normalized&&sources.some(source=>source.environment==='unknown'),
  });
  return { ...access, activeProviders: entitlement.activeProviders, multipleActiveSources: entitlement.multipleActiveSources };
}
export async function assertProductWrite(owner: string, completion?: { kind: "workout" | "focus"; id: string }) {
  const access = await productAccess(owner);
  if (access.canWrite) return;
  if (completion && !["verification-required", "deletion-pending", "eligible"].includes(access.state)) {
    if (completion.kind === "workout") {
      const rows = await accountSql`SELECT created_at, data->>'status' AS status FROM gym_sessions WHERE id=${completion.id} AND user_id=${owner} AND archived=false`;
      if (rows[0] && completionAllowed(access.end, rows[0].created_at, rows[0].status === "active")) return;
    } else {
      const rows = await accountSql`SELECT f->'intervals'->0->>'start' AS started_at, f->>'status' AS status FROM momentum_state m, jsonb_array_elements(m.data->'focus') f WHERE m.user_id=${owner} AND f->>'id'=${completion.id}`;
      if (rows[0] && completionAllowed(access.end, rows[0].started_at, ["running", "paused", "awaiting"].includes(rows[0].status))) return;
    }
  }
  throw new PublicError("Membership is read-only. Open Account & Settings to start your trial or manage membership. Saved records remain available.");
}
