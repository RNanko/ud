# ManForth stabilization audit

Audit window: 2026-10-03–04, Europe/Warsaw. This is an implemented stabilization pass, not a launch, legal approval, or native readiness certification.

## Revision, environment and safeguards

- Baseline and final HEAD: `60f09b7c278934e3a8d89fa08be5b60dbbe101df`. Final repairs are **uncommitted working-tree changes** on `codex/manforth-stabilization-audit`; there is no final commit or deployment.
- Windows / PowerShell, Node 22.16.0, Next 16.3.8, React 19.3.0, Better Auth 1.7.7, Neon/Drizzle, existing Node test runner. Installed Next mutation/server-action guides were read before editing.
- Preserved the pre-existing dirty work, including the internal-inbox implementation, account/calendar preferences, source hooks, CSS, package script and notification migration. Those features are not newly created by this audit. No reset, authentication replacement, dependency upgrade or lockfile change was made.
- [Final file digests](qa-artifacts/final-file-hashes.json) identify the delivered changed/untracked files, including inherited work and evidence. A limited credential-pattern scan of saved audit logs/JSON found zero matches; it is not a comprehensive secret audit.
- Used the existing local server at `http://localhost:3000` for public browser checks. Public reads and synthetic domain tests continued while database writes were blocked. The configured PostgreSQL endpoint is remote; whether it is production was **not established**. A clarification asking for a separate disposable `QA_DATABASE_URL` remains unanswered. Docker daemon/local PostgreSQL were unavailable.
- No direct migration, fixture insertion, cleanup, worker execution, deletion, real email, Stripe charge, provider configuration change or deployment was performed. The browser had an existing authenticated session: an attempt to inspect registration redirected to Account & Settings. That redirect is not isolated-fixture evidence; account/inbox reads may initialize state. No account action or form was submitted, and further private browser journeys were stopped.
- Stripe configuration reports test mode, but configuration presence is not provider verification. Legal operator facts, published eligible documents, bot protection, protected mail payload configuration and scheduled job configuration remain incomplete. Secret values, recipients and provider IDs are excluded from this report and screenshots.

## Route and feature inventory

“Implemented” describes code present, not a claim that every journey was executed. Authenticated live-browser interaction and PostgreSQL checks below remain blocked by environment isolation.

| Surface | Implementation | Inspection performed |
| --- | --- | --- |
| `/` | Implemented | Browser: five artwork scenes, responsive widths, demo, carousel controls, FAQ, mobile menu, keyboard skip focus, metadata; source and landing tests |
| `/help` | Implemented Q&A; support is a mailto link | Browser search, no-results state, topic selection, keyboard FAQ, policy links, 390px overflow; Help tests |
| `/terms`, `/privacy` | Implemented readers; only development drafts available | Browser draft notices, public links, noindex, overflow; exact-version validation/store tests |
| `/terms/[version]`, `/privacy/[version]` | Implemented immutable version readers | Source and legal tests; eligible published-version browser history not available |
| `/auth/login`, `/auth/registration`, `/auth/forgot-password`, `/auth/reset-password` | Implemented email/password flows | Auth hooks/actions, proof limits, password and legal tests inspected/executed; anonymous UI and real delivery blocked |
| `/account` | Implemented preferences/security/membership/privacy | Source, account tests; incidental existing-session redirect observed, no mutation |
| `/account/finance` | Implemented entry playground, dashboard, board, history/CSV | Source, calculation/CSV/action/playground tests; private browser drag/import not executed |
| `/account/finance/chart` | Implemented legacy monthly chart | Grouping regression and rendered-component text alternative; PostgreSQL/browser plot verification blocked |
| `/account/investments` | Implemented positions/quotes and USD summaries | Source, quantity/price/currency/date/action tests; external market feed not verified |
| `/account/to-do` | Implemented whole-card board | Source, reducers, interaction/queue/ownership tests; actual pointer/touch drag and reload blocked |
| `/account/events` | Implemented weekly planner, optional times, event/week presets, linked Gym | Source, board CAS, plans-only copy and preset retry tests; PostgreSQL/two-client UI blocked |
| `/account/gym` | Implemented builder/library/presets/plans/sessions/history | Source, preset/icon/reference/input/snapshot/action/queue tests; connected synthetic journey added |
| `/account/momentum` | Implemented mission/Journeys/Goals/focus/reviews/Recent Wins | Source, reducer/action/goal/period/focus/UI tests; real two-client persistence blocked |
| `/account/notifications` and header bell | Implemented persistent inbox, read/unread/archive/read-all, pagination | Source, schema/producer/action/UI tests; SQL lease/trigger/two-client convergence blocked |
| `/api/auth/[...all]` | Implemented guarded Better Auth endpoints | Hook tests and code review; no live activation/bypass probes |
| `/api/billing/webhook`, `/api/email/webhook` | Implemented signed durable processing | Actual installed SDK raw-signature verification executed locally; adapters/storage mocked; no provider delivery |
| `/api/account/jobs` | Implemented authenticated POST job entry | Secret rejection tests and code review; not invoked against configured database |
| `/api/public/account`, `/api/public/offer` | Implemented private/public readiness responses | Source and offer tests; landing read observed; no trial start |
| `/api/public/legal`, `/api/public/legal/document` | Implemented published document readiness/download | Source/legal tests; links inspected; no publication performed |
| `/robots.txt`, `/sitemap.xml` | Implemented public metadata | Source/build inventory; production crawl/cache behavior not measured |
| Not-found page | Implemented | Keyboard home-link browser check after repair |
| Support ticket creation/restricted admin review | **Absent** | No persisted request/admin route; Help contact is an honest mailto link |
| Manual web step totals/correction history | **Absent** | No step entity/input/source evaluator; no native collector added |
| Inbox snooze | **Absent** | Goal-reminder snooze is separate and does not implement inbox snooze |
| Manual new-purchase currency selector | **Absent in UI** | Server accepts validated allowlisted currency; account/landing currently choose automatically |
| Native, health, chatbot | Future scope | Not implemented or added |

## Relationships and data integrity

| Relationship | Actual implementation / important limit |
| --- | --- |
| Account → preferences/membership | Stable auth identity; owned product-scoped settings JSON with revision; membership holds explicit trial and authoritative provider paid-through dates. Finance defaults, units, locale/timezone and billing currency are independent. |
| Template → dated plan → actual session → Event | Stable IDs, copied exercise/load/target snapshots, separate actual sets/cardio; plan-linked session uniqueness; Events projects the plan/session once. Removed/edited templates do not rewrite logs. Date corrections use session flow. |
| Actual activity → Momentum → internal inbox | Gym/To-Do/manual Events feed canonical activity identities; goals and saved review versions evaluate actual records; source-generation hooks and fenced inbox reconciliation invalidate stale copies. Reading an inbox record does not finish a source. |
| Finance/investments → money goals | **Not automatically connected**. Money goals currently use named manual Momentum scopes/journal contributions, not Finance transactions or investment market value. Shared currency rules and manual calculations are tested; automatic recalculation after a Finance edit is not implemented. Landing examples now state manual Momentum sources. |
| Support → admin | No durable request/review path. Mailto must not be mistaken for submitted support. |
| Registration → mailbox proof → legal evidence | Reserved/consumed proof plus exact eligible published document versions/content hashes, server ownership/timestamps and transactional account association. Drafts cannot authorize activation/purchase; no acceptance was backfilled. |

Ownership checks derive identities from the session; finance/investment updates, settings revisions, Gym records, Momentum references, notifications, legal exports and billing associations have source/unit tests. These are distinct from a real PostgreSQL two-user isolation test, which was not executed. Product tombstones/provider-first deletion and late-webhook checks remain present; real account deletion was not performed.

## Reproduced findings and repairs

Status “Fixed and verified” below is limited to its stated test layer. “Fixed but verification blocked” means the failing regression is repaired but the database/provider execution needed for complete verification has not occurred.

### QA-01 — P1 — public error leakage

**Reproduced → Fixed and verified (local boundary tests).** A synthetic `PRIVATE_FIXTURE` provider/database error was returned verbatim by `actionResult` and the legacy `formatError`; raw errors could also reach logs. No real credential exposure was found.

Root cause: arbitrary `Error.message` and name-based Zod detection were treated as safe public messages. Added a shared explicit `PublicError` boundary and real Zod handling; unexpected errors return a generic retry message and a static diagnostic event. Reviewed intentional domain messages use `PublicError`; raw provider exceptions are not reclassified as public. Changed `lib/account/errors.ts`, `result.ts`, `lib/utils.ts` and intentional throws in identity, billing, email, password, privacy, legal, access and session modules. Useful validation/configuration errors and enforcement remain intact.

Regression: `tests/public-errors.test.mjs`; `[public-errors-before.log](qa-artifacts/public-errors-before.log)`, `[legacy-errors-before.log](qa-artifacts/legacy-errors-before.log)`. These demonstrate a fixture leak, not a production compromise. No rotation is claimed or currently required on the basis of that fixture alone.

### QA-02 — P1 — read operations created empty To-Do/Events records

**Reproduced → Fixed but verification blocked (PostgreSQL).** Empty To-Do reads and Sunday-start window reads issued inserts without a product-write guard. A read-only/expired user could thereby mutate storage.

Root cause: read initialization was conflated with a write. To-Do now returns a virtual empty board and creates the deterministic first row only through guarded compare-and-save. Concurrent first-save retries recover the winner or report a conflict. Sunday window reads similarly return virtual missing weeks; initialization runs after ownership/access/input/snapshot validation, followed by a fresh snapshot comparison. Historical records are not deleted. Files: `lib/actions/todo.actions.ts`, `calendar-window.actions.ts`.

Regression: empty-read/no-insert and first-save retry/concurrent-conflict cases in `tests/stabilization.test.mjs`. Database CAS/transaction/cache behavior is not certified by the adapter fixture.

### QA-03 — P1 — obsolete Events actions bypassed validated CAS writes

**Reproduced → Fixed but verification blocked (PostgreSQL/browser old tabs).** `updateEventsList` and `setDefaultWeekEvents` could perform raw unversioned board writes, overwrite newer work or admit invalid embedded training. Search found no active app/hook callers.

Retained compatibility exports, authenticated write guard and explicit reload/use-named-preset errors; they now fail closed without DML. Current `saveEventBoard`, Gym scheduling and named preset flows remain in place. File: `lib/actions/events.actions.ts`. Regression: obsolete-action case in `tests/stabilization.test.mjs`; existing planner/preset tests still pass. No event records were reinterpreted or removed.

### QA-04 — P1 — checkout readiness omitted GBP

**Reproduced → Fixed and verified (configuration unit tests); provider journey blocked.** Readiness could report configured checkout despite a missing GBP Price. Shared configuration has four currencies; the readiness list had only three.

`lib/account/billing/stripe.ts` now uses `billingCurrencies`; tests require every configured annual Price, including GBP. `tests/stabilization.test.mjs` and `tests/account-billing.test.mjs` cover the regression. No Stripe Price, tax, portal or live setting was changed.

### QA-05 — P2 — duplicate Sunday-window detection used row count

**Reproduced → Fixed but verification blocked (existing database rows).** Two rows for one ISO week and none for the other could equal the expected total count and pass the old check. It now compares distinct week keys against retrieved row count and refuses ambiguous duplicates. File: `calendar-window.actions.ts`; duplicate-window regression in `tests/stabilization.test.mjs`. No duplicate cleanup or new uniqueness constraint was applied.

### QA-06 — P1 — finance chart merged years and used database-local month

**Reproduced → Fixed but verification blocked (PostgreSQL).** October 2025 and October 2026 became one month bucket. Current-month filtering used `CURRENT_DATE`, unrelated to the account timezone.

`getChartIncomeOutcomeData` groups/labels/orders by `YYYY-MM` and binds the current account-local month. Owner and recorded-currency filters remain. File: `lib/actions/finance.actions.ts`; actual generated grouping expression and two-year fixture in `tests/stabilization.test.mjs`. Aggregate execution/query plans on PostgreSQL remain blocked.

### QA-07 — P2 — investment purchase dates used browser/server local day

**Reproduced → Fixed and verified (schema/date/action unit tests); live persistence blocked.** Warsaw's current local date could be rejected near UTC midnight, and New York's next local date could be accepted.

Added `investmentPositionSchemaForZone`; server derives the account timezone, editor uses the account calendar for schema/default/max. Existing purchase dates, quantities, USD rules and historical currencies remain unchanged. Files: `lib/investments.ts`, `lib/actions/investments.actions.ts`, `InvestmentEditor.tsx`. Warsaw/New York deterministic midnight regressions in `tests/stabilization.test.mjs`.

### QA-08 — P2 — hidden money tracking retained goal inbox candidates

**Reproduced → Fixed and verified (producer unit test); durable reconciliation blocked.** Money goal notifications still targeted a hidden money section after Momentum money tracking was disabled.

`lib/notifications/produce.ts` now excludes balance/savings/investment goals when that preference is off. Manual records/goals remain; re-enabling can evaluate them again. Regression in `tests/notifications.test.mjs` checks disable/retain/re-enable; failing evidence in `hidden-money-before.log`. SQL withdrawal of already published records is not claimed as tested.

### QA-09 — P2 — account export omitted persistent inbox

**Reproduced → Fixed but verification blocked (database/export browser).** Product-owned messages and read/archive state were absent from the private export.

`lib/actions/privacy.actions.ts` now selects a bounded field allowlist by session owner and product, includes `data.notifications`, and advances export schema to 3. Lease/dedup/provider secrets are not exported. Regression in `tests/audit-privacy-chart.test.mjs`; before/after logs in `qa-artifacts/privacy-chart-*.log`. The inbox table must exist before rollout; no migration was applied by this audit. Existing exports/data keys remain included.

### QA-10 — P2 — finance chart text alternative and invalid token composition

**Reproduced → Fixed and verified (rendered-component test/source); visual plot verification blocked.** The legacy Recharts chart had no table of monthly values and wrapped already complete `oklch(...)` CSS tokens inside `hsl(...)`.

Added a screen-reader table with year-month, currency, revenue and positive spending values; named legend series; uses `var(--foreground)`/`var(--border)` directly and explicit Finance back navigation. Final review reproduced a race in the new currency caption: two preference reads could label USD-filtered data as PLN. `getChartIncomeOutcomeSnapshot` now returns totals and their filter currency together from one preference read; the existing array-only API delegates to it. Before/after evidence is in `chart-snapshot-before.log` / `chart-snapshot-after.log`. Files: `lib/actions/finance.actions.ts`, `app/(main)/account/finance/chart/{chart,page}.tsx`; table and snapshot regressions in `tests/audit-privacy-chart.test.mjs`. No contrast/assistive-device certification claimed.

### QA-11 — P2/P3 — public keyboard navigation

**Reproduced → Fixed and verified (browser and lint).** Skip targets lacked programmatic focusability; activating the skip link left focus outside main. Added `tabIndex={-1}` to existing landing/Help main targets. Post-repair browser observation: `document.activeElement.id === 'main-content'`. FAQ and mobile menu operated with Enter. The not-found button used hard browser navigation and triggered baseline lint warning; replaced with an existing Button-as-Link, corrected copy, then operated “Go home” with Enter. Files: `app/(root)/{page,help/page}.tsx`, `app/not-found.tsx`.

### QA-12 — P2 — development QA commands lacked database isolation proof

**Code-supported risk → Fixed and verified (pre-client execution gate).** A disposable schema in arbitrary `DATABASE_URL` is not proof its host database is safe for QA writes. No unsafe database command was executed to reproduce harm.

Added `scripts/qa-database.mjs`, requiring explicit `QA_DATABASE_URL` and `QA_DATABASE_ISOLATED=true`, rejecting production runtimes, invalid protocols, and the same host/database as the app connection (credentials/schema query changes do not count). Applied before client construction in all three integration scripts; `.env.example` contains empty/off defaults. `tests/qa-database.test.mjs` covers the gate and credential-safe errors. All three actual commands exit 1 at this gate before constructing a client; this verifies the gate, **not the database integration**. Operator confirmation is still required; DNS aliases cannot be reliably established by this simple gate.

### QA-13 — P3 — examples/documentation implied unsupported money/email behavior

**Reproduced → Fixed and verified (source and landing browser).** Momentum money preview captions named Finance/Investments as automatic sources. They now say “Manual Momentum balance” / “Manual Momentum contributions.” Existing account delivery documentation was updated to reference the current internal-inbox contract instead of optional app reminder emails. No contractual legal document was rewritten. Files: `AppPreview.tsx`, `docs/account-membership.md`.

## Automated evidence and executed commands

Commands used the existing installed dependencies; logs are in [qa-artifacts](qa-artifacts/). Redirected logs are intentionally empty for successful quiet type/lint commands.

| Check | Baseline | Final |
| --- | --- | --- |
| `node --test tests/*.test.mjs` | Exit 0; 245 passed, 0 failed/skipped | Exit 0; **265 passed**, 0 failed/skipped (`final-tests.log`) |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Exit 0 | Exit 0 (`final-types.log`) |
| `node node_modules/eslint/bin/eslint.js .` | Exit 0; one existing not-found navigation warning | Exit 0; **no warnings/errors** (`final-lint.log`) |
| `node node_modules/next/dist/bin/next build` | Exit 0; Next 16.3.8 | Exit 0; 31 generated pages (`final-build.log`) |
| `git diff --check` | Not recorded separately before repair | Exit 0; ordinary LF/CRLF notices only |
| `node scripts/check-account-integration.mjs --isolated` | Not run | Exit 1; **Blocked at QA gate**, `account-db-blocked.log` |
| `node scripts/check-legal-integration.mjs --isolated` | Not run | Exit 1; **Blocked at QA gate**, `legal-db-blocked.log` |
| `node scripts/check-notification-integration.mjs` | Not run | Exit 1; **Blocked at QA gate**, `inbox-db-blocked.log` |
| `npm audit --json --ignore-scripts --cache .next/qa-npm-cache` | Not run | Exit 1; registry audit endpoint returned an error, no vulnerability inventory. **Not checked successfully**, not “zero vulnerabilities.” |

`tests/stabilization.test.mjs` initially failed all 10 added regressions before the repair (`regressions-before.log`). Focused batch logs record successful repairs. Public-error, hidden-money and export/chart cases have separate failure-before evidence. No failing test/security/validation check was deleted or disabled.

The added connected test `tests/connected-audit.test.mjs` executes real Gym action/domain code with an **in-memory Drizzle boundary**, not PostgreSQL: schedule retry → empty actual fields → two different strength sets and cycling → save/reload/retry → complete → one linked Event → one workout count → one completion candidate → reopen → count/candidate withdrawn with actual values preserved → date/repetition correction → finish → plans-only week copy. Clock is fixed. `connected-fixture.log` records success; post-commit durable inbox hooks are isolated, so no worker/transaction claim follows.

Existing executed suites cover precise money/CSV parsing, supported currencies/legacy unknown records, USD exclusion, goals, 75-minute focus fixtures, pause/period allocation, source deduplication, templates/presets/load conventions/blank targets, retry queues, filters/keyboard reducers, strict owned actions, raw SDK signatures, trial expiry and proof/legal validation. These are unit/component/action tests using boundary adapters, **not live-provider end-to-end tests**.

## Minimum connected journey status

| Journey | Explicit result |
| --- | --- |
| A Registration → legal/proof/login/settings/trial | **Blocked** for complete journey: unpublished documents/bot/mail configuration and isolated DB. Available proof/legal/password/preferences/trial unit tests passed. |
| B Connected workout | **Fixed and verified in synthetic action/domain fixture**; PostgreSQL/browser/worker persistence **Blocked**. |
| C Reopen/correct workout | **Fixed and verified in same synthetic fixture**; no append-only correction audit trail is claimed. Original plan and logged values are preserved, latest actual results are editable. |
| D Filtered task dragging → save/refresh | Underlying stable-ID ordering/queue/control tests passed; actual pointer/touch/browser refresh **Not checked**, isolated account required. |
| E Week preset retry/explicit reapply | Existing planner fixture tests passed, fresh plans/no copied sessions; PostgreSQL/browser **Blocked**. |
| F Finance edit/delete → automatic money goal | **Not implemented** automatic source link. Exact manual balance fixture passes: 5000−2500=2500, buffer1500; further1800 →700, deficit300 PLN. Finance currency/edit/delete tests pass separately. |
| G 40/100 USD contribution | Manual Momentum contribution fixture passes: 60 remaining, market value independent. Automatic investment-position linkage **Not implemented**; feed/provider **Not checked**. |
| H Focus and steps | 25+30+20=75/100 focus and pause/dedup tests pass. Manual step daily-total correction **Not implemented**. |
| I Two-client inbox | Producer/action/UI tests pass, no reminder-email/push transport invoked in ordinary tests; real durable read/archive/read-all convergence **Blocked**; inbox snooze **Not implemented**. |
| J Annual membership | Four-price/configuration/mock checkout/signature/reconciliation/access tests pass. Real sandbox checkout/Test Clock renewal/cancellation/failure/expiry **Blocked/Not checked**, no live transaction. Manual currency UI **Not implemented**. |
| K Help → support → restricted review | Public Help browser checks pass; persistent support/admin **Not implemented**. Contact access exists without membership. |
| L Two-user ownership/export/deletion | Existing owner-scoped synthetic tests and new export regression pass; real DB two-users, destructive deletion and late job integration **Blocked/Not checked**. No accounts deleted. |

## Browser, accessibility and performance evidence

Browser interaction used the installed computer-use skill and Codex in-app browser, not shell browser automation. Temporary viewport overrides were reset. No actual phone was used.

- Landing widths 360, 390, 768, 1024, 1440px at 900px height: no document horizontal overflow; artwork loaded. All five desktop scenes were manually selected and measured: image height ~759.82px, hero ~760.73px at the measured desktop viewport. Transitioning frames retained equal height. See [measurements](qa-artifacts/landing-measurements.json).
- Stationary hero copy, controllable scene navigation, loaded local WebP artwork, accurate Example-data labels, three FAQ items and Help link were observed. Manual Momentum source captions are visible after repair. Demo advances 2/3→3/3 once; completed action disables, reset returns 2/3. No actual sets are invented.
- At 390px Help “workout” search returns two answers; synthetic unknown term shows zero with a recovery action; Gym topic shows one. Policy readers show draft/not-approved status and `noindex, follow`, and do not overflow at that width.
- Keyboard Enter operated FAQ, mobile navigation, skip link after repair and 404 home. Actual touch dragging, dialog focus return/scroll locks, screen-reader behavior, contrast measurements, text zoom and light/dark private routes are **Not checked**. Reduced-motion handling has unit/source coverage; no controlled browser media override was available in this run.
- Final bounded development-tab log capture: 0 errors, 4 warnings, including one Fast Refresh reload warning. Three other development warnings were not classified; no clean-console guarantee. No production Lighthouse score, query timings, input-latency benchmark or timer/listener profiler was run.
- Source risk: Gym/history/Momentum source/export reads can load complete owned history; inbox itself is paginated. High-volume query plans/pagination/load behavior require isolated representative data. No measured speed improvement is claimed.
- Authenticated/private responses, trusted origin checks, metadata and crawler exclusions were read/tested where available; no CDN cache/production crawl probe was executed.

Screenshots actually produced: [landing 390](qa-artifacts/landing-390.png), [landing 1440](qa-artifacts/landing-1440.png), [Help 390](qa-artifacts/help-390.png), [not-found](qa-artifacts/not-found.png). Only public/synthetic content was captured. [Sanitized smoke observations](qa-artifacts/browser-smoke.json) are manual observations, not a browser replay trace; no trace was produced.

## Dependency advisories

No dependency changed. The registry audit failed, so this is a limited maintainer-source review, not a complete transitive vulnerability clearance.

- Installed Next 16.3.8 matches the patched 16.x version in the [September 2026 security release](https://nextjs.org/blog/september-2026-security-release). The installed version is above the 16.3.6 patch for the [next/og Node ImageResponse advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j). No exploit probe was run.
- Installed Better Auth, `@better-auth/core` and `@better-auth/drizzle-adapter` are 1.7.7, matching the patched version in the [magic-link/OAuth-state advisory](https://github.com/better-auth/better-auth/security/advisories/GHSA-965c-763c-88jm), [PostgreSQL Drizzle rate-limit advisory](https://github.com/better-auth/better-auth/security/advisories/GHSA-44jh-23m7-hpcf), and [OAuth proxy advisory](https://github.com/better-auth/better-auth/security/advisories/GHSA-r4xp-prcw-77qf). The magic-link/OAuth-proxy plugins are not enabled in the inspected configuration. This does not certify every plugin/adapter/dependency.
- Reviewed the official [RSC critical-vulnerability notice](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components) and [follow-up DoS/source-exposure notice](https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components). React/React DOM 19.3.0 are installed; standalone RSC packages were not found in the lock inventory. Framework-bundled RSC code must not be cleared solely from that absence.

## Configuration, data repair and rollout requirements

See [QA setup](qa-test-setup.md) and [read-only integrity SQL](qa-integrity-dry-run.sql). Neither the SQL nor a migration was executed in this audit.

1. Provision and explicitly confirm a disposable separate PostgreSQL database. Apply the app's reviewed schema there only after reconciling migration history. The previous account-delivery document records a journal/database discrepancy; that historical claim was not re-verified here. Do not replay old migrations blindly.
2. Run the three gated integration commands with two ordinary synthetic owners and appropriate product states, then authenticated browser journeys. Test empty/pre-upgrade databases, migration reruns, inbox trigger/lease races, cross-week atomic saves, exports/deletion/late jobs. If prior duplicate owner/week rows exist, halt before adding uniqueness.
3. Read-only integrity queries report counts, not private records. No authoritative duplicate winner can be selected from row counts alone. Any data repair needs a separate approved plan, exact impacted identities in restricted operator storage, provider backup/restore rehearsal, per-record review, transactional predicates and forward recovery. These changes do not require an automatic destructive backfill.
4. Publish exact reviewed legal versions only after operator/controller facts, consumer-rights/retention/delivery decisions and receiving support channel are resolved. Technical draft gates remain. No legal approval or acceptance evidence is invented.
5. Configure bot protection and protected authentication mail, signed provider webhooks, reviewed four Prices/tax/portal and a scheduler. Notification/support/goal/review flows remain internal: do not enable reminder email or push. Keep auth/security transport separate.
6. Choose deliberate membership enforcement/migration boundaries. `B1_WAY_ENFORCE_MEMBERSHIP=false` currently preserves legacy access during launch transition; it is a configuration decision, not a purchased entitlement. Do not force cutover to make a test pass.
7. After isolated DB checks, run sandbox provider journeys with explicit dedicated recipients/customers; never use real charges or unverified environments. Deletion/financial actions need their own applicable approval.

## Remaining priorities

**Unresolved / code-supported risks:** existing duplicate owner/week rows have not been inspected; high-volume unbounded private histories/exports have not been measured; production caching/ownership/migration and real provider flows remain unverified. Dependency scanner remains unavailable. Static and fixture evidence does not establish production integrity.

**Not implemented:** manual billing currency UI (and late geolocation override protection for that future choice), manual step totals, persistent support/admin review, inbox snooze, automatic Finance/Investments→money-goal linkage. These are distinct from the repaired defects and were not built as new modules during this stabilization pass. Recurring task templates/occurrence linkage and automatic parent-project completion are not asserted.

**Next blocking action:** configure/confirm a separate disposable QA database, then execute the prioritized integration/browser/provider checks in `qa-test-setup.md`. The repository repairs and all available final local checks are delivered; complete production/end-to-end verification remains blocked rather than marked passed.
