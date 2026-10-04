# ManForth pre-mobile readiness

Assessment: **not mobile-ready certified**. Web stabilization repairs are delivered; native collection, transport and migration are outside this pass. Evidence/revision is in [the audit](qa-audit-report.md), on `codex/manforth-stabilization-audit` at uncommitted HEAD `60f09b7c278934e3a8d89fa08be5b60dbbe101df`.

## Reusable foundations verified at the local test layer

- Stable identity/product scoping and central owned write guard; separate explicit trial/provider paid-through dates.
- Schema-driven Gym logging, original-plan snapshots, canonical kg/km with historical load convention, nullable unknowns and separate warm-up/working sets.
- Date-only plan/session placement plus IANA timezone/UTC timestamps; deterministic DST/week/year/focus-allocation tests.
- Retry IDs/revision checks for workouts, preset applications, settings and Momentum; server save failures retain typed state without claiming local data is account-synchronized.
- Canonical workout/Event projection and actual-source Momentum counts; connected action fixture verifies completion/reopen/correction without duplication.
- Persistent internal-inbox schema, pagination, source-generation reconciliation and owner/target checks; ordinary tests use no reminder-email/push transport. PostgreSQL worker concurrency remains unverified.
- Shared blue/orange UI, existing cards/dialogs/inputs, accessible reordering controls, public narrow layout. No UI-kit replacement or native auth system added.

## Evidence and limits

Final execution: 265 Node tests passed; TypeScript, lint (no warnings) and production build passed. Public landing tested at 360/390/768/1024/1440; no horizontal overflow and all five local artwork scenes loaded. Help/FAQ/mobile menu/skip/404 keyboard behavior checked. Screenshots and dimensions are linked in the audit.

These are browser viewport emulation and synthetic action/domain tests. They do not prove actual-device touch scrolling/dragging, accessibility-service behavior, background timer recovery, slow-network/offline mutation recovery, database transaction races or sandbox provider lifecycle behavior. Authenticated tests with two isolated owners, text zoom, controlled reduced-motion emulation, private light/dark rendering, production cache/query/performance measurements remain blocked/not checked.

## Before another platform consumes these records

| Priority | Required decision/check | Status |
| --- | --- | --- |
| 1 | Separate disposable PostgreSQL; migrations on empty/pre-upgrade fixtures; retries/races/ownership/export/deletion/late jobs | **Blocked**: remote app DB environment unconfirmed; QA scripts now stop before client creation |
| 1 | Eligible published Terms/Privacy and operator/consumer-rights/retention facts; mailbox/bot readiness | **Blocked**: documents are development drafts; no legal certification |
| 1 | All four annual sandbox prices, authoritative paid-through, cancellation/failure/renewal, once-only trial and read-only writes | Unit checks pass; real provider/browser verification **Not checked** |
| 1 | Manual billing choice wins over later detection while existing purchased currency stays fixed | Backend currency allowlist exists; selector **Not implemented** |
| 2 | Manual daily steps with one source/day identity, total replacement, zero/unknown/as-of/errors and correction history | **Not implemented**; never derive steps from workouts or claim phone/watch collection |
| 2 | Persistent private support requests + restricted staff review + content retention on error | **Not implemented**; mailto is contact only |
| 2 | Inbox snooze and two-client/backend convergence | Snooze **Not implemented**; convergence **Blocked** |
| 2 | Finance/Investment goal source semantics and edits/deletions | Manual Momentum journal verified; automatic source linkage **Not implemented** |
| 2 | Real pointer/touch filtered drag, cancellation, click thresholds, scroll/focus return, save/refresh | Unit logic/control checks pass; actual mobile/browser journeys **Not checked** |
| 2 | Private history pagination/query plans, latency, timers/listeners and large exports | Code-supported risk; production-like measurements **Not checked** |
| 2 | Dependency advisory inventory/transitive scan | Selected maintainer advisories reviewed; registry scanner **failed**, no clean inventory |

## Native work explicitly deferred

Do not copy browser cookies into a native client, add native/push transports, collect HealthKit/Health Connect/watch data, merge phone/watch/manual steps, add a medical chatbot, or invent future privacy consent. Those require a separate design/security/legal/data-source review. Preserve date-only placement, absolute entitlement expiry, saved units/load basis and exact accepted document history rather than translating by device-local defaults.

Keep the separate language product's identity/entitlements intact. A platform decision cannot justify erasing shared/legacy accounts or restarting trials. Before promising native offline support, define idempotent mutation IDs, conflicts, source identities and explicit synchronization states using the current web contracts and measured database behavior.

## Continuation order

1. Resolve the isolated DB/configuration gates and run [QA setup](qa-test-setup.md).
2. Finish authenticated web journeys and migration/provider checks. Review remaining missing feature contracts separately from bugs.
3. Test real phones/assistive technology/zoom/slow networks and measure scale/performance.
4. Only then scope native architecture and health/push integration. Passing the current web build alone does not authorize that migration or certify readiness.
