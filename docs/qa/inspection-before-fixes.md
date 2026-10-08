# ManForth Full Application Inspection

Inspection date: **7 October 2026 (Europe/Warsaw)**. This is the **before-fixes** report. Application source, dependencies, configuration, existing documentation, database records and provider state were not repaired or changed. Only this report is intentionally added.

Evidence labels: **PASS** = the stated check passed, within its stated boundary; **FAIL** = an executed check failed; **WARNING** = a demonstrated concern or limitation; **BLOCKED** = an attempted check could not complete because of the environment; **NOT RUN** = deliberately not executed; **NOT IMPLEMENTED** = absent from the inspected implementation; **UNVERIFIED** = insufficient evidence. A passing defect reproduction confirms the defect, not correct application behavior. Source inspection, mocked-provider/in-memory tests, and native-device verification are distinguished throughout. Severity is application impact, not an automatic translation of dependency CVSS.

Paths without a repository prefix are relative to **WEB**, D:/WEBDEV/projects/ud/ud-1. **MOBILE** means D:/WEBDEV/projects/ud/ud-mobile. **ADMIN** means D:/WEBDEV/projects/ud/ud admin. Line references describe the working tree inspected, including existing uncommitted changes; HEAD alone cannot reproduce this snapshot.

## 1. Executive summary

ManForth is a substantial implemented product across a Next.js web application, an Expo/React Native client, and a local operator application. It has real owned persistence, verified registration, trial and provider-backed membership, six principal productivity/recording modules, an internal inbox, and account security/export/deletion flows. Native purchase/restore and admin campaigns exist in source; they must not be described as merely planned.

The strongest engineering foundations are server-derived ownership, explicit separation of planned workouts from actual results, fixed record currencies, decimal validation, revision/idempotency mechanisms in many domains, signed webhook receipts, and extensive offline tests. These protections are uneven: the web money writers lag behind their mobile counterparts, a legacy entitlement path misses payment revocation, and several retry/lifecycle boundaries can strand work.

The working tree is **not ready for beta or production**. The web production build has a concrete invalid page export; one web test and lint also fail. Mobile backgrounding discards account email proofs. Additional confirmed findings concern weekly review dates, money-write retries/concurrency, queue exhaustion and email retention. No P0 or demonstrated server-side cross-user data leak was established; that is not a security certification.

**24 findings: P0 0, P1 4, P2 16, P3 4.** The complete issue register appears in sections 5–8. Highest priority: restore the build baseline; correct access revocation and lost-update behavior; make auth/mobile flows resumable; reconcile migration/deployment evidence before real-user testing.

## 2. Scope inspected

| Surface | Repository/revision and state | Scope |
| --- | --- | --- |
| WEB | Branch main; HEAD 0a0148c00036bcf4270db25cf92fbbb6abf9828a; **120 pre-existing changed/untracked paths** | App routes/components, hooks, server actions, auth/access, provider adapters, database schema/SQL migrations, scripts, tests, lockfile, relevant docs |
| MOBILE | Branch master; HEAD 7ccbc4d139d6760c5d47895a35a4c40fa98430ba; extensive existing staged, unstaged and untracked work | Expo config, routes, controllers, transports, SecureStore/session lifecycle, account/membership/core modules, tests and release checks |
| ADMIN | Existing sibling application; no .git directory/independent Git revision in this folder | Express/Vite source, local authorization boundary, analytics, campaigns, outbox/suppression, migrations and tests |
| Other siblings | better-auth, drizzle, catalogue/equipment and catalogue/exercise observed | Not treated as independent deployed ManForth applications; bundled catalogue consumption was inspected, not a full audit of these separate trees |

All three applications use npm package-lock.json. No dependency installation, lockfile regeneration, migration command or deployment was performed. WEB Node/npm were v22.16.0 / 10.9.2. Installed WEB Next 16.3.8, React/React DOM 19.3.0 and Better Auth/@better-auth/expo 1.7.7 were inspected. The installed Next building/environment guides were read; this report does not assume older Next conventions.

Environment inspection was limited to code, file names, and **SET/EMPTY/ABSENT** classification. Secret values, connection strings, customer records and provider credentials are deliberately omitted. WEB has .env and .env.mobile-qa.local; the latter contains an isolation marker but no QA_DATABASE_URL. Presence of local credentials is not evidence that they work, are sandbox credentials, or match production.

Production-build processes explicitly blanked DATABASE_URL, STRIPE_SECRET_KEY, RESEND_API_KEY and REVENUECAT_SECRET_KEY and disabled Next telemetry, without editing any env file. These are credential-isolated compilation checks, not deployed configuration certification. In-memory PGlite reproductions used synthetic records and mocked provider transport; no application/QA database was connected.

Source changes were preserved. No reset, checkout, stash, dependency update, migration, provider-setting change, message send or charge was performed. Framework-managed .next/type caches were generated by verification. Command output was sent to the terminal; manually generated verification logs were not added to either repository.

## 3. Current baseline

### WEB checks actually executed

| Check / exact command | Result | Evidence / interpretation |
| --- | --- | --- |
| node --test --test-reporter=spec tests/*.test.mjs | **FAIL** | 478 tests: **477 pass, 1 fail**, 0 skipped/cancelled; 45.06 seconds. tests/time-picker.test.mjs:50 fails with missing mock for motion/react from TimingFields.tsx. No product timing assertion runs in that failing case. |
| node node_modules/eslint/bin/eslint.js . | **FAIL** | 1 error, 0 warnings: tests/finance-view-transition.test.mjs:16, @next/next/no-assign-module-variable. |
| node node_modules/typescript/bin/tsc --noEmit --incremental false, before build | **PASS** | Exit 0 against pre-existing generated route types. This result is superseded by the post-build type failure below. |
| node node_modules/next/dist/bin/next build | **FAIL** | Turbopack fails processing app/globals.css: child Node process exits before the worker connection. Reproduced outside the sandbox. Root cause of that worker failure is **UNVERIFIED**; it is not proof of invalid CSS. |
| node node_modules/next/dist/bin/next build --webpack | **FAIL** | Outside-sandbox diagnostic alternative compiled successfully in 56 seconds, then generated route validation rejected named export Finance from app/(main)/account/finance/page.tsx:19. |
| node node_modules/typescript/bin/tsc --noEmit --incremental false, after build | **FAIL** | Exit 1, same invalid Finance export via .next/types/app/(main)/account/finance/page.ts. Fresh framework type generation exposes the defect. |
| npm audit --package-lock-only --ignore-scripts --json --fetch-timeout=10000 --fetch-retries=0 | **FAIL (advisories found)** | Initial sandbox attempt: **BLOCKED**, npm DNS ENOTFOUND. Outside-sandbox retry completed: 6 high package entries, 0 critical, from 2 underlying advisories. See MF-DEP-001. No packages changed. |
| npm ls braces source-map-js --all | **PASS** | Establishes the installed dependency paths for both advisories. |
| Additional offline probes | **PASS (defects reproduced)** | Legacy refund access; final-attempt provider lease; rejected-email payload retention; direct Better Auth API rate-limit bypass; duplicate investment creates; Sunday review normalization. Each issue records the exact boundary. |
| Remote API/DB integration scripts | **NOT RUN** | Existing scripts create fixtures/temporary schemas or perform mutations; contrary to this request's no-database-changes boundary. QA connection and actual migration history remain **UNVERIFIED**. |
| Public/private browser journeys, endpoint benchmarks | **NOT RUN / UNVERIFIED** | No successfully built current web runtime. Existing screenshots, prior reports and prior deployments are not current-run evidence. |

Some exploratory proof fixtures failed setup before corrected probes ran: one omitted the 0030 provider-event environment column; another lacked memory-adapter arrays. Those setup failures are not application defects. A suspected Events Sunday-week bug was explicitly discarded after discovering the component uses a preference-aware helper.

### MOBILE and ADMIN checks

The final mobile/admin results are recorded in sections 14–15 and summarized here: mobile offline unit tests, nonincremental TypeScript and official Expo lint passed; admin TypeScript, all 22 tests and a temporary-directory Vite production bundle passed. Native build/device/store verification remains separate from JavaScript export. No admin lint script is defined.

The initial admin test run passed 20/22 with two loopback TCP EACCES failures. A permitted outside-sandbox rerun passed **22/22**, including host/origin/CSRF and unsubscribe checks. These are environment failures resolved by the rerun, not two product bugs.

## 4. Architecture overview

### Runtime and authoritative state

WEB uses the Next App Router with Cache Components, server-rendered route shells and interactive client modules. proxy.ts protects /account navigation; lib/session.ts independently verifies identity for data operations before cache/database access. Account settings, domain records and product memberships live in PostgreSQL. Drizzle uses the Neon HTTP adapter for ordinary queries and a transactional WebSocket adapter for Better Auth. lib/db/http-sql.ts defers initialization and redacts malformed connection errors.

Better Auth owns identity/credentials/session records. Custom email proof services control registration, recovery and email-change entry points. Verified account creation initializes the 14-day trial. Product access is decided server-side in lib/account/access.ts, using either normalized billing sources or the supported legacy membership projection. Stripe and RevenueCat are external evidence providers; UI success screens do not authorize access.

MOBILE is a separate Expo Router/React Native client using the versioned /api/mobile/v1/[resource] adapter in WEB. It uses the same server identity and owned records, with mobile command receipts and revision-aware readers/writers. Native purchase/restore is implemented through RevenueCat. ADMIN is a separate Express/Vite operator application intentionally bound to localhost, with host/origin/CSRF protections instead of an internet-facing admin login.

### Actual WEB route/feature inventory

| Routes | Implemented behavior / source |
| --- | --- |
| / | ManForth by B1-Way landing, responsive artwork carousel, synthetic interactive examples, annual/trial explanations and CTAs; app/(root)/page.tsx, app/components/landing |
| /help | Public searchable/topic-based Q&A and email contact; lib/help/content.ts, app/components/help |
| /features/workout-planner, /features/weekly-planner, /features/goal-tracker | Public explanations with limits and examples; lib/seo/features.ts |
| /terms, /privacy, /terms/[version], /privacy/[version] | Current static policy readers and current content-derived version lookup; historical versions are not retained by current store |
| /auth/registration | Details, password/birth date/current agreement, email code, verified account creation and automatic trial |
| /auth/login, /auth/forgot-password, /auth/reset-password | Sign-in, protected recovery and reset |
| /account | Account & Settings: profile/preferences/security/notifications/membership/privacy and export/deletion |
| /account/to-do | Task creation/editing, completion/reopen, drag/reorder, filtering, retry and conflict handling |
| /account/events | Weekly calendar, optional/date-only timing, presets/week presets, completion and linked Gym occurrence projection |
| /account/gym | Exercise catalogue, own templates, plans, sessions, actual sets/cardio, history and units/load conventions |
| /account/finance, /account/finance/chart | Income/expense records, categories, per-currency summaries, board/history, CSV, monthly charts |
| /account/investments | USD position tracking, manual valuations, crypto/stock catalogue, quote lookup and archive/undo |
| /account/momentum | Goals, Journeys, focus logs/timer, manual money journal, Recent Wins and Weekly Review |
| /account/notifications | Inbox history, All/Unread, pagination, read/archive/mark-all and typed destinations |
| /robots.txt, /sitemap.xml, /opengraph-image, missing routes | Public search metadata/image and custom 404 |

### API and service inventory

| Endpoint / service | Purpose and boundary |
| --- | --- |
| /api/auth/[...all] | Better Auth HTTP handler; sensitive alternative flows constrained by internal identity context |
| /api/public/signup | JSON registration proof/account-creation transport with origin/content validation |
| /api/public/account | Private/no-store landing CTA projection, session owner only |
| /api/public/offer | Regional allowlisted annual currency and configuration availability |
| /api/public/legal, /api/public/legal/document | Current public policy references/download without private account data |
| /api/mobile/v1/[resource] | Gated mobile auth/session, account, membership and domain resource adapter; see sections 11 and 14 |
| /api/billing/webhook | Raw-body Stripe signature verification and durable event receipt |
| /api/billing/native-webhook | RevenueCat authentication/environment/identity validation and durable receipt |
| /api/email/webhook | Resend/Svix verification and bounce/complaint suppression |
| /api/account/jobs | Bearer-secret protected **POST** worker entry point: deletion, Stripe, optional-notification compatibility, mail, legal-cleanup compatibility and native reconciliation |
| lib/actions/*.actions.ts | Account, identity, privacy, billing, finance, investments, To-Do, Events/calendar/planner, Gym, Momentum and notifications |
| scripts/notifications.ts | Explicit operator inbox announcement/reconciliation tooling; not executed |
| Migration/setup/QA scripts | Schema/price/fixture/operator tools; inspected as operational code, not run against services |

An endpoint is not evidence of a deployed schedule. No current scheduler execution, webhook delivery, queue drain, database region or Vercel/Neon region alignment was verified.

## 5. P0 issues

**No P0 confirmed.** No production exploitation, actual cross-user leak or real financial loss was demonstrated. Conditional billing/data risks remain serious and are classified below.

Issue index:
| ID | Severity | Finding |
| --- | --- | --- |
| MF-BUILD-001 | P1 | Finance page exports a symbol Next.js does not allow |
| MF-BILL-001 | P1 | Full refunds/disputes retain access in supported legacy billing mode |
| MF-MOB-001 | P1 | Opening the email app destroys the pending account verification proof |
| MF-SEC-001 | P2 | Direct Better Auth calls bypass the HTTP password-attempt limiter |
| MF-SEC-002 | P2 | Resolved logout/expiry does not clear already-mounted private page content |
| MF-BILL-002 | P2 | Final-attempt worker interruption strands provider events |
| MF-ADMIN-001 | P2 | Final-attempt interruption permanently strands an admin delivery |
| MF-ADMIN-002 | P2 | Delivery checks repeatedly inspect only the newest twenty sent messages |
| MF-EMAIL-001 | P2 | Rejected mail retains encrypted payload after expiry |
| MF-AUTH-002 | P2 | A transient failure can consume a proof before identity change succeeds |
| MF-PERF-001 | P2 | External quote lookup blocks the initial investment page |
| MF-UX-001 | P2 | Failed status requests silently look like signup and available purchase |
| MF-QA-001 | P2 | Current tests and lint have unresolved failures |
| MF-DEP-001 | P2 | Two current advisories affect installed lint/build dependencies |
| MF-A11Y-001 | P3 | Account reduced-motion preference does not reach the sidebar |
| MF-UX-002 | P3 | Small-screen navigation hides all visible labels and omits current-page semantics |
| MF-DEP-002 | P3 | Unused deprecated/overlapping package entries obscure the active stack |
| MF-DATA-001 | P1 | Stale web financial forms silently overwrite newer edits |
| MF-DATA-002 | P2 | Retry after a lost response can duplicate money records |
| MF-MOM-001 | P2 | Sunday-start reviews save under the previous Monday and appear missing in Sunday view |
| MF-DB-001 | P2 | Standard migration history does not provision the current application |
| MF-PERF-002 | P2 | Foreground polling repeatedly loads and reconciles complete account history |
| MF-PERF-003 | P2 | Committed Finance schema lacks an owner-leading index |
| MF-DOC-001 | P3 | Current-looking documentation and Weekly Review copy describe retired behavior |

## 6. P1 issues

### MF-BUILD-001 — Finance page exports a symbol Next.js does not allow

**ID:** MF-BUILD-001  
**Severity:** P1  
**Category:** BUG / CONFIGURATION  
**Area:** WEB production build  
**Title:** Finance page exports a symbol Next.js does not allow

**Evidence:** app/(main)/account/finance/page.tsx:19; freshly generated .next/types/app/(main)/account/finance/page.ts:14; executed webpack build and post-build tsc.

**Observed:** The route exports both default Page and a named Finance component. Compilation succeeds, but Next's page-module contract rejects Finance with TS2344. Initial standalone tsc passed against older generated types.

**Expected:** A production build must complete using the installed framework's allowed page exports.

**Impact:** The inspected working tree cannot produce a verified deployable web build.

**Reproduction:** Executed credential-isolated next build --webpack: compiled in 56 seconds, then failed route validation. A subsequent nonincremental tsc reproduced the failure. Default Turbopack separately failed at worker startup.

**Likely root cause:** An internal component was exported from a framework route module; ordinary source checking did not regenerate the route contract.

**Suggested repair:** Keep route exports within the installed Next contract and expose testable internals through an appropriate non-route boundary.

**Regression test needed:** Yes: a complete production build with freshly generated route types; retain Finance behavior coverage without unsupported exports.

**Confidence:** High.

### MF-BILL-001 — Full refunds/disputes retain access in supported legacy billing mode

**ID:** MF-BILL-001  
**Severity:** P1  
**Category:** BUG / DATA INTEGRITY  
**Area:** Stripe access authorization  
**Title:** Full refunds/disputes retain access in supported legacy billing mode

**Evidence:** lib/account/billing/reconcile.ts:20–24,54–75; lib/account/access.ts:22–27; lib/account/billing/sources.ts:5; tests/account-billing.test.mjs:77–79.

**Observed:** Refund/dispute revocation is recorded in normalized sources, but the legacy membership update preserves paid_confirmed through OR semantics and retains the future paid period. With B1_BILLING_SOURCES_ENABLED disabled, that projection still authorizes access.

**Expected:** Provider revocation must affect the actual authoritative access reader in every supported configuration.

**Impact:** A refunded/disputed annual membership can retain write access until its original expiry. Deployed flag values and actual affected users are UNVERIFIED.

**Reproduction:** PASS defect reproduction: real reconciliation SQL in in-memory PGlite, synthetic previously paid future membership, mocked fully refunded Stripe charge; real evaluateAccess returned paid/canWrite true.

**Likely root cause:** Revocation was added to the opt-in source model without equivalent legacy revocation semantics.

**Suggested repair:** Unify revocation semantics across supported readers, or explicitly retire the legacy access path after a verified migration.

**Regression test needed:** Yes: refund/dispute of an already confirmed period with source mode enabled and disabled, including grace and duplicate events.

**Confidence:** High.

### MF-MOB-001 — Opening the email app destroys the pending account verification proof

**ID:** MF-MOB-001  
**Severity:** P1  
**Category:** BUG / UX  
**Area:** MOBILE account email verification/change  
**Title:** Opening the email app destroys the pending account verification proof

**Evidence:** MOBILE src/providers/live-provider.tsx:40; src/services/session-controller.ts:36–45; src/services/live-account-controller.ts:10–12,35–37; src/features/account/live-account.tsx:23–26; tests/live-account.test.mjs:10.

**Observed:** AppState becoming inactive suspends the session into checking. The account controller sees no owner and clears its proof. Restoring the same owner does not restore the proof, and confirm returns false. The code input is shown only when hasProof is true.

**Expected:** After secure same-owner session revalidation, a still-valid email proof should be recoverable across the normal mailbox handoff.

**Impact:** Account verification/email-change on the same phone loses progress when the user reads the code, forcing a resend/restart and potentially hitting quotas. Native-device execution is UNVERIFIED.

**Reproduction:** Existing automated controller sequence begins proof, suspends, restores the same owner and observes confirmation false. Static AppState/UI wiring connects that behavior to backgrounding. This is specifically the authenticated account proof flow, not a claim that all signup flows fail.

**Likely root cause:** Temporary hiding of an account is treated like confirmed logout/account switching for proof lifecycle.

**Suggested repair:** Separate privacy hiding from proof lifecycle; recover short-lived same-owner proof after revalidation while clearing it on genuine logout, switch or expiry.

**Regression test needed:** Yes: begin → mailbox background → same-owner foreground → confirm; also different-owner restore, expiry, offline return and genuine logout.

**Confidence:** High for controller behavior; native-device manifestation UNVERIFIED.

### MF-DATA-001 — Stale web financial forms silently overwrite newer edits

**ID:** MF-DATA-001  
**Severity:** P1  
**Category:** DATA INTEGRITY  
**Area:** WEB Finance/Investments cross-platform writes  
**Title:** Stale web financial forms silently overwrite newer edits

**Evidence:** lib/actions/finance.actions.ts:55–71,224–246; lib/actions/investments.actions.ts:21–43,49–53; FinanceClient.tsx:206–208; InvestmentsClient.tsx:122–127; contrast lib/db/0031_mobile_finance.sql and 0033_mobile_investments.sql.

**Observed:** Owner predicates exist, but web updates have no expected revision/previous-state comparison. A full stale draft overwrites intervening amount/date/category/comment or quantity/price changes. Client locks protect only one mounted editor.

**Expected:** Reject stale edits, preserve the user's draft and reconcile against the latest owned record.

**Impact:** A stale browser can silently undo another browser/native device's financial corrections. Ownership prevents IDOR but not this loss of newer data.

**Reproduction:** Source-derived two-editor sequence: B saves a corrected amount/quantity; A changes only comment/name and submits its old full form. The predicates permit A to overwrite B. Live/end-to-end concurrency execution was NOT RUN.

**Likely root cause:** Web writers bypass the revision/receipt protocol added for mobile.

**Suggested repair:** Use one concurrency-aware domain write contract across platforms, preserving ownership and record currency rules.

**Regression test needed:** Yes: web versus web/native stale saves, archive/edit/delete conflicts and preservation of rejected drafts.

**Confidence:** High for write predicates.

## 7. P2 issues

### MF-SEC-001 — Direct Better Auth calls bypass the HTTP password-attempt limiter

**ID:** MF-SEC-001  
**Severity:** P2  
**Category:** SECURITY  
**Area:** WEB sensitive password actions  
**Title:** Direct Better Auth calls bypass the HTTP password-attempt limiter

**Evidence:** lib/actions/identity.actions.ts:28,36,103–104; lib/actions/privacy.actions.ts:29–30; lib/auth.ts:47; installed node_modules/better-auth/dist/api/index.mjs:165–173 and api/to-auth-endpoints.mjs:34–52.

**Observed:** Web actions invoke auth.api.signInEmail/changePassword without an application attempt quota. The installed Better Auth rate limiter is in the HTTP router, outside this direct API dispatch.

**Expected:** All exposed current-password checks should have equivalent server-enforced owner/source limits.

**Impact:** An attacker holding an authenticated session can repeatedly guess the current password; repeated hashing also consumes resources. This is not an anonymous login bypass.

**Reproduction:** PASS installed-library in-memory probe: five direct wrong-password calls all returned UNAUTHORIZED; equivalent HTTP-handler requests returned 401,401,401,429,429. No real account or network was used.

**Likely root cause:** The configured HTTP limiter is assumed to cover direct server API calls.

**Suggested repair:** Apply shared bounded reauthentication quotas before sensitive password checks.

**Regression test needed:** Yes: actual Server Actions, repeated sessions for one owner, quota expiry, successful verification and recovery behavior.

**Confidence:** High.

### MF-SEC-002 — Resolved logout/expiry does not clear already-mounted private page content

**ID:** MF-SEC-002  
**Severity:** P2  
**Category:** SECURITY / UX  
**Area:** WEB returning-user/session lifecycle  
**Title:** Resolved logout/expiry does not clear already-mounted private page content

**Evidence:** app/components/notifications/InboxProvider.tsx:73–77; app/components/shared/layouts/log-button.tsx:12–30; app/(main)/layout.tsx:21–27; app/(main)/account/layout.tsx:9–13; lib/session.ts.

**Observed:** InboxProvider discards its own inbox cache on owner changes, but its unauthenticated branch still renders children. Header session changes update the header; no shared watcher clears or redirects the already-mounted private page tree. Server-side guards run on requests, not continuously in an open tab.

**Expected:** Once the client has confirmed logout or a different owner, private content/drafts from the former session should be hidden or reinitialized.

**Impact:** An open Finance/Gym/settings page can remain visible after another tab signs out or a session expires. This is a local stale-display/privacy risk, not evidence that a new unauthorized server read succeeds.

**Reproduction:** Source-derived scenario: keep a private page open in tab A, sign out in tab B, then resolve the session state in A. A two-browser runtime reproduction was NOT RUN; no current web build was available.

**Likely root cause:** Session invalidation protects the inbox and future requests but not the global mounted private UI.

**Suggested repair:** Introduce a shared private-content identity boundary with explicit checking/expired/account-change behavior.

**Regression test needed:** Yes: cross-tab logout, expiry, account switch, slow old-owner responses and retained drafts; verify server access remains denied.

**Confidence:** Medium; control-flow evidence strong, browser manifestation UNVERIFIED.

### MF-BILL-002 — Final-attempt worker interruption strands provider events

**ID:** MF-BILL-002  
**Severity:** P2  
**Category:** BUG / DATA INTEGRITY  
**Area:** Stripe/RevenueCat webhook workers  
**Title:** Final-attempt worker interruption strands provider events

**Evidence:** lib/account/billing/reconcile.ts:88–104; lib/account/billing/native.ts:37–45.

**Observed:** Claims increment attempts before processing; future claims require attempts<8. A crash at attempt eight leaves pending/retry work excluded forever after its lease expires.

**Expected:** Expired exhausted leases must become recoverable work or an explicit terminal failure.

**Impact:** Renewal, refund or revocation can remain unapplied without another reconciliation trigger; a durable webhook receipt alone does not guarantee completion.

**Reproduction:** PASS defect reproduction using real queue SQL in in-memory PGlite with 0021+0030: an expired pending attempt-eight event produced processed:0 and remained pending/8.

**Likely root cause:** Terminalization occurs only in the worker catch branch, which process death skips.

**Suggested repair:** Handle expired exhausted leases explicitly and expose safe operator recovery.

**Regression test needed:** Yes: interruption between final claim and completion for both providers, replay and eventual entitlement convergence.

**Confidence:** High.

### MF-ADMIN-001 — Final-attempt interruption permanently strands an admin delivery

**ID:** MF-ADMIN-001  
**Severity:** P2  
**Category:** BUG / DATA INTEGRITY  
**Area:** ADMIN campaign delivery worker  
**Title:** Final-attempt interruption permanently strands an admin delivery

**Evidence:** ADMIN server/worker.ts:10–12,58–68.

**Observed:** The same lease-exhaustion gap occurs at six attempts in the admin outbox. A crash after claiming the sixth attempt leaves retry/6 excluded from later workers; campaign state can remain sending.

**Expected:** Ambiguous expired final leases should enter a visible needs-review/recovery state.

**Impact:** Campaign delivery can be neither completed nor surfaced correctly; blindly retrying later also risks a duplicate send.

**Reproduction:** PASS in-memory PGlite probe: synthetic retry/6 row with expired lease; processDeliveries returned zero, called no provider and left the row unchanged.

**Likely root cause:** Retry exhaustion is handled after dispatch, without a lease-recovery sweep.

**Suggested repair:** Recover or terminalize exhausted leases while preserving provider idempotency and ambiguous-outcome handling.

**Regression test needed:** Yes: final-claim process death before send, after provider acceptance, and before receipt persistence.

**Confidence:** High.

### MF-ADMIN-002 — Delivery checks repeatedly inspect only the newest twenty sent messages

**ID:** MF-ADMIN-002  
**Severity:** P2  
**Category:** BUG / DATA INTEGRITY  
**Area:** ADMIN delivery reconciliation/suppression  
**Title:** Delivery checks repeatedly inspect only the newest twenty sent messages

**Evidence:** ADMIN server/worker.ts:74–82; server/app.ts:111; README.md:26.

**Observed:** syncSentStatus selects the newest twenty sent rows without a cursor or fair last-checked ordering. Repeated Check delivery requests use the same selection. Signed webhooks are optional.

**Expected:** Polling-only delivery reconciliation should eventually inspect every eligible message or support an explicit per-message check.

**Impact:** Older late bounces/complaints can be missed indefinitely, leaving delivery statistics and shared suppression stale. Webhook-enabled deployments may mitigate this; actual delivery is UNVERIFIED.

**Reproduction:** PASS synthetic in-memory 21-delivery probe with mocked provider: two refreshes made forty calls to twenty unique IDs; the oldest was never checked.

**Likely root cause:** Fixed LIMIT 20 has no progression/check timestamp.

**Suggested repair:** Use bounded fair reconciliation and preserve accurate optional-webhook behavior.

**Regression test needed:** Yes: more than twenty messages, an older late complaint/bounce, repeated refresh and subsequent suppression eligibility.

**Confidence:** High.

### MF-EMAIL-001 — Rejected mail retains encrypted payload after expiry

**ID:** MF-EMAIL-001  
**Severity:** P2  
**Category:** BUG / DATA INTEGRITY  
**Area:** WEB authentication/security mail retention  
**Title:** Rejected mail retains encrypted payload after expiry

**Evidence:** lib/account/email/delivery.ts:39,57–64; lib/legal/public-content.ts:90–92.

**Observed:** Permanent provider rejection sets rejected but retains payload. Expiry cleanup considers only pending/retry, so rejected content is never cleared by that worker.

**Expected:** Terminal-state payload retention should match the stated lifecycle and remove content no longer needed for delivery/recovery.

**Impact:** Encrypted recipients, message bodies and expired proof/recovery content remain unnecessarily in the database. No plaintext disclosure or reusable expired-token exploit was established.

**Reproduction:** PASS real SQL/in-memory PGlite probe with mocked Resend validation_error: after expiration and another worker run the row was rejected with unchanged payload length.

**Likely root cause:** Rejection omits clearing, while the cleanup predicate excludes rejected rows.

**Suggested repair:** Define and implement consistent terminal-state retention, including existing rejected records in a separately reviewed repair.

**Regression test needed:** Yes: each terminal state, expiry, transient/ambiguous sends and stable retry content.

**Confidence:** High.

### MF-AUTH-002 — A transient failure can consume a proof before identity change succeeds

**ID:** MF-AUTH-002  
**Severity:** P2  
**Category:** BUG / UX  
**Area:** WEB recovery/email change  
**Title:** A transient failure can consume a proof before identity change succeeds

**Evidence:** lib/actions/identity.actions.ts:64–72,85–100; lib/account/email/challenges.ts:103–107; compare signup recovery at identity.actions.ts:54–60.

**Observed:** Recovery marks the claim used before resetPassword. Email completion consumes its challenge before later token-generation/verification work. Neither has the signup flow's resume behavior.

**Expected:** Retries should safely distinguish an uncommitted mutation from a completed operation with a lost response.

**Impact:** Valid links/codes can become unusable after a transient failure, requiring new sends and potentially exhausting quotas; the displayed outcome may be ambiguous.

**Reproduction:** Static control-flow proof; fault injection was NOT RUN. Safe test: fail immediately after claim/consume, then retry the same proof.

**Likely root cause:** Single-use proof and identity mutation are separate, non-resumable stages.

**Suggested repair:** Add durable completion/recovery semantics without making proofs reusable for a different mutation.

**Regression test needed:** Yes: failures before mutation, lost response after success, simultaneous completions and repeated requests.

**Confidence:** High for failure path; incidence UNVERIFIED.

### MF-PERF-001 — External quote lookup blocks the initial investment page

**ID:** MF-PERF-001  
**Severity:** P2  
**Category:** PERFORMANCE / UX  
**Area:** WEB Investments loading and save  
**Title:** External quote lookup blocks the initial investment page

**Evidence:** app/(main)/account/investments/page.tsx:14–18; lib/investment-market.ts:15–16,23–26,37–67; lib/actions/investments.actions.ts:34–36.

**Observed:** The page awaits investmentMarket before rendering saved positions. It always attempts the crypto catalogue, even for an empty/manual-only portfolio, then processes stock quotes in serial batches of five with ten-second per-request timeouts. Crypto saves also await catalogue refresh before using the bundled fallback.

**Expected:** Owned saved records and manual entry should remain promptly usable when market providers are slow or unavailable.

**Impact:** Quote outages can hold the entire page behind a loader and delay saves. Portfolio size increases the serial-batch latency exposure. No provider benchmark or production latency was measured.

**Reproduction:** Source inspection shows the awaited critical path and timeout/batch bounds. No external quote requests were made; numerical latency here is a configured timeout, not a benchmark.

**Likely root cause:** Optional market enrichment is coupled to initial record rendering and save validation; cache is process-local.

**Suggested repair:** Separate durable records/entry from bounded optional quote refresh, and define an overall request budget.

**Regression test needed:** Yes: unresolved/rejected quote promises still permit viewing records and appropriate manual operations; large symbol sets are bounded.

**Confidence:** High for coupling; production magnitude UNVERIFIED.

### MF-UX-001 — Failed status requests silently look like signup and available purchase

**ID:** MF-UX-001  
**Severity:** P2  
**Category:** BUG / UX  
**Area:** Landing membership/account state  
**Title:** Failed status requests silently look like signup and available purchase

**Evidence:** app/components/landing/LandingProvider.tsx:12,16–21; app/components/landing/AnnualMembership.tsx:11,48–53; app/api/public/account/route.ts.

**Observed:** Both fetch failures are swallowed. Defaults remain signup/EUR and empty availability; availability[currency] !== false treats unknown as available. A 503 account projection does not surface its unavailable state.

**Expected:** Unknown account/offer status should remain visibly unknown with useful navigation/retry rather than imply a confirmed purchase state.

**Impact:** Returning paid users can see Start your trial/Get annual membership during an outage, and purchase availability can be overstated. Server checkout still validates access and configuration; no client-side access grant occurs.

**Reproduction:** Source-based offline scenario: reject /api/public/account and /api/public/offer, then inspect default context and AnnualMembership's available expression. Browser fault injection NOT RUN.

**Likely root cause:** A two-state/default UI omits loading/error/unknown states.

**Suggested repair:** Preserve explicit unknown/error state and make CTA/currency copy match the evidence available.

**Regression test needed:** Yes: slow requests, non-OK responses, account success with offer failure and vice versa; recorded subscriber currency remains authoritative.

**Confidence:** High.

### MF-QA-001 — Current tests and lint have unresolved failures

**ID:** MF-QA-001  
**Severity:** P2  
**Category:** TECH DEBT  
**Area:** WEB regression baseline  
**Title:** Current tests and lint have unresolved failures

**Evidence:** tests/time-picker.test.mjs:50–59; tests/helpers.mjs:73; app/(main)/account/events/TimingFields.tsx:3; tests/finance-view-transition.test.mjs:16.

**Observed:** TimingFields imports motion/react, absent from its fixture mocks, so one test stops before assertions. A test variable named module violates the active Next ESLint rule.

**Expected:** The existing test/lint gate should run cleanly and exercise the advertised timing behavior.

**Impact:** A red baseline obscures new regressions and leaves the timing assertion unexecuted. This alone is not proof that the production time picker is broken.

**Reproduction:** Executed full suite: 477/478 pass; lint: one error, zero warnings.

**Likely root cause:** Production imports/test harness drift and a test source rule violation.

**Suggested repair:** Repair the fixture and test naming in the separate fix pass, then verify requirements through the actual behavior.

**Regression test needed:** Yes: existing tests must execute their assertions; no new test that merely mirrors the mock is needed.

**Confidence:** High.

### MF-DEP-001 — Two current advisories affect installed lint/build dependencies

**ID:** MF-DEP-001  
**Severity:** P2  
**Category:** SECURITY / TECH DEBT  
**Area:** WEB dependency tooling  
**Title:** Two current advisories affect installed lint/build dependencies

**Evidence:** Completed npm audit and npm ls; braces 3.0.3 via eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch; source-map-js 1.2.1 via @tailwindcss/postcss/@tailwindcss/node/postcss; package-lock.json.

**Observed:** npm reports six high package entries representing two underlying denial-of-service advisories, not six independent vulnerabilities. See the primary advisory links below.

**Expected:** The dependency risk inventory should be current, with a reviewed remediation or explicit exposure assessment.

**Impact:** Malicious brace patterns or indexed source maps can exhaust tooling resources. No application route passing attacker-controlled patterns/maps to these packages was identified; remote customer-facing exploitability is UNVERIFIED.

**Reproduction:** Read-only registry audit completed outside the sandbox after DNS failure inside it. No exploit payload was run.

**Likely root cause:** Affected transitive versions remain locked. npm's suggested eslint-config-next 14.2.35 change is not a validated compatible repair for Next 16.3.8.

**Suggested repair:** Review supported upstream fixes and actual input exposure; do not blindly apply audit fix or downgrade the framework configuration.

**Regression test needed:** Yes: rescan the resolved tree and rerun affected build/lint checks after a separately authorized dependency change.

**Confidence:** High for installed advisory matches; production reachability unestablished.

### MF-DATA-002 — Retry after a lost response can duplicate money records

**ID:** MF-DATA-002  
**Severity:** P2  
**Category:** DATA INTEGRITY / BUG  
**Area:** WEB Finance/Investments creation  
**Title:** Retry after a lost response can duplicate money records

**Evidence:** lib/actions/finance.actions.ts:69,76; lib/actions/investments.actions.ts:43,47; FinanceClient.tsx:206–208; InvestmentsClient.tsx:122–127; tests/investments.test.mjs.

**Observed:** Every create invocation generates a fresh server UUID; web drafts retry with null ID and no durable operation receipt. A local submission lock does not identify an already committed request.

**Expected:** Retrying one intended create should return the original record and ID.

**Impact:** Duplicate income/expense/holdings overstate totals and require manual correction. This is duplicate tracking data, not evidence of a duplicate provider charge.

**Reproduction:** PASS offline actual-action probe: two identical saveInvestmentPosition(null,draft) calls produced two rows with distinct IDs. This proves non-idempotency; the lost-network-response scenario was not exercised against a real server. Finance follows the same structure.

**Likely root cause:** UI tap suppression is used without a server-side creation identity.

**Suggested repair:** Provide stable creation IDs and atomic receipts, matching the mobile command semantics.

**Regression test needed:** Yes: commit followed by lost response, retry returns same record, repeated taps, and no resurrection after deletion.

**Confidence:** High.

### MF-MOM-001 — Sunday-start reviews save under the previous Monday and appear missing in Sunday view

**ID:** MF-MOM-001  
**Severity:** P2  
**Category:** BUG / DATA INTEGRITY / UX  
**Area:** Momentum Weekly Review  
**Title:** Sunday-start reviews save under the previous Monday and appear missing in Sunday view

**Evidence:** app/(main)/account/momentum/WeeklyReview.tsx:26–28,37–42; lib/momentum/reducer.ts:95–99; lib/calendar.ts:4; MomentumClient.tsx:77.

**Observed:** UI computes a Sunday key using account preferences; reducer renormalizes it using default-Monday weekStart. UI lookup cannot find the stored reflection, and another new review ID conflicts with the hidden record. Summary receives the changed period too.

**Expected:** Display, command, stored key, summary and edit lookup must use the same defined week convention.

**Impact:** Saved reflections appear missing, reporting periods disagree, and saving again can dead-end.

**Reproduction:** PASS offline actual reducer/validation probe: submitted 2026-10-04, stored 2026-09-28; Sunday lookup failed and a fresh-ID retry threw Choose the existing review for this week.

**Likely root cause:** The UI became preference-aware while the reducer retained Monday normalization.

**Suggested repair:** Define an explicit canonical week contract and separately plan compatibility for existing saved reviews.

**Regression test needed:** Yes: save/refresh/edit/summary round-trip for Monday/Sunday, year boundaries and preference changes.

**Confidence:** High.

### MF-DB-001 — Standard migration history does not provision the current application

**ID:** MF-DB-001  
**Severity:** P2  
**Category:** CONFIGURATION / TECH DEBT  
**Area:** Database deployment/migration history  
**Title:** Standard migration history does not provision the current application

**Evidence:** lib/db/meta/_journal.json and snapshots end at 0021; drizzle.config.ts; scripts/mobile-original-migrations.mjs:4–5; docs/account-membership.md:19; docs/momentum.md:7; runtime references to migrations through 0035.

**Observed:** Current runtime relies on later handwritten tables/functions installed by several feature-specific runners. A separate seven-file hashed mobile ledger exists. Older docs record a 20-versus-21 applied-history discrepancy and warn against generic replay.

**Expected:** One authoritative reviewed installation/upgrade manifest with prerequisites, applied hashes and preservation checks.

**Impact:** Fresh or upgraded deployments can miss required tables/functions despite successful compilation. Blind replay against populated databases risks conflicts or historical destructive statements. No real database corruption was observed.

**Reproduction:** Static journal/SQL/runtime comparison only. No migration was run; actual provider history remains UNVERIFIED.

**Likely root cause:** Feature-specific migration runners accumulated over an already divergent history.

**Suggested repair:** Reconcile actual histories first; define a reproducible manifest and rehearse fresh/populated upgrades without inventing applied records.

**Regression test needed:** Yes: clean provisioning plus supported populated upgrades, including preservation and interrupted/partial migration handling.

**Confidence:** High repository mismatch; deployed state UNVERIFIED.

### MF-PERF-002 — Foreground polling repeatedly loads and reconciles complete account history

**ID:** MF-PERF-002  
**Severity:** P2  
**Category:** PERFORMANCE  
**Area:** WEB Gym/Momentum/inbox synchronization  
**Title:** Foreground polling repeatedly loads and reconciles complete account history

**Evidence:** lib/actions/gym.actions.ts:60–69; lib/actions/momentum.actions.ts:28–30,42–53; lib/momentum/goals/reconcile.ts:8–20; hooks/use-gym-sync.ts:40; hooks/use-momentum.ts:34; lib/notifications/store.ts:85–100.

**Observed:** Gym polls full records every fifteen seconds; Momentum polls every thirty seconds, reads all Event weeks and domain history and reconciles goals. Inbox reconciliation also loads full source history and rejects more than 5,000 generated candidates.

**Expected:** Current views and refresh work should be bounded, with incremental or paged history where appropriate.

**Impact:** Read volume, DTOs, computation and rendering grow with account age and active tabs. The 5,000-candidate guard is a concrete failure path; its reachability with ordinary histories and practical scale thresholds were not measured.

**Reproduction:** Static call-graph/query/timer inspection. No synthetic load or production latency claim.

**Likely root cause:** Whole-account snapshots serve as the primary synchronization mechanism.

**Suggested repair:** Instrument representative aged accounts, then bound synchronization/reconciliation while preserving canonical source correctness.

**Regression test needed:** Yes: representative history sizes, bounded reads/payloads, incremental corrections and no duplicate progress/notifications.

**Confidence:** High architecture evidence; degradation threshold UNVERIFIED.

### MF-PERF-003 — Committed Finance schema lacks an owner-leading index

**ID:** MF-PERF-003  
**Severity:** P2  
**Category:** PERFORMANCE / CONFIGURATION  
**Area:** Finance database queries  
**Title:** Committed Finance schema lacks an owner-leading index

**Evidence:** lib/db/schema.ts:118–133; SQL migrations; lib/actions/finance.actions.ts:190–207,262 onward; lib/mobile/finance.ts:14–37.

**Observed:** The table has a primary key and owner foreign key but no declared index beginning with user_id. Screen, chart, pagination and aggregate queries repeatedly filter by owner.

**Expected:** Measured query plans should be supported by indexes aligned with owner/date/currency access patterns.

**Impact:** Probable table scans as total multi-user history grows. Existing provider-side custom indexes and actual latency are UNVERIFIED.

**Reproduction:** Repository schema/migration inspection; EXPLAIN on a representative disposable database was NOT RUN.

**Likely root cause:** The original table schema has not caught up with current owned-history queries.

**Suggested repair:** Measure actual query plans and add only justified indexes in a separately reviewed migration.

**Regression test needed:** Yes: representative query-plan/performance fixture; avoid tests that merely search for index text.

**Confidence:** High for repository absence; deployed database unknown.

## 8. P3 issues

### MF-A11Y-001 — Account reduced-motion preference does not reach the sidebar

**ID:** MF-A11Y-001  
**Severity:** P3  
**Category:** ACCESSIBILITY / BUG  
**Area:** WEB private navigation animation  
**Title:** Account reduced-motion preference does not reach the sidebar

**Evidence:** app/(main)/layout.tsx:25–27; app/(main)/account/layout.tsx:11; app/components/shared/account/AccountPreferencesProvider.tsx:13; app/components/shared/account/acc-sidebar.tsx:61–84.

**Observed:** The MotionConfig honoring the saved preference is inside the account child tree, while AccSidebar is its sibling in the parent layout. Sidebar hover/tap/entrance animations have no local reduced-motion guard.

**Expected:** The account's reduce-motion preference should consistently cover account navigation.

**Impact:** Users who choose reduced motion still encounter navigation transforms. Actual assistive-technology/device behavior was not tested.

**Reproduction:** Static provider-tree inspection; choose reduce motion and inspect sidebar transforms in a future browser check.

**Likely root cause:** The preference boundary does not encompass all account UI.

**Suggested repair:** Apply the preference at a boundary covering navigation, or give that component an equivalent explicit guard.

**Regression test needed:** Yes: account preference and OS preference across navigation and nested content.

**Confidence:** High for provider scope.

### MF-UX-002 — Small-screen navigation hides all visible labels and omits current-page semantics

**ID:** MF-UX-002  
**Severity:** P3  
**Category:** UX / ACCESSIBILITY  
**Area:** WEB account navigation  
**Title:** Small-screen navigation hides all visible labels and omits current-page semantics

**Evidence:** app/components/shared/account/acc-sidebar.tsx:20–27,49–59,82–99.

**Observed:** Seven module links display only icons below xl; text uses hidden xl:block. Links have accessible names but no visible tooltips/labels and no aria-current; active state is conveyed through styling.

**Expected:** New/sighted touch users should be able to identify modules, and assistive technology should receive current-page state.

**Impact:** Settings, Momentum and other less obvious icons require guessing on common phone/tablet widths. This is a discoverability/semantic defect, not missing screen-reader names.

**Reproduction:** Static breakpoint/link inspection; current viewport and screen-reader verification NOT RUN.

**Likely root cause:** Desktop text is removed at smaller breakpoints without another discoverability mechanism.

**Suggested repair:** Provide compact visible labels or another touch-appropriate cue and current-page semantics.

**Regression test needed:** Yes: navigation at phone/tablet widths, keyboard and screen-reader current route.

**Confidence:** High.

### MF-DEP-002 — Unused deprecated/overlapping package entries obscure the active stack

**ID:** MF-DEP-002  
**Severity:** P3  
**Category:** TECH DEBT  
**Area:** WEB dependency inventory  
**Title:** Unused deprecated/overlapping package entries obscure the active stack

**Evidence:** package.json; package-lock.json:5338–5342; source imports under app/hooks/lib; installed motion 12.23.25 resolves framer-motion 12.34.0.

**Observed:** Unscoped dnd-kit 0.0.2 is explicitly deprecated in the lockfile while code uses @dnd-kit/*; the app uses lucide-react rather than the standalone lucide package. Both motion and framer-motion import surfaces are used, with motion wrapping the same underlying package.

**Expected:** Dependency declarations should reflect intentional, supported usage.

**Impact:** Unnecessary packages increase maintenance/audit noise; mixed imports contributed to the current fixture mismatch. There is no measured duplicate runtime animation bundle or demonstrated exploit from these entries.

**Reproduction:** Read-only dependency/import inventory. No packages removed.

**Likely root cause:** Historical declarations and mixed import conventions remain after implementation changes.

**Suggested repair:** Review usage and remove or standardize only verified unnecessary declarations in a later cleanup.

**Regression test needed:** No dedicated test; build, lint and existing interaction tests after any approved cleanup.

**Confidence:** High for inventory.

### MF-DOC-001 — Current-looking documentation and Weekly Review copy describe retired behavior

**ID:** MF-DOC-001  
**Severity:** P3  
**Category:** DOCUMENTATION / UX  
**Area:** Product copy and operational guides  
**Title:** Current-looking documentation and Weekly Review copy describe retired behavior

**Evidence:** docs/legal-readiness.md:55,61,115,138–145; docs/manforth-landing.md:11,34,44,48; docs/momentum.md:7,23–29; README.md; MOBILE README.md:29,88,92; WeeklyReview.tsx:31.

**Observed:** Old sections claim immutable legal publication/acceptance history, explicit rather than automatic signup trial, 40/10 prices, env-controlled canonical origin, no Finance currency metadata and missing native features. Current code uses static current policies, automatic 14-day signup trial, 39.99 PLN/9.99 GBP/USD/EUR, pinned canonical origin, stored currencies and implemented mobile features. Weekly Review itself says existing transactions have no currency metadata.

**Expected:** Current instructions/copy should describe current behavior; historical checkpoints should be clearly dated and separated.

**Impact:** Users can misunderstand money data; operators can follow obsolete setup/publication steps or assume absent controls exist. Updated notices at the top of some documents mitigate but do not remove contradictory later instructions.

**Reproduction:** Compare the cited text with lib/account/config.ts:6, signup.ts:8–18, legal/store.ts:7–36, brand.ts and schema.ts:126; no runtime needed.

**Likely root cause:** Subsequent implementation/owner decisions were added without consistently reconciling older sections.

**Suggested repair:** Update current copy and runbooks after repairs, retaining historical evidence with clear dates. Do not silently reinstate retired owner decisions.

**Regression test needed:** No broad snapshot suite required; focused content/contract checks where an important user promise is involved.

**Confidence:** High.

## 9. Security review

**WARNING:** MF-SEC-001 leaves direct sensitive password checks outside the configured HTTP attempt limiter. MF-SEC-002 describes stale private browser content after a resolved session change; future server reads remain protected. The billing and retention issues also have security/privacy implications.

**PASS within source/offline-test scope:** session-derived owners; owner/product filters; parameterized SQL; signed raw webhook verification; validated native/public origins; strict command schemas; protected job endpoint; no cached authorization decision; escaped public JSON-LD. Inspection did not identify an exploitable domain IDOR, client-supplied role/access grant, SQL/command injection, path traversal, arbitrary external redirect, unauthenticated admin access over the intended local boundary, or exposed server secret. This negative finding is limited to reviewed paths, not exhaustive penetration testing.

The only unsafe-HTML uses found in the reviewed web presentation are static chart CSS generation and escaped public structured data. Current chart configuration is code-defined; no attacker-controlled HTML-to-chart path was established. Login page validation rejects protocol-relative/backslash redirect targets; auth hooks require the configured origin. Quote symbols are URL encoded, and provider keys remain in server modules.

Native API JSON size is bounded to 512 KB; server actions allow 10 MB in next.config.ts. These limits were inspected, not load-tested. QA auth/mail bypasses require explicit local-development, database-identity and feature conditions; tests exercise refusal in production. No production exploit probes were made.

**UNVERIFIED:** real ingress/header trust, deployment CORS/security headers, session cookies over production HTTPS, secret rotation, hosting exposure of ADMIN, provider webhook reachability, rate-limit behavior across production instances, and device compromise/backup behavior.

Dependency evidence: npm's six high entries collapse into [braces deep-pattern stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and [source-map-js indexed-map denial of service](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). Both were checked against current advisory records. Installed paths are lint/build tooling; application exploitability was not established. They are MF-DEP-001/P2, not six P1 remote vulnerabilities.

## 10. Data-integrity review

| Behavior | Inspection result |
| --- | --- |
| To-Do retry/order/completion | **PASS in offline tests:** stable task IDs, owned whole-board compare-and-swap, equal-snapshot retry acknowledgment; stale changes fail rather than blindly replace |
| Events same-/cross-week writes | **PASS in offline tests/source:** CAS, unique owner/week, split Sunday window uses a single SQL statement with failure on either stale component |
| Gym plans versus actuals | **PASS:** actual strength/cardio inputs begin null/unconfirmed; original plan snapshots preserved; confirmation-only completion does not fabricate reps/load/distance |
| Finance/Investment edits | **WARNING MF-DATA-001:** web ignores expected revision, unlike native |
| Finance/Investment create retry | **WARNING MF-DATA-002:** server UUID per invocation duplicates an ambiguous retry |
| Momentum review persistence | **WARNING MF-MOM-001:** Sunday key renormalized to previous Monday |
| Momentum goal/contribution evaluation | **PASS in offline tests/source:** canonical source keys, period clipping, focus interval union, manual contribution semantics separate from market gains |
| Notification read/archive/source state | **PASS in reviewed tests/source:** owned CAS, dedup keys, independent source completion, statement-snapshot mark-all |
| Provider/campaign worker crashes | **WARNING MF-BILL-002 / MF-ADMIN-001:** last claim can become permanently excluded |
| Account preferences | **PASS in existing PGlite/action tests:** revision conflict does not overwrite newer settings |

Web Gym plan editing and session starting perform related reads/writes in separate steps (gym.actions.ts:141–151 and 221–235). A true two-connection interleaving test is still needed; no specific corruption was reproduced, so this is a test gap, not an additional counted defect.

Deleting a Gym plan preserves its actual session through the set-null relationship. Corrections/reopening change current completion eligibility while preserving logged values. No evidence was found that merely reopening an editor rewrites historical actuals. Real database concurrency, dropped acknowledgments, long retry windows and backup restoration remain **UNVERIFIED**.

## 11. Authentication/authorization

### Flow assessment

Registration validates details/password/birth date and the current policy references, reserves an email proof, checks a six-digit code, creates identity plus credential transactionally, and starts one fourteen-day trial anchored to identity creation. Public Better Auth signup cannot bypass the trusted proof context. New signup failure/retry recovery has substantive tests. Deliverability and actual inbox experience were not exercised.

Proof policy in lib/account/config.ts and email services: ten-minute code expiry, five wrong attempts per code, ten per day, sixty-second resend spacing, bounded sends and recipient/source budgets. Tokens are hashed; proof/code material uses keyed protection; outbox content is encrypted. Password policy checks run in the application's supported routes. Account linking is disabled; residual social behavior depends on explicitly configured migration/provider settings.

Recovery and email change have the consumption-order gap in MF-AUTH-002. Mobile account proof state has MF-MOB-001. Sessions expose owned session-list/revocation controls; cookie caching is disabled. Logout failures do not claim success in covered UI tests. Current-password reauthentication exists but lacks the direct-call quota in MF-SEC-001.

### Ownership matrix

| Resource | Server-side ownership evidence |
| --- | --- |
| To-Do | todo.actions.ts derives session owner, filters kanban row, validates snapshot |
| Events/presets | events.actions.ts, planner.actions.ts and calendar-window.actions.ts use owner/week predicates and guarded writes |
| Gym | gym.actions.ts requires owner for template/plan/session/rest-day reads/writes; plan/session dependency checks; mobile SQL command guards |
| Finance | finance.actions.ts filters both record ID and session owner; strict field allowlist; category uniqueness scoped by owner/type/name |
| Investments | investments.actions.ts filters owner/ID/archive state and validates USD/canonical asset metadata |
| Momentum | momentum.actions.ts owner primary key plus revision/command checks; source records obtained through owned readers |
| Notifications | notifications.actions.ts and notifications/store.ts scope owner/product and resolve typed destinations under that owner |
| Preferences | account actions/store use session owner, revision and strict section schemas |
| Billing | customer metadata/ownership, provider source ownership and product/environment scope; client cannot choose arbitrary price or grant access |
| Support | **NOT IMPLEMENTED** ticket resource; email contact only |
| ADMIN | Local operator capability, not a per-customer endpoint; server/app.ts loopback/Host/Origin/Fetch Metadata/CSRF/rate guards; tests pass |

No important reviewed domain relies solely on a React route guard. Old caller-supplied user IDs are checked against the actual session by requireUserId before private reads. Account existence/metadata leakage beyond intentional auth responses was not demonstrated; enumeration resistance under real email timing is **UNVERIFIED**.

requestBudget() uses one untrusted-source bucket unless TRUST_PROXY_IP is explicitly true. With default limits, independent users can share the twenty-request/hour and ten-distinct-recipient/day source budgets. This is a secure fallback with a significant launch prerequisite: verify trusted ingress extraction before opening registration, rather than blindly trusting arbitrary forwarded headers.

## 12. Billing/subscriptions

The actual access authority is lib/account/access.ts/productAccess(), not a client membership badge. Normalized billing sources in lib/account/billing/sources.ts and entitlement.ts are an opt-in authority; otherwise legacy b1_memberships fields are evaluated. These duplicate representations are the cause of MF-BILL-001.

Current annual price map: **39.99 PLN; 9.99 GBP/USD/EUR**, independent fixed price points. Region affects new-purchase currency; already-recorded billing currency takes precedence. Finance default currency does not choose a subscription currency. Stripe checks product, allowlisted price, amount, currency, yearly interval/count, quantity, tax-inclusive behavior and live/test mode. Provider prices/configuration were not retrieved.

Checkout creation is server-owned with customer mapping, leases and idempotency. Portal requires owned customer/configuration. A checkout success URL triggers confirmation; it does not directly create entitlement. Paid-through dates come from provider period evidence rather than adding a year on each webhook. Cancellation retains confirmed paid access until expiry; first-payment failure is distinct from bounded failed-renewal grace. Full-refund/dispute correctness differs by authority mode as recorded above.

Native implementation is present: RevenueCat SDK offers/purchase/restore/identity handling and uncertainty journal in MOBILE; server subscriber reconciliation, annual product/entitlement validation, environment separation and authenticated webhook in WEB. Server confirmation is authoritative. Store SDK success is not enough to grant access.

| Cross-platform case | Source-supported intent | Verification |
| --- | --- | --- |
| Stripe member on Android/iOS | Same server account/access projection; web billing management destination | **Automated/source verified**, genuine device **UNVERIFIED** |
| Apple/Google member on web | Normalized source reader can grant canonical access | **Conditional** on source integration/configuration; provider lifecycle **UNVERIFIED** |
| Multiple provider sources | Maximum valid expiry across qualifying sources; no additive double extension | Offline/source evidence; real multi-store account **UNVERIFIED** |
| Restore/account switch | Owner-bound purchase journal/App User ID; stale generation rejection | Controller tests pass; store restore **UNVERIFIED** |
| Sandbox purchase in production | Environment-scoped evidence prevents production grant in tested paths | Offline tests pass; actual deployment env **UNVERIFIED** |
| Admin manual grant | Stored/audited separately from revenue | Normalized grant consumer **NOT IMPLEMENTED** in current web code; admin shows pending activation unless separately declared integrated |

EAS profiles currently disable purchasing. This is a configuration/release boundary, not an absent SDK implementation. Store products, taxes, transfer policy acceptance, renewals, refund/revocation webhooks, Apple/Google accounts and sandbox device tests are **UNVERIFIED**.

## 13. Web

Private route refreshes/deep links are protected by proxy plus server data guards. Cache Components and Suspense define static shells/dynamic account content. Finance's invalid route export blocks a verified production artifact (MF-BUILD-001). Private/auth pages have noindex metadata and headers, but authorization is independent of indexing.

The main six modules are implemented. Error/retry affordances exist for save failures, settings, membership, inbox and quotes; tests verify many retain drafts and avoid false success. Web Finance/Investments still need cross-device CAS and stable create receipts. Weekly Review has a confirmed Sunday mismatch. Browser-mounted session invalidation is incomplete (MF-SEC-002).

User journeys assessed from current components/services:

| User situation | Observed implementation / limitation |
| --- | --- |
| New visitor | Explains planning/training/money/goals, synthetic examples and no-card trial; Help and policies public |
| Verified signup | One automatic fourteen-day trial; older accounts can have explicit unused-trial eligibility |
| Returning with valid session | Server-checked private pages and account state |
| Expired session in an already-open tab | Future reads rejected; existing page content may remain, MF-SEC-002 |
| Trial expired | Server write guard restricts product mutations; account/security/export/deletion remain available |
| Renewal canceled | Paid-through remains visible/usable until expiry |
| Payment issue | Separate first-payment, grace and expired states; actual provider lifecycle not run |
| Membership fetch failure | Covered Account settings UI preserves unknown/unavailable and offers retry; does not fabricate Free/Expired |
| Logout | Waits for success before local navigation; cross-tab stale-content gap remains |
| Account deletion | Reauthentication, explicit typed confirmation, durable deletion state and provider-renewal coordination |

Current browser render/responsive/drag/refresh/keyboard behavior is **UNVERIFIED**. Prior QA screenshots and reports were reviewed only as historical context.

## 14. Mobile

**Baseline:** 134/134 tests PASS; nonincremental tsc PASS; scoped source ESLint PASS; official Expo lint PASS. Commands:

- node --test --test-reporter=dot tests/*.test.mjs
- node node_modules/typescript/bin/tsc --noEmit --incremental false
- node node_modules/eslint/bin/eslint.js src app.config.ts --no-cache
- EXPO_OFFLINE=1, EXPO_NO_TELEMETRY=1, EXPO_NO_DOTENV=1 with node node_modules/expo/bin/cli lint --no-cache
- Same isolated environment with node node_modules/expo/bin/cli export --platform all --output-dir <fresh OS temporary directory> --max-workers 2: **PASS**. Synthetic https://inspection.invalid origins and purchasing disabled; temporary output removed.

Export emitted 45 static routes; iOS Hermes 7.1 MB, Android Hermes 7.3 MB, web JS 3.2 MB plus 1.1 MB. These are artifact sizes, not startup, memory or network benchmarks. A deliberately broad direct ESLint “.” probe also ran and **FAILed with 105,815 problems** (57,119 errors/48,696 warnings), overwhelmingly historical generated dist-p* bundles, plus scripts/prepare-brand-assets.mjs:30 Buffer global. That exploratory scope must not replace the package's passing Expo lint result.

check-build-configuration.mjs --strict and check-release-readiness.mjs --strict are **BLOCKED**, exit 1/configurationReady false. Missing approved HTTPS API origin, approved iOS/Android identifiers and EAS project; current local-QA mode is unsuitable for distribution. Separate envs, pinned runtime, purchasing-off gate, explicit website origin and public-secret guard pass. Expo Doctor is **NOT RUN** because expo-doctor is not installed and this task forbids installation. Android compile/launch and iOS native/device checks are **NOT RUN / UNVERIFIED**; export is not a native build.

Inventory under src/app: welcome, sign-in, protected live tabs Today/Plan/Gym/Money/More, and account/inbox/inbox-event/investments/momentum/live-workout details. A separate synthetic workspace/demo exists; browser preview deliberately disables real native auth. Stack.Protected and root loading/error boundaries are implemented.

Session restoration is server-verified at startup/foreground. SecureStore uses WHEN_UNLOCKED_THIS_DEVICE_ONLY and origin-specific key prefixes. Cookies are sent explicitly only to the configured API origin, redirects are rejected, and API requests have bounded timeouts. Logout locks private state immediately and persists pending revocation for retry. Owner/generation checks reject old responses.

Account-keyed SQLite KV journals retain raw drafts and stable pending IDs for Gym/Finance/Investments/Momentum. These are durable recovery mechanisms, **not** complete offline startup or general offline synchronization. Credentials/passwords/proofs are excluded from feature journals. Private export cleanup runs before private startup and on logout. Purchase uncertainty journals keep limited owner/provider/operation/time evidence to prevent accidental repeat purchases.

The account proof lifecycle fails normal mailbox handoff (MF-MOB-001). The root navigator is also replaced during checking (src/app/_layout.tsx:29), making native background/foreground draft/navigation testing especially important even where journals can restore content.

Source includes safe areas, keyboard avoidance, scalable fonts, ≥48-unit controls, theme and reduced-motion support. Actual hardware Back, keyboard focus, system share sheet, deep links from mail, small screens/large text, screen-reader announcements, SecureStore and process-kill recovery remain **UNVERIFIED on native devices**. Passing controller tests cannot establish these behaviors.

Parity limitations: native registration/reset use the website; inbox is unread-first, without All/Read/Archived browsing or mark-unread UI; native push/health/step input and full offline synchronization are absent. Events deletion is separately identified in section 25 based on the server command contract.

## 15. Admin

ADMIN exists as a local Express/Vite operator application. There is no independent Git revision in its directory, so reproducibility needs a separately versioned snapshot. No admin source was changed.

**PASS:** 22/22 tests after retry outside the sandbox; TypeScript; Vite build to a fresh temporary directory. Exact commands: node --import tsx --test --test-reporter=spec tests/*.test.ts; node node_modules/typescript/bin/tsc --noEmit --incremental false; node node_modules/vite/bin/vite.js build --configLoader runner --outDir <fresh OS temporary directory>. Build: 1,690 modules; JS 296.22 kB / gzip 88.39 kB; CSS 26.53 kB / gzip 6.44 kB. Temporary output removed. **NOT IMPLEMENTED:** admin lint script/configuration.

UI inventory: Overview, account analytics, users/search/detail, canonical verified-user creation, manual membership grants, provider subscription records, campaign draft/audience/review/send/schedule, personal mail/reply, received mailbox/read state, sent/queued outcomes, canonical inbox visibility, audit log and system/settings.

server/app.ts exposes context/system/overview; user list/detail/create; grants; subscriptions; campaigns/audiences/review/send/test; email preview/check/send/check-delivery/inbox/sent; notifications and audit. Stripe/Resend check endpoints exist but were not called. Signed /api/resend/webhook and token-bound /public/unsubscribe GET/POST are implemented.

Its authorization model is **local operator access**: server/index.ts binds 127.0.0.1; server/app.ts:17–34 checks peer, exact Host, Origin, Fetch Metadata, CSRF and request rate. No admin login is deliberate for this boundary, not a demonstrated internet admin bypass. Remote deployment of this process is not validated by that design.

Tests substantiate transactional operation receipts/fingerprints, append-only audit protection, owned canonical identity/grant behavior, campaign consent/suppression rechecks, immutable payload/idempotency and local HTTP protections. It does not load private customer task/finance/workout content into analytics.

Metrics distinguish stored subscriber counts from unavailable tables/provider checks and separate grants from provider revenue. Platform usage/DAU/WAU/MAU is explicitly unavailable; no inference from Apple/Google payment source to device activity is justified. “0 stored Apple subscriptions” is not treated as proof of Apple integration health.

Confirmed defects: MF-ADMIN-001 exhausted lease recovery; MF-ADMIN-002 starvation of older delivery checks. Provider receipt/event behavior is mocked in tests, not live-verified.

Admin schema: mf_admin_operations, mf_admin_audit, mf_admin_grants, mf_admin_campaigns, mf_admin_deliveries, mf_admin_mailbox, mf_admin_email_events, mf_admin_email_preferences and mf_admin_state in migrations/001_admin.sql, plus shared canonical account/billing/inbox/suppression tables.

**NOT IMPLEMENTED:** current WEB consumer for normalized admin grants; push; platform telemetry; historical trial conversion; revenue/refund/restore dashboards; provider reconciliation; CSV reporting and attachment transfer. **NOT RUN:** db:migrate, check:data, check:inbox, dev/start/worker, because they use configured databases/providers or can dispatch messages.

## 16. Database

Reviewed lib/db/schema.ts and ordered SQL files from 0000 through 0035, with gaps/feature-specific installation explained in MF-DB-001. Source is not proof of actual applied database state.

| Model group | Stored records |
| --- | --- |
| Identity | user, session, account, verification, rate_limit |
| Core | finance_table, finance_categories, investment_positions, kanban_board, user_events |
| Gym | gym_entities, gym_plans, gym_sessions, gym_rest_days |
| Momentum | momentum_state with validated domain JSON and revision/receipt history |
| Account/access | b1_account_settings, b1_memberships, b1_billing_sources |
| Email/security | b1_rate_buckets, b1_email_ledgers, b1_email_attempts, b1_email_outbox, b1_email_suppressions, b1_recovery_claims |
| Provider/inbox/deletion | b1_provider_events, b1_notification_receipts, b1_inbox_state, b1_notifications, b1_app_messages, b1_deletions |
| Compatibility/legacy | b1_development_account_setup, user_notes, quotes, quote_likes, user.groqKey |
| Mobile SQL | Additional revision/identity/receipt/snapshot tables, triggers and stored command functions from 0025,0026,0029,0031,0033,0034,0035; these are not fully represented by the typed Drizzle schema |

Good constraints include identity email/token uniqueness, owned cascades, one session per linked Gym plan, owner/date rest-day uniqueness, owner/type/normalized category uniqueness, owner/week Events uniqueness and owner/product/dedup notification uniqueness. Gym plan deletion sets session.plan_id null rather than deleting actual history. Money uses PostgreSQL numeric plus application decimal/minor-unit validation.

Caveats requiring data evidence:

- kanban_board lacks unique owner; deterministic IDs protect new creation, but historical duplicates could remain. Web uses findFirst; mobile rejects multiple rows. Existence of duplicates is **UNVERIFIED**.
- quote_likes lacks user/quote FKs after historical changes; no active public write surface was found in this slice. Orphan existence is **UNVERIFIED**.
- Legacy Finance nullable currency/type/category and timestamp date modeling cannot be “fixed” by guessing historical values. New record currency is explicit/defaulted and immutable on ordinary edits.
- Historical 0002 adds nonnullable owners without backfill; 0007 drops old Finance tables without copying data. These are replay hazards, not observed current data loss.
- 0021 uniqueness can refuse duplicate existing Events; automatic merging/deletion is not an acceptable inference.
- 0027 refuses to retire a nonempty legal registry and atomically preserves history. Current registry absence is a deliberate source design; actual execution here was NOT RUN.
- Handwritten triggers/partial indexes/functions are beyond typed schema declarations. Generic schema push/generation is not established as safe.
- Finance owner-leading index is missing in committed schema (MF-PERF-003).

Connection approach is Neon HTTP for ordinary SQL plus max-four transactional WebSocket pool for auth. Connection errors are sanitized. Live connection health, actual indexes/constraints, applied hashes, roles/RLS, backup/restore, retention jobs and Neon/Vercel regions are **UNVERIFIED**. No region migration recommendation follows from this review.

## 17. Notifications/email/push

Internal notifications are persistent and implemented on web/mobile. Web supports bell/count, pagination, All/Unread, individual read/unread/archive, mark-all and typed destinations. Count is a database aggregate, not page-one length. CAS and source-generation/dedup rules prevent read actions from changing source completion. Gym/Event projection avoids double-producing the same canonical completed workout in covered tests.

Web InboxProvider remounts the private inbox cache by owner, ignores stale response epochs, stops hidden-page polling and preserves last-known data with an error. This is stronger than the global private page behavior in MF-SEC-002. Native inbox is explicitly unread-first; All/Archived parity is absent.

Email channels differ:

| Channel | Implementation / result |
| --- | --- |
| Auth and security | WEB Resend encrypted outbox, proof/recovery templates, configured sender/reply-to, budgets, idempotent sending and signature-verified suppression; live delivery **UNVERIFIED** |
| Product/marketing campaigns | **ADMIN IMPLEMENTED:** audience/consent/unsubscribe/suppression, drafts/review/test/send/schedule, durable delivery/audit |
| Personal/operator mail | **ADMIN IMPLEMENTED:** send/reply, incoming mailbox and delivery checks |
| Outside-app Event/Gym reminder email | **NOT IMPLEMENTED in current customer workflow**; enqueueMail rejects reminder kind, current preferences UI states internal notifications only |
| Legal/service mass-notice lifecycle | No complete policy-version-driven mass-notice/reacceptance system established; **NOT IMPLEMENTED** as such |
| Push | **NOT IMPLEMENTED:** no active native/browser token registration, rotation, provider receipts or invalid-token cleanup |

MF-EMAIL-001 affects terminal encrypted payload retention. MF-ADMIN-001/002 affect campaign processing/status/suppression. Actual sender-domain verification, reply mailbox reception, bounce/complaint delivery, unsubscribe links in sent messages, duplicate-provider acceptance and real worker scheduling are **UNVERIFIED**. No message was sent during review.

The existence of ADMIN campaigns resolves older WEB-only documentation that described bulk sending as absent; it is not globally absent from the workspace. Compatibility preference fields email/marketing/trialReminder must not be confused with an implemented outside-app reminder service.

## 18. Finance/Investments

Finance supports income/expense creation/edit/delete, category visibility, history/board/filtering, charts and CSV. Each new record retains its own currency; changing the default does not relabel old values. Legacy null currency is preserved as unassigned. Mixed-currency aggregate operations reject unsupported mixing; BigInt minor-unit totals avoid ordinary floating-point decimal accumulation. CSV export tests include escaping/precision behavior.

The significant money risks are MF-DATA-001 and MF-DATA-002. Native receipt/revision functions do not automatically make the older web action writers safe. Per-editor submission locks do not replace database concurrency control. Finance date handling/account preference behavior has tests; actual historical timezone migration is **UNVERIFIED**.

Investments are **USD-only tracking**, with positions/lots, quantities, purchase cost, date, quote lookup, manual valuation and archive/undo. Legacy non-USD records are preserved and refused for silent relabeling. Server-only CoinGecko/Yahoo lookup encodes symbols and accepts USD quotes. Missing quotes are null/unpriced; previously cached quotes are marked stale on provider failure. No browser provider secret was found.

Investment market gains are not Momentum contributions. Goal contribution/withdrawal evidence is manually recorded in Momentum; no brokerage execution, bank connection, actual transaction settlement or automatic contribution inference exists. Price lookup couples to initial rendering (MF-PERF-001). Symbol/catalogue accuracy and real provider availability/rate limits were not queried.

## 19. Gym/Events/Momentum

Gym has catalogue/custom exercises, reusable templates, planned workouts, actual sessions, strength sets/reps/load, cardio duration/distance, rest days, kg/lb/km/mi/unit/load conventions, snapshots and history. Actual values are separate from targets; quick “confirm completed” counts confirmation without inventing loads/reps/cardio. Reopening/editing a saved session is explicit; the original plan snapshot is preserved. Relevant logic: lib/gym/logic.ts:17–55, session-write.ts:5–14, gym.actions.ts:277–312.

Events support weekly navigation, date-only entries, optional local time/duration/overnight, completion, presets/three week presets and linked Gym plans. Calendar/DST and split Sunday-week SQL are tested. The earlier suspected Events Sunday-shift issue was disproved and is not counted.

To-Do supports create/edit/complete/uncomplete/delete, drag/reorder, keyboard alternatives, stable IDs, failed-save recovery and stale snapshot rejection. Whole-card sensors exclude nested controls, and drag previews do not themselves persist in tested logic. Physical touch/scroll/drag behavior is **UNVERIFIED**.

Momentum includes training/focus/goal periods, Journeys, Recent Wins, manual savings/balance/contribution records and Weekly Review. Completed canonical workout sources count once across Gym/Event projection. Scheduled activities do not become completed just because their time passed. Goal focus evaluations clip and union intervals. Money goals separate manual external contributions from dividends/trades/market values.

MF-MOM-001 affects Sunday Weekly Review persistence; MF-PERF-002 affects growing history. Manual/automatic walking steps are absent. Automatic money-source linking is absent and correctly disclaimed by feature pages, although Weekly Review has stale currency wording (MF-DOC-001).

## 20. Registration/legal/settings

Current policies are static server-local copy plus validated operator facts, not the old publication database. Content-derived IDs/hash versions change with wording. Public readers return the current document and an empty historical list; version routes resolve only the current matching version. legalAccountHistory returns empty records/purchases. Signup/checkout validate current policy references but do not persist acceptance history in the retired system.

This is a **technical/product description, not legal certification**. Whether the operator requires archived exact versions, stored acceptance/purchase evidence, retention schedules or different approval gates is a **LEGAL/OWNER DECISION**. Do not infer that retired history must be recreated, or manufacture historical acceptance. Internal review drafts are separate from current public policy readers; no proof of customer-visible developer notes was found in current readers.

| Settings area | Source of truth and failure behavior |
| --- | --- |
| Display/account details | Owned server profile/name updates; signup birth-date validation; confirmed-save state; save/reload covered by action/database fixtures; browser refresh UNVERIFIED |
| Finance default currency | Account preference affects new inputs, not existing record currency |
| Exercise/bodyweight/distance/measurement units | Independent validated preferences with canonical stored units/history |
| Timezone/week start/12–24-hour/date/number formats | Server settings and preference-aware hooks; Weekly Review exception MF-MOM-001 |
| Appearance/reduced motion | System/app support; sidebar scope exception MF-A11Y-001 |
| Notifications | Owned CAS settings; current user-facing channels are internal inbox; compatibility fields are not new delivery promises |
| Security | Password/email/session/logout controls; MF-SEC-001 and MF-AUTH-002; mobile proof MF-MOB-001 |
| Membership | Canonical server summary; failed fetch remains unknown with retry; provider management per source |
| Privacy | Current public policy links, owned export and guarded deletion; no invented legal history |

Export omits credential/session/provider-secret internals and other-product records. Deletion uses a durable tombstone, blocks product writes, coordinates Stripe renewal/open checkout handling and refuses ambiguous shared identity/billing cases. Native renewal requires store cancellation. Deletion/late-webhook races are covered partly in fixtures; actual provider completion and backup retention are **UNVERIFIED**.

## 21. Landing/SEO/performance

Current visual direction is the inspected ManForth/by B1-Way blue/orange application and artwork-led landing, not the old “Your Daily” README. Hero has responsive local WebPs, preload/high priority for the first Finance scene, decode-before-switch, loading failure preservation, reduced-motion/coarse-pointer handling and manual controls. Synthetic examples are labeled Example data and live in local React state. No customer activity is used as marketing evidence.

Copy advertises implemented planning/training/money/goals and disclaims automatic health/brokerage/native-release promises. Annual price and monthly equivalent use shared constants; fixed annual charge/renewal timing is explicit. MF-UX-001 covers unknown status masquerading as a confirmed CTA. No current approval screenshot or browser visual QA was generated.

SEO source implements distinct public titles/descriptions/canonical/OG/Twitter, escaped connected JSON-LD, five public sitemap paths, private/auth/legal noindex and custom 404. Canonical origin is pinned to https://b1-way-mf.vercel.app independently of Host/preview input. Only NODE_ENV=production plus VERCEL_ENV=production enables public indexing. robots permits crawlers to discover noindex on auth/legal, while /account and /api are excluded. This intentionally differs from older docs; noindex is not authorization.

**UNVERIFIED:** current rendered status codes/redirect chains, metadata in deployed HTML, broken links across a current build, crawler behavior, production cache headers, LCP/INP/CLS, browser bundle waterfall and image performance. No unmeasured “fast” rating is assigned.

Performance findings are MF-PERF-001/002/003. Account access/settings/session checks can repeat across composed server readers; no latency or query-count profile was collected. Process-local quote caches are instance-scoped and have no eviction of expired keys. Those are profiling candidates, not evidence for infrastructure migration.

## 22. Accessibility/UX

Source positives: public skip link, semantic public sections/headings, accessible carousel controls, keyboard To-Do movement, Radix dialog primitives, labeled forms/errors, text alternatives to the Finance chart, touch-sized primary controls, theme/reduced-motion hooks and explicit retry messages. Native source uses safe areas/font scaling/keyboard avoidance.

Counted gaps: MF-A11Y-001 sidebar ignores account reduced-motion scope; MF-UX-002 small-screen icon-only navigation/current-page semantics; MF-UX-001 misleading landing defaults; MF-MOB-001 mailbox handoff; MF-MOM-001 apparently missing saved review. Stale currency wording is part of MF-DOC-001.

Terminology is largely ManForth/by B1-Way, To-Do, Events, Gym, Momentum, Finance, Investments and Membership. Residual “Your Daily,” “B1-Way” account title, Login/Logout versus Sign in/Sign out, and stale feature statements remain in docs/isolated labels. The material contradictions are counted; individual capitalization/typos were not inflated into separate findings.

**UNVERIFIED:** measured contrast, 200%/large-text layout, actual focus trap/return, screen-reader announcements, Android Back, keyboard overlap, physical touch targets and drag alternatives on devices. Native Notice is plain text/view without explicit live-region semantics; actual announcement behavior needs device testing before assigning a confirmed failure.

## 23. Test gaps

The tests are more than snapshots: real domain functions, owned action predicates, exact decimals/date boundaries, immutable Gym targets, signed-provider SDK verification with fixtures, CAS/retry cases and PGlite stored SQL are exercised. They establish useful behavior but not real Neon concurrency or provider/native acceptance.

Critical missing or misleading coverage:

1. Web Finance/Investment stale edits against another web/native writer and commit-with-lost-response creation retries.
2. Sunday Weekly Review save → reload → edit with matching summary period.
3. Legacy **already-paid** membership full refund/dispute. Existing refund test enables normalized sources.
4. Password throttling through actual exposed Server Actions rather than only Better Auth HTTP routes.
5. Final-attempt crash/lease recovery for Stripe, native and admin queues.
6. Rejected mail retention after expiry and complete terminal-state matrix.
7. Mobile real mailbox handoff. The passing account controller test currently encodes proof destruction as expected behavior.
8. More-than-twenty admin delivery reconciliation and older late complaint/suppression.
9. Cross-tab web logout/account switch private-content cleanup.
10. Actual native SecureStore, lifecycle/navigation, purchase/restore, keyboard/Back/accessibility and process-kill recovery.
11. Fresh/populated migration replay from supported histories, deployed constraints and true concurrent database transactions.
12. Current full web production build in the required gate, not tsc against stale generated files.

tests/helpers.mjs transpiles modules with injected imports, mocks several platform/billing/notification boundaries, and its generic hookHarness does not run real effects. Some tests provide specialized effects, but the harness is not a real React browser/native runtime. In particular, afterNotificationSourceChange is mocked in ordinary domain actions, so their success is not proof of the postcommit inbox boundary. Tests that assert source strings are useful narrow guards, not behavior coverage. Full WEB suite had zero skipped tests; one test failed before assertions.

## 24. Stale/dead/duplicated code

MF-DOC-001 records concrete doc/code disagreements, including directly visible Weekly Review currency copy. Historical test counts/screenshots and release notes must remain dated evidence, not the present baseline.

MF-DEP-002 covers unused deprecated dnd-kit and overlapping library declarations. Active motion/framer-motion imports share the installed underlying dependency; a doubled runtime bundle was not measured.

Maintenance risks with functional consequences:

- Legacy and normalized entitlement readers diverge under refund/revocation (MF-BILL-001).
- Web and mobile money write contracts diverge in CAS/idempotency (MF-DATA-001/002).
- Three durable worker implementations share a similar last-attempt lease gap (MF-BILL-002/MF-ADMIN-001).
- Typed schema, handwritten SQL, generic journal and feature ledgers describe overlapping database state (MF-DB-001).
- Giant client modules—GoalTrackerPanel, EventsClient, FinancePlayground, InvestmentsClient and AccountSettingsClient—couple substantial state, save/retry and UI logic. Their size alone is not a refactor requirement; isolate the proven risky boundaries during repairs.
- Legacy user_notes/quotes/quote_likes/groqKey and legal no-op compatibility functions remain. Do not delete them without identifying users, retention requirements and shared-product dependencies.

## 25. Not implemented vs bugs

| Capability | Classification |
| --- | --- |
| Core web modules | Implemented; specific defects in sections 6–8 |
| Native purchase/restore and server RevenueCat processing | Implemented in code; purchasing currently disabled for release; device/store lifecycle UNVERIFIED |
| ADMIN users/metrics/campaigns/personal email/audit | Implemented; actual provider/production behavior UNVERIFIED |
| Native/browser push, token lifecycle and receipts | **NOT IMPLEMENTED** |
| HealthKit/Health Connect/automatic or manual walking-step collection | **NOT IMPLEMENTED in reviewed app flow** |
| Bank/broker integration and brokerage execution | **NOT IMPLEMENTED**, not advertised as current functionality |
| Automatic Finance/Investment contribution linkage to Momentum | **NOT IMPLEMENTED**; manual journal is intentional |
| Native full signup/reset | **NOT IMPLEMENTED natively**; controlled website handoff exists |
| General offline startup/write synchronization | **NOT IMPLEMENTED**; selected durable input recovery exists |
| Mobile inbox All/Read/Archived and mark-unread UI | **NOT IMPLEMENTED**, documented unread-first parity limit |
| Mobile manual Event deletion command | **NOT IMPLEMENTED in inspected API contract**; lib/mobile/event-contract.ts exposes upsert/complete/preset/apply/reschedule, no delete; web deletion exists |
| Persistent private support-ticket backend | **NOT IMPLEMENTED**; user-initiated email contact exists |
| Legal publication/approval registry, immutable historical versions and stored acceptance history | **Deliberately retired/currently absent**; legal/owner design decision, not automatic instruction to restore |
| Outside-app activity reminder email | **NOT IMPLEMENTED** in current customer workflow |
| Normalized admin-grant consumption by current web access reader | **NOT IMPLEMENTED**; operator UI indicates pending integration |
| Admin platform telemetry/DAU, historical conversion and financial revenue/refund dashboards | **NOT IMPLEMENTED**; unavailable states are explicit |
| Admin lint gate | **NOT IMPLEMENTED** |

Absence alone is not counted as a bug unless a current accepted behavior or UI contract is contradicted. Current workspace implementation supersedes old prompts and checkpoints.

## 26. External blockers

- **BLOCKED:** strict native release/build configuration needs approved production origins, identifiers, EAS project and distribution mode. This inspection did not choose or change them.
- **UNVERIFIED:** Apple/Google/RevenueCat accounts, annual products/offerings, environment alignment and real sandbox purchase/restore/refund/renewal.
- **UNVERIFIED:** Stripe prices/customer mapping/portal/webhook scheduling, Resend sender/webhooks/support mailbox and production secrets.
- **UNVERIFIED:** deployed schema/applied hashes, disposable QA connection, database roles/constraints/indexes/backups and restore.
- **UNVERIFIED:** cron/job dispatch. /api/account/jobs is POST; an external scheduler must match its authorization and method. ADMIN scheduling also requires a running worker.
- **UNVERIFIED:** legal operator decisions/current publication facts and retention obligations. No compliance certification.
- **NOT RUN:** Expo Doctor because absent tool installation is disallowed. No supported current iOS/macOS signing/device toolchain was established on this Windows host.
- **FAIL, cause UNVERIFIED:** Turbopack child-worker connection; outside-sandbox repeat did not resolve it. Webpack separately established the application export defect.
- Local presence-only env inspection found no CRON_SECRET, RESEND_WEBHOOK_SECRET or RevenueCat credentials in WEB .env; QA_DATABASE_URL was absent from its QA file. Host/deployment environment injection could differ, so this is not a claim that production is missing them.
- npm registry access initially failed inside the sandbox, then succeeded outside. The final vulnerability inventory is available; the initial DNS failure is not a remaining scan blocker. Mobile/admin dependency advisory scans were **NOT RUN**.

## 27. Recommended repair order

No repairs were performed.

**Repair Wave 1 — P0 security/data.** No P0 was confirmed. First validate actual deployment access-reader/environment flags and exposure boundaries to determine whether any conditional risk requires urgent containment. Do not change billing/database state blindly.

**Repair Wave 2 — P1 auth/access/data.** MF-BILL-001 refund/revocation consistency; MF-DATA-001 stale money edits; MF-MOB-001 same-owner mailbox handoff. Resolve MF-BUILD-001 at the start so every later change can be checked against a real production build. Add sensitive-action limits (MF-SEC-001) and cover session privacy (MF-SEC-002).

**Repair Wave 3 — Core functional defects.** MF-DATA-002 stable create receipts; MF-MOM-001 week contract; MF-AUTH-002 proof recovery; MF-BILL-002/MF-ADMIN-001 queue recovery; MF-ADMIN-002 fair receipt checks; MF-EMAIL-001 retention. Reconcile MF-DB-001 into an approved migration plan before applying schema changes. Restore test/lint baseline (MF-QA-001) and add the missing fault/race tests alongside fixes.

**Repair Wave 4 — Performance/UX/accessibility.** Measure and address MF-PERF-001/002/003; explicit landing unknown states (MF-UX-001); navigation labels/current state and reduced motion (MF-UX-002/MF-A11Y-001). Run real browser/native lifecycle and accessibility journeys. Resolve MF-DEP-001 through a supported dependency plan, not automatic forced downgrade.

**Repair Wave 5 — Cleanup/documentation.** MF-DOC-001 and MF-DEP-002, current release/runbook ownership, legacy inventory and source-of-truth consolidation. Preserve migration history, recovery journals, credentials, backups and legal/product records.

## 28. Release assessment

| Target | Assessment | Reasons |
| --- | --- | --- |
| INTERNAL QA | **READY WITH CONDITIONS** | Offline/controller/PGlite review can continue and mobile/admin bundles are available. Current web runtime QA is blocked by its build failure. Keep live sends, purchasing and real database mutation disabled until separate authorization/environment verification. |
| BETA | **NOT READY** | Four P1 findings, red web test/lint/build baseline, unresolved money/auth/retry defects, strict mobile distribution blockers and no current device acceptance |
| PRODUCTION | **NOT READY** | Beta blockers plus unverified real database migration/restore, provider lifecycle/jobs, ingress/rate limits, legal owner decisions and production behavior |

First-day risks are the build failure, verification handoff/recovery, incorrect refunded access, missing migration prerequisites and scheduler/ingress configuration. At 100 or 1,000 users, repeated full-history polling, missing Finance indexing, instance-local quote caches, shared fallback signup quotas and worker recovery become increasingly relevant. Those are architecture-supported scenarios, **not load-test results**.

| Failure scenario | Current behavior / risk |
| --- | --- |
| Slow database | Queries/errors surface in covered flows; repeated whole-history work may amplify latency; no production benchmark |
| Stripe unavailable | No client success grant; receipt queue can retry; final-attempt recovery gap and worker scheduling must be addressed |
| Resend failure | Durable retry/suppression/budgets exist; permanent rejected payload retention and proof recovery gaps remain |
| Quote provider unavailable | Stale/unpriced values are explicit, but page waits for market enrichment |
| Mobile offline/background | Private UI locks and selected drafts recover; no general offline mode; account email proof is lost on mailbox handoff |
| Duplicate webhook | Durable provider/event identity and absolute paid periods mitigate duplicate extension; exhaustion/recovery still defective |
| Two devices edit | Most core domains have CAS/receipts; web Finance/Investments do not |
| Session expires during save | Server denies new unauthorized writes; draft/retry behavior varies and mounted private web data is not globally cleared |
| Worker dies after last claim | Provider/admin queues can strand work; confirmed offline reproductions |
| More than twenty sent admin emails | Receipt polling repeatedly checks the newest twenty; older outcomes can starve |

This report establishes a reviewable before-fixes baseline. Current production health, legal compliance, financial correctness of real accounts and native store readiness remain **UNVERIFIED**. Stop here and use a separate authorized repair task.
