# Current public policy implementation — 2026-10-04

The owner confirmed the website policy text and supplied operator/controller fields through .env. Terms and Privacy now use lib/legal/public-content.ts with allowlisted server environment fields. Both pages and their JSON downloads are public; empty optional registration and tax lines are omitted. No account, email proof, Turnstile or policy database query is required to read them.

Registration still requires an initially unchecked agreement and validates the current content references on the server at the email request and identity-creation steps. The agreement stays request-scoped: no legal choice, reservation, acceptance, document copy or purchase receipt is persisted. Email proof, password validation, raw-auth route guards and stable account IDs remain. The Privacy settings panel has direct links, without a legal-history fetch or loader.

0027_static_legal_pages.sql locks and checks all six obsolete legal tables before dropping any of them. If any contains data, the entire statement fails and preserves history. It does not remove user, account, session, email proof, subscription, test-setup audit or module data. Run npm run legal -- status --registry to inspect safe aggregate counts; npm run legal -- retire-empty-registry --apply retires only an empty registry. Old database publishing commands are no longer available.

Use the same required operator fields in production. Next server rendering requires a new deployment/rebuild after policy or operator changes. Local env facts do not configure a remote deployment. Billing readiness and existing paid access were not enabled or changed by this policy update. Live registration retains its independently required email protection configuration. Turnstile was subsequently removed at the owner's request; no widget, validation request or provider keys are needed. Technical verification is not a certification of legal compliance.

## Executed verification, October 4

- Configured database: all six legal registry tables had zero rows. The guarded retirement succeeded; the follow-up inspection confirmed all six tables absent. No account or module data was deleted.
- `npm test`: 323 tests passed, zero failed. After the final policy-link visual polish, the 18 account cleanup tests passed again.
- `npx tsc --noEmit`: passed. Final production build also completed its TypeScript check.
- `npm run lint`: passed without warnings. `npm run build`: passed; `/terms` and `/privacy` prerender as static public HTML.
- Local production HTTP requests without cookies: Terms, Privacy, reference endpoint and both JSON downloads returned 200. No redirect, draft marker or unavailable-policy placeholder appeared.
- Browser: both public pages rendered without a sign-in requirement; mobile width 375 px had matching scroll width. Privacy section anchors worked. The authenticated Privacy settings panel had direct new-tab links and no legal-history loader or empty evidence state.
- Required checkbox, current-reference validation, retry behavior and verified proof are covered by executed tests. No real signup, account save, deletion, email or payment was submitted during verification.
- Before the subsequent Turnstile removal, registration was unavailable because email protection and the two Turnstile keys were absent. After removal only `EMAIL_PROTECTION_SECRET` remains required locally. This does not affect public policy access. A local build is not a production deployment or legal certification.

Evidence is under `docs/account-cleanup/artifacts/static-legal-*`, with `privacy-public-desktop.png`, `privacy-public-mobile.png`, `terms-public-mobile.png` and `privacy-settings-final.png`.

## Subsequent web verification update, October 4

At the owner's request, removed the Cloudflare widget, external validation call, token fields and both provider key requirements. Current public Privacy copy no longer lists that provider. Email verification, current policy agreement, ownership and reauthentication checks, same-origin validation, durable request/send/guess limits and resend cooldowns remain. No replacement CAPTCHA or new dependency was added.

- `npm test`: 336 tests passed, zero failed, including eight focused email request and recovery tests. Ready signup requests no provider token and still requires agreement and explicit code confirmation. Foreign origins, budget exhaustion, other-user verification, duplicate taps and failed recovery retries are covered with synthetic fixtures; no actual email or account was created.
- `npx tsc --noEmit`, `npm run lint` and `npm run build`: passed. Public signup, recovery, Privacy and policy-reference HTTP requests returned 200 without Turnstile references.
- Browser: recovery's send button was enabled with no Cloudflare script or iframe. Screenshot: `docs/account-cleanup/artifacts/recovery-without-turnstile.png`.
- Configuration check reported only `EMAIL_PROTECTION_SECRET` missing; live registration remains unavailable until configured. No encryption key was generated or changed, and no actual delivery was tested.

The historical review below describes the retired October 3 implementation; its database publication/evidence steps and missing operator statuses are superseded by the owner's October 4 request above.

---

# ManForth legal implementation and launch review

Prepared 2026-10-03. **Draft / Blocked for new registration and purchases. No lawyer or privacy adviser has approved these documents.** Implementation and tests are not legal certification. This register concerns the personal product `b1-way-personal`; it does not approve the language-learning product's policies, payment plans or data flows.

## Owner information still needed

The owner asked to supply the facts through environment variables. Blank entries are installed in `.env` and documented in `.env.example`:

| Variable / decision | Status |
| --- | --- |
| `LEGAL_OPERATOR_NAME`, `LEGAL_OPERATOR_FORM` | Blocked: full contracting entity/controller identity and legal form |
| `LEGAL_OPERATOR_COUNTRY`, `LEGAL_OPERATOR_ADDRESS` | Blocked: establishment country and required geographical/contact address |
| `LEGAL_OPERATOR_REGISTRATION`, `LEGAL_OPERATOR_TAX` | Blocked: verified registration and tax/VAT details, or a confirmed explanation of non-applicability |
| `LEGAL_CONTACT_EMAIL` | Blocked: confirmed privacy/complaints mailbox. Brief proposed `support@b1-way.pl`; previously selected app support is `support-mf@b1-way.pl`. Draft fallback uses the existing address; it is not confirmation. No sender was silently changed. |
| Controller relationships, DPO/representative if required | Not checked: do not invent appointments or infer incorporation from a `.pl` domain |
| Actual providers, locations, contracts, backup/restore/log retention | Not checked: inspect deployment and business records, not only repository imports |
| Markets, adult eligibility, contract formation, consumer remedies and notice delivery | Blocked: qualified review, including Poland/EU as a review context and other intended markets |

Filling variables updates the **development draft only**. It cannot approve, publish or alter frozen accepted versions. Public metadata retains `https://b1-way-mf.vercel.app`; security/payment callbacks retain configured `APP_URL`.

## Verified implementation boundaries

| Area | Evidence / result | Status |
| --- | --- | --- |
| Public documents | `/privacy`, `/terms`, immutable published version routes, section anchors, print and JSON downloads. Readers use server-only registry and do not mount Turnstile or account projection. | Implemented; browser/build results below |
| Signup | Existing multi-step email proof and Better Auth hooks reused. Separate Terms agreement/privacy-notice acknowledgment, strict input, current pair and server timestamps. Signup does not start trial or payment. | Implemented |
| Atomic evidence | `0022_legal_documents.sql` AFTER INSERT trigger saves exact copies inside identity/credential transaction. Create-before hook requires owned verified proof/reservation and enabled trigger. Better Auth create-after is queued after commit, so was deliberately not used for mandatory evidence. | Implemented; isolated transaction checks below |
| Ownership / retry | HttpOnly proof cookie, preassigned stable user ID, CAS consumption, unique choices, one purchase operation. Lost-response retry signs in normally if the already-created user's registration evidence exists. Failed creation can retry a still-valid proof. | Implemented |
| Document changes | Updated versions require a new checkbox choice; verified proof/account fields stay in component state. No passwords/codes are copied into URLs/localStorage. | Implemented |
| Exact purchase | Separate initially unchecked payment/annual renewal acknowledgment and document agreement; snapshot selected amount/currency/Stripe price, exact documents and hashes before customer/checkout creation. Retries retain the original snapshot. Price changes inconsistent with frozen terms block checkout. | Implemented; purchases still blocked |
| Existing entitlements | No historical acceptance backfill, no trial/paid-through edits. Login/recovery, portal/cancellation, export/deletion remain independently accessible. | Preserved |
| Notification email | Product reminder queue returns zero. New reminder email enqueue rejects; legacy queued reminder payloads are suppressed before decryption/provider send. Existing verification/recovery/security delivery remains. No campaign, push or legal-email sender added. | Implemented |
| Internal reminders | `dueNotifications` + existing account notices calculate events/goals/review/trial reminders on app use. No durable legal inbox or read/archive store currently exists. | Verified source; persistent policy notice/reacceptance rollout remains blocked |
| Gym / body / steps | Gym stores templates, targets, actual strength/cardio, exercise notes and optional pain flag. Unit preferences exist; no implemented body-measurement collection or manual walking-step module was found. Existing records preserved. | Verified source; health-data launch assessment blocked |
| Separate products | Product-scoped registry/evidence. Conditional identity trigger does not reinterpret unrelated B1-Way registrations; this app's supported create hook still rejects creation without its owned signup reservation. | Implemented |

## Processing register — proposals require review

These are **proposed** bases and retention criteria, not approved legal determinations. GDPR purposes need an identified basis; acknowledgment of a privacy notice is not processing consent. See [EDPB lawful processing](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en) and [Commission transparency/obligations](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en).

| Purpose | Actual data / necessity | Proposed basis / assessment | Actual recipients / evidence | Implemented retention and unresolved issue |
| --- | --- | --- | --- | --- |
| Account delivery | Name, email, verified state, protected credential, session; needed for requested authenticated account | Contract/pre-contract only where objectively necessary | Better Auth inside backend; Neon/PostgreSQL; hosting | Account deletion removes identity/owned rows. Session/code expiry is implemented; expired metadata/log cleanup must be audited. |
| Optional user modules | Tasks/events/notes/presets; finance/imports; USD positions; goals/focus/reflections/reviews; gym targets/actual records | Requested service where necessary; separate Article 9 condition when applicable | Application database/hosting; market requests below | Module/archive behavior varies; account cascade deletes records after billing resolution. Backups/legal holds not verified. |
| Abuse/security | Proof attempts/digests, quota keys, suppression state; session user-agent/IP where library records it; breach check | Proposed legitimate interest: protecting accounts and service integrity. Complete necessity/balancing assessment. | Resend, Cloudflare Turnstile, hosting/DB, HIBP hash-prefix request | OTP 10 min; daily sends/guess limits; encrypted outbox cleared on sent/expired/terminal states. Suppression/rate/proof metadata have no verified universal purge policy. |
| Purchase/service billing | Customer/subscription/invoice identifiers, provider status, chosen currency/offer; no card fields entered into app database | Contract; specify actual statutory duties separately | Stripe, signed webhook events, DB/hosting. Stripe roles differ by purpose. | Paid period preserved; deletion resolves pending checkout/renewal first. Stripe records, accounting duties and backup retention unresolved. |
| Legal evidence / disputes | Exact versions/copies/hashes; Terms acceptance, privacy acknowledgment, server times, locale/product/platform; no new raw IP or UA collection | Contract and assessed dispute interest; identify particular legal duties where applicable | DB/hosting; user downloads | Evidence immutable while retained. Currently cascades with user deletion. Mandatory retention exception/period must be implemented if review requires it; not indefinite by default. |
| Unfinished signup | Bound provisional agreement and prospective ID; no active account implied | Pre-contract; bounded abuse/retry assessment | DB/hosting | Cleanup removes choices/reservations after proof expiry + 24 h via protected job. Email attempt metadata remains subject to separate review. No fake completed acceptance. |
| Support / rights / complaints | Information voluntarily sent to confirmed mailbox; diagnostics if supplied | Necessary contract support or assessed legitimate interest; rights duties where applicable | Confirmed mailbox vendor not verified; no ticket backend assumed | Receiving mailbox, request tracking, deadlines/verification and retention not checked. Never require paid access for rights. |
| Regional price suggestion | Trusted coarse hosting country header; fixed price mapping PL/GB/US/other; no stored country in endpoint | Necessity/bot/storage review; do not infer residence or governing law | Hosting ingress; read-only app endpoint | GET no-store, no new cookie/write; hosting IP/log practices need verification. |
| Internal reminders | Existing owned records and saved reminder/timezone/quiet-hour preferences | Requested service, necessity review | App/DB only for current product reminders | Dynamic current notices; no policy-message read state or marketing enrollment is inferred. |

Financial records are sensitive private information but not automatically GDPR Article 9 categories. Fitness/pain/reflection content may reveal health information depending on use. **New sensitive collection is a launch blocker** until purpose, Article 6 basis, any Article 9 condition and safeguards are reviewed. If explicit consent is chosen, a specific feature-level control and withdrawal path must be implemented; the registration checkbox cannot satisfy it. This update preserves existing Gym functionality rather than claiming the missing health workflow exists.

## Recipient and international-processing audit

| Integration actually present | Actual flow | Unresolved facts |
| --- | --- | --- |
| Neon/PostgreSQL | Account/auth/module/evidence storage, authenticated queries | Region, access, DPA/subprocessors, backups/restore/deletion, transfers |
| Vercel | Configured production origin/hosting target; coarse country header trusted only on Vercel | Actual deployed project, region/logging/analytics configuration, contracts, subprocessors/transfers |
| Better Auth | Installed backend library, password/session database adapter; not a claim of a separate hosted auth processor | Deployment security/retention configuration |
| Resend | Verification/recovery/security messages and signed outcomes; encrypted app outbox | Provider role/region, DPA/transfer terms, message/log retention |
| Stripe | Existing annual checkout/customer/subscription/portal, invoices and signed webhook reconciliation | Merchant identity, tax, separate controller/processor roles, required billing records, markets/transfer terms |
| Cloudflare Turnstile | Bot-protection script on identity forms, server action/hostname check | Necessity/storage/role/region assessment; not an analytics-consent replacement |
| Have I Been Pwned | Server password breach check sends padded hash prefix, not plaintext | Recipient terms/role/transfer/retention assessment |
| CoinGecko / Yahoo Finance | Server market symbol/coin-ID requests; app does not add account names/email to these queries | Service terms/roles/network logs/regions |
| Support mailbox | User-initiated mailto; existing support-mf fallback | Owner's confirmed contact/vendor, receipt and complaint handling |

No claim of EU-only storage, signed SCCs/DPA, universal adequacy or end-to-end encryption is justified by source code. Review actual transfers and access to safeguards under [EDPB international transfers](https://www.edpb.europa.eu/sme/be-compliant/international-data-transfers_en).

## Browser technologies

Source inventory: Better Auth session cookies; `b1-mail-proof` HttpOnly/SameSite strict cookie (24-hour cookie maximum, shorter actual code validity); next-themes theme localStorage; sidebar preference cookie where that reusable component is mounted; Finance device-local ordering/category pagination state; Momentum storage-change signal. Landing demo state is component-local. No advertising/analytics SDK was found in the inspected application, but deployment tags/logging are **Not checked**.

Policy readers load local components and do not load Turnstile, market widgets, billing scripts or authenticated account projection. Registration/recovery intentionally mount the existing bot script. Registration acceptance does not authorize optional cookies. Audit actual deployed storage/lifetimes and exemptions under [Your Europe online privacy](https://europa.eu/youreurope/business/growing/digitalising/online-privacy/index_en.htm). No decorative consent banner or new tracker was added.

## Consumer rights, confirmation and existing users

The current offer is 40 PLN, 10 GBP, 10 USD or 10 EUR per year, read from configuration. Default explicit 14-day trial has no card and does not auto-start during signup. Elective annual checkout charges now; renewal is on unless canceled. Provider-confirmed paid-through access remains after turning renewal off. Signup, cancellation of renewal, withdrawal, remedies/refunds and account deletion are separate.

Qualified review must establish controller/operator/markets, formation, conformity/remedies, fair change clauses, applicable withdrawal/early-performance rules, complaint handling and dispute routes. See [online contracts/confirmations](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/ecommerce-distance-selling/index_en.htm), [fair consumer terms](https://europa.eu/youreurope/business/selling-in-eu/consumer-contracts-guarantees/consumer-contracts/index_en.htm), [UOKiK withdrawal information](https://prawakonsumenta.uokik.gov.pl/prawo-odstapienia-od-umowy/) and [Commission Consumer Rights Directive](https://commission.europa.eu/law/law-topic/consumer-protection-law/consumer-contract-law/consumer-rights-directive_en). Do not treat recurring SaaS as a downloaded file or insert blanket withdrawal/loss-of-rights consent at registration.

[Directive (EU) 2023/2673](https://eur-lex.europa.eu/legal-content/en/ALL/?uri=CELEX%3A32023L2673) introduces the online withdrawal function with measures applying from 19 June 2026. **Current national enactment/applicability is Not checked**, not certified: the official Polish [government project page](https://redakcja.www.gov.pl/web/premier/projekt-ustawy-o-zmianie-ustawy-o-prawach-konsumenta-oraz-ustawy-o-konsumenckiej-pozyczce-lombardowej) found during this review describes proposed legislation, not proof of an enacted law. Verify current legislation and launch markets before opening purchases.

**Blocked:** no implemented submitted-and-retained withdrawal function or reviewed durable confirmation/mandatory notice delivery channel. The draft contains a proposed model notice and an honest mailto explanation; there is no fake submit button. Exact user-initiated JSON contract downloads work but are not automatically adequate contract delivery; neither an editable webpage nor a Stripe receipt is presumed sufficient. This task adds no legal-email sends. Only set purchase readiness after those dependencies are actually resolved, including narrow implementation/authorization for necessary delivery if required.

**Blocked:** material-revision notices and any required existing-user reacceptance consequences are not implemented/approved. No persistent legal inbox existed to reuse. Reading an existing internal notice does not count as agreement. Do not use the initial publication tool to impose a material revision on existing paid customers; implement the reviewed notice/choice workflow first. Keep unsaved workout progress, security, cancellation, export and deletion available. Existing accounts show an honest absence of historical acceptance; they are not backfilled. Cosmetic/new privacy-notice versions must not imply consent to a new purpose. New purpose-specific processing needs its own valid choice/basis.

Rights routes: existing owned export and password-confirmed deletion remain available; contact route must be verified by operator. Review access/correction/restriction/portability/objection procedures and applicable exceptions/deadlines using [EDPB individual rights](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en) and the [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng). Do not promise instant deletion from every backup/provider or enforce payment as a prerequisite.

## Review and publication procedure

Run from repository root with Node and installed `tsx`. The dedicated additive migration avoids replaying the repository's historically inconsistent migration journal. Do not use schema push as a replacement for the trigger installation.

```powershell
node --import tsx scripts/legal-documents.ts migrate --apply
node --import tsx scripts/legal-documents.ts draft --out legal-review
```

1. Fill verified `.env` operator facts; regenerate into a new review directory or edit exported JSON. Review source drafts at `lib/legal/drafts.ts`. `legal-review/` is gitignored because it can contain private review/business facts.
2. Resolve every bracketed marker and legal/process dependency. Set a **new** version/ID and genuine effective/updated dates. Terms' incorporated `offer` is frozen, not rendered from changing config. Keep exact dates/copy together. Confirm no prior approved external policy was overwritten; currently `POLICY_*` URLs are blank. Previously configured external URLs remain linked separately for migration/review.
3. Stage each immutable draft with `stage --document legal-review/terms.json` and the privacy equivalent. Same ID with changed content fails; use a new version.
4. Obtain a real qualified review, then record it with `approve --id <id> --review <file>`. The review JSON requires `decision: "approved"`, real `reviewer`, UTC `reviewedAt`, `changeSummary`, `reacceptance: "none"` or `"notified-contractual-review"`, `purchaseReady` and explicit checks for `operator`, `lawfulBases`, `healthData`, `processorsTransfers`, `retention`, `cookies`, `marketsConsumerRights`, `withdrawalFunction`, `durableConfirmation`, `existingUsers`. A template/test fixture is **not approval**. Set `purchaseReady: false` while purchase obligations remain unresolved. Approval/publication tools reject incomplete placeholders. No command performs legal review.
5. Publish only an approved compatible effective pair: `publish --terms <terms-id> --privacy <privacy-id>`. Updates active pointer atomically and retains old copies/metadata. The tool sends no messages. Plan reviewed communication and consumer remedies before later material revisions.
6. Verify deployment migration, protected worker scheduling, actual providers/mailbox/retention/backup restore and feature-level obligations. Live Stripe merchant/tax/prices/signed webhooks/portal checks remain separate; accepting signup never satisfies them.

Production never serves draft placeholders: `VERCEL_ENV=production` unconditionally disables draft fallback. Nonproduction shows clearly marked drafts. `LEGAL_DRAFT_PREVIEW=true` permits a localhost production-build preview only; it does not publish or unlock signup. Public `/api/public/legal` returns only approved published effective references or `null`, with no-store headers. Missing DB/schema/hash integrity fails closed for new activation/purchase without disabling existing security/support/rights.

Evidence retention currently allows deletes through owned account cascade and provisional cleanup, not arbitrary edits. If mandatory retention is selected, implement the reviewed exception before approval. The authenticated job at `/api/account/jobs` includes cleanup; no scheduler is created by this task.

## Validation record

Automated and browser check results are recorded after execution below. Any skipped real signup/provider check must remain explicit. Tests use fixtures/isolated database schema and never publish fictitious policies to public tables or send mail/charge Stripe.

- **Verified:** dedicated additive migration installed in the configured database; no policies approved/published and no acceptance backfill. Editable `legal-review/terms.json` and `privacy.json` exported locally.
- **Verified:** 230 unit/component/boundary tests passed; 15 isolated PostgreSQL checks passed, including concurrent choices/accounts/purchases, version-change races, identity/credential-transaction rollback, immutable history, owner isolation and account cascade.
- **Verified:** TypeScript check and production build completed successfully. ESLint had zero errors and one existing warning in `app/not-found.tsx:14`.
- **Verified:** actual public development Privacy/Terms pages load, table-of-contents navigation works, mobile 390 px reader has no horizontal overflow and no external script URLs. A separate production server correctly shows publication-pending status instead of draft notes.
- **Verified:** document attachment downloaded through the browser; parsed Terms version `2026-10-03-draft.1`, ten sections, explicit draft flag and SHA-256 metadata. Signup policy links have `_blank` targets and preserve the form; checkbox remains unchecked and verification is disabled without a published bundle. Keyboard Tab moves between legal links and mobile signup has no horizontal overflow.
- **Not checked:** real provider-delivered signup / live Stripe purchase / legal approval and production deployment. New real accounts cannot activate while documents are unpublished. No mail, charge or mass notice was sent.
- **Environment limitation:** the temporary local production server could not reach the external authentication database under the network sandbox. Its public publication gate was verified, but authenticated production-server journeys were not verified in that run. Database integration checks were executed separately with network access in an isolated schema.

## Explicit local test-account setup — October 3, 2026

At the operator's explicit request, the existing `test@test.com` account's `email_verified` flag was set to true. Its existing ID, password and owned records were preserved. `scripts/enable-test-account.ts --apply-development-setup` is restricted to the localhost development configuration and this single existing address; it creates no account and cannot run in production/Vercel.

The additive `0023_development_account_setup.sql` table stores the requested positive Terms/Privacy draft acknowledgments, frozen draft copies, server timestamp and operator-request provenance under `environment=local-development` and `bindingAcceptance=false`. These test records are separate from `b1_legal_acceptances`; no published-document acceptance, real email-proof event or policy approval was fabricated. Authentication/publication/checkout do not read the test setup table. The row cascades with owned account deletion.

The local development server was restarted with database network access, and the browser displayed the authenticated test account with **Verified email**. No credential was read or changed. A direct password-hash diagnostic was rejected by automatic approval review and was abandoned; verification used the ordinary browser account flow instead.

The landing carousel now reserves the longest caption's natural height, so every scene uses the same image frame without truncating text. Browser measurements of all five scenes showed identical frame and hero heights at desktop and 390 px phone widths, with no horizontal overflow. TypeScript and targeted ESLint completed successfully; 35 relevant landing/legal/account tests passed. The earlier production-build result above predates this small carousel/test-setup update; no new production build was run for it.
