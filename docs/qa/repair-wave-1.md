# ManForth repair wave 1

Date: **7 October 2026 (Europe/Warsaw)**. **Wave completed: YES. Issues targeted: 9. All nine are FIXED in the local implementation and verified within the boundaries below.** No deployment or real database migration was performed. This is not a production-health certification.

WEB = `D:/WEBDEV/projects/ud/ud-1`; MOBILE = `D:/WEBDEV/projects/ud/ud-mobile`; ADMIN = `D:/WEBDEV/projects/ud/ud admin`. Paths below are relative to the named repository. These working trees already contained substantial unrelated changes; the complete Git diff is not this wave's change set.

## Baseline and preservation

The entire historical inspection was read before edits. `docs/qa/inspection-before-fixes.md` remains unchanged. Its SHA-256 before and after repair is:

`A828BD39027B3EF7A6FBADC054AB82E06CB424A174F568788ECC49A7C4667F2B`

Initial repository status was inspected: WEB `main`, HEAD `0a0148c00036bcf4270db25cf92fbbb6abf9828a`; MOBILE `master`, HEAD `7ccbc4d139d6760c5d47895a35a4c40fa98430ba`. Pre-existing staged, unstaged, untracked and deleted files were preserved. No reset, stash, checkout, commit, dependency upgrade, lockfile regeneration, provider configuration change, live send, charge or deployment was performed. The only package-script change in this wave is the explicit supported Webpack build command.

| Historical before-fixes check | Inspection result |
| --- | --- |
| WEB tests | 477/478 passed; TimingFields failed before assertions because `motion/react` was absent from the harness |
| WEB lint | Failed: `@next/next/no-assign-module-variable` in `tests/finance-view-transition.test.mjs` |
| WEB fresh route validation/build | Webpack compiled, then rejected the unsupported named `Finance` page export; subsequent nonincremental TypeScript also failed |
| Default Turbopack | Failed: child worker exited before connection while processing `app/globals.css`; underlying cause unverified |
| Finding register | P0 0, P1 4, P2 16, P3 4: 24 total |

Build/harness repairs were completed first. Before the money/auth/mobile repairs began, the restored baseline passed **481/481 WEB tests**, lint, a production Webpack build from clean generated route types, and a subsequent nonincremental typecheck. The final, larger suite below supersedes that intermediate baseline.

## Repair register and regression map

| Issue | Severity | Status | Primary regression evidence |
| --- | --- | --- | --- |
| MF-BUILD-001 | P1 | **FIXED** | Finance loader tests, fresh production build and post-build TypeScript |
| MF-BILL-001 | P1 | **FIXED** | Real reconciliation/access SQL with signed synthetic Stripe events in PGlite, both authority modes |
| MF-MOB-001 | P1 | **FIXED** | 20 mobile account lifecycle tests; web proof adapter tests |
| MF-DATA-001 | P1 | **FIXED** | Actual web actions through shared SQL CAS functions; conflict/draft UI tests |
| MF-QA-001 | P2 | **FIXED** | Timing assertions execute; full WEB suite and active ESLint rules pass |
| MF-DATA-002 | P2 | **FIXED** | Lost responses, concurrent same-operation writes, distinct creates and replay-after-delete tests |
| MF-SEC-001 | P2 | **FIXED** | Actual sensitive actions with installed Better Auth, SQL quotas and HTTP limiter checks |
| MF-SEC-002 | P2 | **FIXED** | Eight boundary/session tests and real two-tab synthetic browser fixture |
| MF-AUTH-002 | P2 | **FIXED** | 13 actual Better Auth/Drizzle/PGlite integration tests covering fault, retry, concurrency and migration behavior |

### MF-BUILD-001 and MF-QA-001: restore a trustworthy web gate

**Original evidence:** the route exported an internal `Finance` component that Next's generated page contract rejects. The TimingFields fixture omitted its production motion import, and a test variable named `module` violated the enabled Next lint rule. A pre-build typecheck against old generated files had hidden the route problem.

**Fix:** moved Finance's owned data loader into the non-route `Finance.tsx`; `page.tsx` retains supported route exports and renders the same feature. Read the installed Next 16.3.8 documentation before changing this boundary. Added the motion harness boundary so the existing clock/duration/overnight assertions execute. Renamed the lint-offending variable without disabling any rule, skipping any test, or weakening assertions.

**Changed files:** WEB `app/(main)/account/finance/page.tsx`, `app/(main)/account/finance/Finance.tsx`, `tests/finance-page.test.mjs`, `tests/time-picker.test.mjs`, `tests/finance-view-transition.test.mjs`, `package.json`.

Default Turbopack was retried outside the sandbox and still failed with the same child-worker connection error. The standard `npm run build` now explicitly runs `next build --webpack`, a supported production path that passed. No dependency versions were changed. No CSS defect is inferred from the worker error.

**Verification:** behavioral Finance loader tests, TimingFields assertions, full tests/lint, freshly regenerated route contracts during production build, and a nonincremental typecheck after that build. **Both issues FIXED.**

### MF-BILL-001: revoke entitlement consistently

**Original evidence:** normalized sources recorded full refund/dispute revocation while the supported legacy membership projection retained `paid_confirmed` through OR semantics and a future paid period. The real legacy resolver still returned paid write access in the inspection's synthetic reproduction.

**Fix:** reconciliation clears legacy paid entitlement and renewal grace for a revoked source, while preserving period history and provider identifiers. Known normalized revocation cannot seed renewal grace through historical confirmation or be undone by a later unpaid invoice. Re-read membership after acquiring the reconciliation lease so a stale pre-lease projection cannot re-grant access after another reconciliation revoked it. Both supported authority modes remain supported; no billing-source flag was flipped.

The existing full-refund/dispute rule remains in force. A partial refund whose provider charge is not fully refunded does not revoke access. A separate active Apple-style source continues to grant access when Stripe is revoked. No purchasing implementation or commercial policy changed.

**Changed files:** WEB `lib/account/billing/reconcile.ts`, `tests/stripe-webhook-sync.test.mjs`.

**Tests:** already-paid annual membership to full refund and dispute in each authority mode; grace removal; retained provider/history fields; duplicate event receipt; older distinct paid notification reconciled against current provider state; later unpaid renewal; partial refund; revoked Stripe plus active Apple fixture; rejection of older normalized observations; and stale pre-lease membership reads. Uses real PGlite SQL, production access/reconciliation, the installed Stripe signature machinery and mocked provider responses. Existing `tests/account-billing.test.mjs` remains passing. **FIXED.**

### MF-DATA-001 and MF-DATA-002: one money concurrency contract

**Original evidence:** web edits checked ownership but not the expected revision; web creates assigned a fresh server ID on every call. A stale form could overwrite newer money values, and a lost-response retry could create a second record. Mobile already had stronger atomic SQL revision/receipt functions.

**Fix:** reachable web Finance and Investment writers now reuse `writeMobileFinance` / `writeMobileInvestment` and their existing SQL CAS/receipt functions. Each read returns owned records and revision from one SQL snapshot. Old unversioned action entry points fail closed with reload guidance instead of silently performing last-write-wins writes.

Each intended create has a stable client record ID and operation ID. The shared hook captures immutable values, revision and IDs. An ambiguous response retains that exact envelope for retry. A receipt replay reads current server records rather than restoring the historical receipt's UI state, preventing a deleted/archived item from reappearing locally.

Conflicts keep the user's draft, display current saved values and require an explicit choice to discard or save the reviewed draft against the latest revision using a new operation. There is no silent money merge. Missing/deleted edits and archived Investment edits cannot be retried as active records. Quick Finance entry and category dialogs have corresponding recovery controls; resolving a category change preserves an unrelated quick-entry draft.

Finance record currency is immutable on edit, including null/legacy values; no conversion is introduced. New investments remain USD-only; historical currencies remain untouched. Existing Finance cache invalidation and Investment route invalidation are reused.

**Changed implementation files:** WEB `lib/actions/finance.actions.ts`, `lib/actions/investments.actions.ts`, `lib/money/types.ts`, `lib/money/snapshots.ts`, `lib/money/action-result.ts`, `hooks/use-money-mutation.ts`, `app/components/shared/MoneyRecovery.tsx`; Finance `Finance.tsx`, `FinanceClient.tsx`, `FinanceEditor.tsx`, `FinancePlayground.tsx`; Investments `page.tsx`, `InvestmentsClient.tsx`, `InvestmentEditor.tsx` under `app/(main)/account/`.

**Tests added/updated:** `tests/web-money-sql.test.mjs` (22 action-to-PGlite scenarios plus two parent tests: 24 counted results), `tests/money-mutation.test.mjs`, `tests/actions.test.mjs`, `tests/finance-inline-actions.test.mjs`, `tests/finance-page.test.mjs`, `tests/investments.test.mjs`, `tests/stabilization.test.mjs`, and narrow import/fixture changes in `tests/helpers.mjs`.

Coverage includes commit followed by a lost response for each domain; duplicate concurrent requests; distinct identical-looking creates; web/mobile stale writes; owner isolation; delete/replay without resurrection; archive/edit conflicts; immutable retry payloads; explicit conflict review; category recovery; historical currency preservation and account-timezone validation. **Both issues FIXED.**

**Recovery boundary:** the pending command is held in the mounted web page, not persisted across reloads. The uncertain-outcome UI explicitly tells the user to keep that page open until reconciled. Confirmed identity loss intentionally destroys private drafts. PGlite exercises SQL transactions and concurrent submissions through its connection; it does not prove independent multi-connection PostgreSQL lock contention. Money UI verification used the component harness, not a full production browser journey.

### MF-MOB-001: retain a proof across mailbox backgrounding

**Original evidence:** backgrounding moves the session to checking; the account controller interpreted the temporarily absent owner as logout and discarded the pending proof. Returning to the same account could no longer confirm the code.

**Fix:** retain only the proof capability, owner, session ID and expiry in private memory during temporary hiding. On foreground, require secure same-owner/same-session bootstrap and a successful server proof-status check before exposing the proof again. Checking, offline and transient-error states keep it hidden. No raw verification code is stored in a feature journal, SQLite or SecureStore.

Clear the capability on genuine logout (including failed logout completion), owner/session change, expiry, server invalidation, confirmed completion, cancellation or deletion. Process termination loses the in-memory capability; the existing reauthenticated begin flow can reclaim/rotate a still-active proof. Session validation was not weakened. Bootstrap adds an optional non-secret session ID for compatibility; production supplies it and proof resumption requires it.

If confirmation committed but its response was lost, an exact owner/purpose/capability match to a committed identity receipt returns a completed status. Foreground reconciliation then clears the proof and refreshes canonical account state without resending or repeating confirmation. A consumed timestamp alone does not count as a committed mutation.

**Changed MOBILE files:** `src/services/live-account-controller.ts`, `src/domain/live-account-command.ts`, `src/services/mobile-contract.ts`, `tests/live-account.test.mjs`.

**Changed WEB compatibility files:** `lib/mobile/account.ts`, `lib/mobile/account-contract.ts`, `lib/mobile/http.ts`, `lib/mobile/service.ts`, `tests/mobile-account.test.mjs`.

**Tests:** begin/background/same-session foreground/confirm, changed owner/session, background expiry, logout, offline and failed status checks, invalidation, process restart policy, lost confirm response and read-only completed reconciliation. Focused mobile lifecycle **20/20**, full mobile **148/148**, web adapter tests included in the full web gate. **FIXED in controller/service behavior; native mailbox handoff remains UNVERIFIED.**

### MF-AUTH-002: durable, bound identity completion

**Original evidence:** recovery claims and email proofs could be consumed before Better Auth completed the identity mutation. Failure between those steps stranded valid flows; retry could not distinguish an uncommitted operation from a lost successful response.

**Fix:** additive `b1_identity_completions` receipts distinguish pending from committed work. A separate autocommitted reservation binds the proof to its owner, purpose, mailbox and HMAC of the intended input. Inside one transaction, the service locks the receipt, validates the owner/mailbox, consumes the proof, executes Better Auth's mutation through the same Drizzle transaction and commits the receipt. Failure rolls back consumption and mutation while retaining the bound reservation for the original retry.

Committed retries acknowledge the bound result without repeating the identity mutation. Changed owner, purpose or input cannot repurpose the proof. Pending expired proofs cannot complete. Passwords, raw reset tokens and OTP codes are not stored in receipts. A separate completion quota bounds fingerprint comparisons, including committed acknowledgements. Owner deletion removes receipts through a database trigger.

The retained Better Auth adapter is routed through AsyncLocalStorage to the request's outer transaction, including nested adapter transactions/savepoints. Non-signup mutations lock and recheck the canonical owner row through mutation to prevent mailbox reassignment races. Signup verifies that the intended user, verified mailbox and credential actually exist before committing; Better Auth's synthetic duplicate-mailbox success is insufficient. Password-policy rejection happens before the first reservation so a corrected password can complete the same valid proof. Committed acknowledgement does not reapply a changed password policy.

**Changed files:** WEB `lib/account/identity-completion.ts`, `lib/account/signup.ts`, `lib/db/auth-drizzle.ts`, `lib/db/schema.ts`, `lib/db/0036_identity_completions.sql`, `lib/actions/identity.actions.ts`; compatible mobile acknowledgement described above.

**Tests:** new `tests/identity-completion.test.mjs`; narrow fixture updates in `tests/legal.test.mjs`, `tests/email-requests.test.mjs`, `tests/helpers.mjs` and `tests/mobile-account.test.mjs`. Uses actual installed Better Auth, hashing and Drizzle with production actions/transaction routing over synthetic PGlite records. Faults cover reservation-before-mutation, hashing/identity mutation, receipt commit after mutation, lost response, duplicate/concurrent completion, mailbox reassignment, weak-first/corrected input, expiry, owner/purpose/input substitution, synthetic signup success and deletion cleanup. Mail delivery, legal publication and trial initialization are fixture boundaries. **FIXED, with 0036 required before deployment.**

### MF-SEC-001: quota direct password checks

**Original evidence:** direct `auth.api.signInEmail` / `changePassword` calls bypass Better Auth's HTTP router limiter. The inspection reproduced five unbounded direct wrong-password calls while the corresponding HTTP route throttled.

**Fix:** a shared application quota backed by existing `b1_rate_buckets` allows five direct password attempts per account per 15-minute window. The owner key is protected; switching action purpose does not multiply guesses. Success also consumes an attempt; the fixed window expires. This policy covers email-change reauthentication, password change, account-deletion reauthentication and signup's direct session-creation call. It returns a customer-safe retry message and does not replace or remove the HTTP limiter.

**Changed files:** WEB `lib/account/password-attempts.ts`, `lib/actions/identity.actions.ts`, `lib/actions/privacy.actions.ts`, plus the auth integration/fixture files above.

**Tests:** actual sensitive actions share one atomic owner budget; repeated wrong passwords stop before further password verification; another owner remains usable; expiry reopens the budget; concurrent attempts stay bounded; successful password flows remain available. Actual Better Auth HTTP responses still progress from 401 to 429. These are part of the 13 new integration cases and final full suite. **FIXED.**

### MF-SEC-002: shared private web identity boundary

**Original evidence:** inbox ownership handling cleared only inbox state. A mounted private page could remain visible after a confirmed logout, expiry or account change even though future server requests were rejected.

**Fix:** the server-owned main application layout wraps the complete private provider/header/sidebar/page tree in one shared boundary using the existing Better Auth session atom. It explicitly handles checking, same owner, unauthenticated, different owner and expiry. Temporary uncertainty hides the React Activity tree and pauses effects while preserving draft state. Confirmed identity loss latches the boundary closed and unmounts the entire private tree; late former-owner responses cannot reopen it. Continuing uses a document navigation to discard the old router cache and create a fresh owned tree. Existing server-side read/write ownership checks remain enforced.

The existing session client periodically revalidates and handles reconnect/focus signals. Because installed Better Auth does not broadcast sign-in to other tabs, successful auth operations emit a payload-free `revalidate` signal using BroadcastChannel with a storage fallback. Receiving tabs re-fetch the authoritative session; the signal never asserts an identity. Blocked browser messaging is handled without turning a successful auth operation into an error. Session reads do not emit a signal, preventing a broadcast loop.

**Changed files:** WEB `app/(main)/layout.tsx`, `app/components/shared/account/PrivateIdentityBoundary.tsx`, `lib/account/private-identity.ts`, `lib/account/session-signal.ts`, `lib/auth-client.ts`, `tests/private-identity.test.mjs`, `tests/fixtures/private-identity-browser.tsx`, `scripts/check-private-identity-browser.mjs`.

**Tests:** eight automated cases cover temporary-error draft preservation, confirmed logout, expiry, owner switch, late response latching, server denial, auth signals, cleanup and blocked messaging. A real browser with two tabs also exercised the actual React boundary and installed Better Auth client against a loopback synthetic HTTP fixture: temporary 503 hid Finance/draft accessibility and restored the exact draft after recovery; logout removed the private input from DOM; sign-in as B hid A in both tabs; releasing a held A response did not restore A; expiry removed private content.

**Browser boundary:** this was a synthetic Finance child and synthetic session endpoints, not a full deployed Finance/auth-cookie journey. Temporary bundles and browser tabs were removed; the loopback servers were stopped. **FIXED within the verified boundary.**

## Database changes and deployment prerequisites

**New migration:** WEB `lib/db/0036_identity_completions.sql` adds a receipt table, owner index and owner-deletion trigger. It does not rewrite application records or migrate provider state. It is required before deploying the changed identity/mobile completion code.

The SQL itself requires the existing `"user"` table with `id`. The feature additionally requires current Better Auth `user`, `account`, `session`, `verification` tables and 0021's `b1_email_attempts`, `b1_recovery_claims`, `b1_rate_buckets`, plus the ordinary account schema used by existing flows. Application roles need their normal transaction/table privileges. No generic migration journal or runner was changed.

**Offline 0036 checks:** the tests loaded the actual initial auth migration in disposable PGlite, added current user fields and minimal matching proof/quota fixture tables, and applied 0036. Empty application and repeat application over populated fixtures passed. Receipt contents were compared exactly; existing user/account counts were preserved; deleting an owner removed that owner's receipts. This does not establish complete historical upgrade compatibility or actual deployed schema state.

After independently verifying the intended database, prerequisites, backup and applied history, an operator can apply the single reviewed migration with the following command. **This command was not executed:**

```powershell
psql "service=reviewed-target" --set=ON_ERROR_STOP=1 --single-transaction --file=lib/db/0036_identity_completions.sql
```

**Existing money prerequisites:** web now requires 0031 Finance and 0033 Investments even when mobile API exposure is disabled. Both existing migrations are reused unchanged by this wave. They require the canonical tables/columns below, their revisions/operation tables, save/revision functions and triggers. They are not safe to blindly replay merely because some `CREATE TABLE` statements use `IF NOT EXISTS`; trigger creation and the wider historical chain need an applied-state check.

| Existing migration/schema | Required by this repair |
| --- | --- |
| 0000 authentication schema | `"user"(id)`; save functions lock the owner row |
| 0006 Finance | Canonical `finance_table` records, ownership, date, amount, categories, comment, type and created timestamp |
| 0016 categories + 0017 visibility | Canonical `finance_categories`, normalized name, hidden flag and unique `(user_id,type,normalized_name)` for upsert |
| 0018 Investments | Canonical position fields, record/owner keys, archive flag and manual price/timestamp |
| 0021 account/membership | Record currency columns, settings/timezone/preferences, normal server write-authorization schema |
| 0031 Finance protocol | `b1_mobile_finance_versions`, `b1_mobile_finance_operations`, `b1_mobile_save_finance`, revision function and triggers on both Finance tables |
| 0033 Investment protocol | `b1_mobile_investment_versions`, `b1_mobile_investment_operations`, `b1_mobile_save_investment`, revision function and canonical position trigger |

No additional extension or money migration was introduced. The action-to-PGlite tests exercise the existing save functions and their triggers. No real database was connected or changed. **MF-DB-001 remains open:** the fragmented historical manifest and deployed applied hashes were not repaired or inferred. Do not replay the historical SQL chain blindly.

## Actual executed final verification

Command output was shown in the terminal. No manually captured test/build/audit logs were saved in WEB or MOBILE. Framework-managed caches are separate. Temporary browser/export artifacts were created outside `D:/WEBDEV/projects/ud` and removed.

### WEB

| Final command/check | Result |
| --- | --- |
| `node --test --test-reporter=dot --test-concurrency=4 tests/*.test.mjs` | **PASS: 537/537**, exit 0, all pass markers; no skip/todo tests introduced |
| `npm run lint` | **PASS**, exit 0, zero errors/warnings |
| Remove only the verified `.next/types` path, then credential-isolated `npm run build` | **PASS**, Next 16.3.8 Webpack, compiled in 21.5s; framework TypeScript passed; 37/37 generated static pages; build traces completed, exit 0 |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` after that build | **PASS**, exit 0, against freshly generated route validation |
| `git diff --check` | **PASS**, exit 0; Git emitted existing LF/CRLF conversion notices, no whitespace errors |
| Historical inspection SHA-256 comparison | **PASS**, unchanged |

For the production build only, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `REVENUECAT_SECRET_KEY` were blanked and `NEXT_TELEMETRY_DISABLED=1` was set in the process. Environment files were not edited. These builds certify local compilation, not deployed credentials/configuration or provider availability.

An additional diff diagnostic with Git's line-ending conversion disabled flagged existing CRLF endings as whitespace. The normal repository-configured check passed; no line-ending rewrite or persistent Git configuration change was made.

Focused commands also passed before the final full gate:

```powershell
node --test tests/web-money-sql.test.mjs tests/money-mutation.test.mjs tests/actions.test.mjs tests/finance-inline-actions.test.mjs tests/finance-page.test.mjs tests/investments.test.mjs tests/stabilization.test.mjs tests/finance-playground.test.mjs tests/finance-currencies.test.mjs tests/stock-picker.test.mjs tests/mobile-finance-sql.test.mjs tests/mobile-investments-sql.test.mjs
# 104/104

node --test tests/identity-completion.test.mjs tests/legal.test.mjs tests/static-legal.test.mjs
# 33/33, including 13 identity/quota/migration integration tests

node --test tests/private-identity.test.mjs tests/stripe-webhook-sync.test.mjs
# 18/18
```

`node scripts/check-private-identity-browser.mjs` provided the temporary loopback fixture for the browser sequence described above. The browser verification is additional evidence, not counted as Node test cases.

**Remaining build diagnostic:** a direct default `next build` Turbopack attempt still failed at child-worker startup outside the sandbox. The cause remains unverified; the application's standard `npm run build` now selects the passing supported Webpack path. No dependency workaround was introduced.

### MOBILE

All commands ran from MOBILE; the final export used synthetic `.invalid` origins and purchases disabled.

| Final command/check | Result |
| --- | --- |
| `node --test --test-reporter=dot tests/*.test.mjs` | **PASS: 148/148**, exit 0 |
| `node --test --test-reporter=spec tests/live-account.test.mjs` | **PASS: 20/20**, exit 0 |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | **PASS**, exit 0 |
| `node node_modules/expo/bin/cli lint --no-cache` with offline/no-telemetry/no-dotenv flags | **PASS**, exit 0 |
| `node node_modules/expo/bin/cli export --platform all --output-dir <verified OS temporary directory> --max-workers 2` | **PASS**, exit 0: 45 static routes, iOS 7.1 MB, Android 7.3 MB, web 3.2 MB + 1.1 MB |
| `node scripts/check-build-configuration.mjs --strict` | **FAIL / external configuration blocked**, exit 1, `configurationReady:false` |
| `node scripts/check-release-readiness.mjs --strict` | **FAIL / external configuration blocked**, exit 1, `configurationReady:false` |
| Native device/emulator, signed/EAS build, native mailbox handoff, store/provider verification | **UNVERIFIED / NOT RUN** |

Lint/export/config processes used `EXPO_OFFLINE=1`, `EXPO_NO_TELEMETRY=1`, `EXPO_NO_DOTENV=1`. Export additionally used `EXPO_PUBLIC_API_ORIGIN=https://inspection.invalid`, `EXPO_PUBLIC_WEB_ORIGIN=https://inspection.invalid`, `EXPO_PUBLIC_STORE_PURCHASES_ENABLED=false`. The strict checks kept purchasing disabled but did not substitute synthetic origins as approved release configuration.

Strict configuration remains blocked; no configuration files changed. This wave's isolated checks require an approved plain HTTPS API origin; matching approved HTTPS website origin (build check); owner-approved existing iOS bundle identifier; Android package identifier; approved existing EAS project. These values were not invented or changed. The historical checks loaded local QA settings, while this wave disabled dotenv loading, so their exact blocker sets differ.

All repair export directories were removed and checked absent. Final export directory was `C:/Users/romas/AppData/Local/Temp/manforth-proof-repair-9a90ed18d7ed4b21a8e6c8d0d1802089`. JavaScript export is not native runtime acceptance.

### ADMIN, database and providers

ADMIN application checks were **NOT RUN in this wave**: no ADMIN files changed, and inspection of its imports found no dependency on the changed web auth/actions/schema modules. The additive receipt table is unused there. The historical admin results remain historical.

Database migration/schema tests and affected SQL integrations **PASS in disposable PGlite**. Live Neon/PostgreSQL multi-connection contention, actual migration history, backup/restore and deployed privileges remain **UNVERIFIED**. Providers were fixture/mock transports only. No live Stripe, Apple, Google, RevenueCat or mail requests were issued.

## Additional defects uncovered within the authorized repairs

The following necessary edge cases were fixed and regression-tested within the nine existing findings; they are not inflated into additional open issue IDs:

1. Historical normalized payment confirmation could seed grace after revocation; a stale pre-lease legacy projection could revive entitlement. Both now preserve revocation.
2. Installed Better Auth sign-in did not broadcast cross-tab invalidation. A payload-free signal now triggers authoritative session revalidation; real two-tab verification passed.
3. Reserving before rejecting a weak password could bind an otherwise valid proof to unusable input. Validation now precedes a first reservation.
4. Distinct pending identity proofs could race with reassignment of the owner's former mailbox. Canonical owner locking and revalidation now protect mutation.
5. Better Auth can return synthetic signup success for an existing mailbox. The persisted intended identity/credential must now exist inside the transaction before receipt commit.
6. A lost mobile confirmation response could leave only a consumed proof on return. Read-only committed-receipt reconciliation now resolves completion without repeating the mutation.

No additional confirmed out-of-scope defect was added. No next-wave implementation was started.

## Remaining register and release readiness

**Remaining P0 0, P1 0, P2 11, P3 4: 15 open inspection findings.** There are no remaining P1 IDs in the authorized inspection register. This count describes source repairs, not deployed remediation.

| Severity | Remaining IDs |
| --- | --- |
| P2 | MF-BILL-002, MF-ADMIN-001, MF-ADMIN-002, MF-EMAIL-001, MF-PERF-001, MF-PERF-002, MF-PERF-003, MF-UX-001, MF-DEP-001, MF-MOM-001, MF-DB-001 |
| P3 | MF-A11Y-001, MF-UX-002, MF-DEP-002, MF-DOC-001 |

Internal offline QA is **READY WITH CONDITIONS**: the web regression/build gate is green and scoped money/auth/browser/mobile evidence is available. Any real environment must first establish its required schema and safe configuration.

**BETA: NOT READY. PRODUCTION: NOT READY.** Remaining queue/email/Weekly Review/dependency/performance and other inspection findings are unresolved; actual migration prerequisites and historical applied state are unverified; native release configuration is blocked; native-device, deployed cookie/session, provider lifecycle, worker scheduling and backup/restore acceptance have not been demonstrated. The default Turbopack environment failure remains recorded separately from the passing standard build.

Membership prices/trial duration, money currency meaning, Gym/Momentum semantics, notification architecture, legal policy text, provider/native-purchase configuration and ADMIN architecture were not changed by this wave. Stop here for review before any next repair wave.
