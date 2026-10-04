# Isolated stabilization verification

This setup is for a disposable **separate database**, not a new schema inside an unverified production database. No provider calls are made by the three database integration scripts. Do not use a real account or production credentials as a test fixture.

## Database gate

Set the following in a private ignored local environment after confirming the endpoint/database is disposable:

```dotenv
QA_DATABASE_URL=<separate disposable PostgreSQL connection>
QA_DATABASE_ISOLATED=true
```

`scripts/qa-database.mjs` rejects production runtime flags and the same host/database as `DATABASE_URL`, even with different credentials/query/schema settings. It never prints either URL. A URL check cannot prove ownership, a DNS alias or production status: operator confirmation remains necessary. Do not change `DATABASE_URL` just to evade this check. Empty QA variables are the safe default in `.env.example`.

The integration scripts copy compatible table structures from the test connection's `public` schema into uniquely named temporary schemas and remove only those schemas afterward. Thus the reviewed app schema must first be provisioned in that disposable database. Reconcile its migration history before using generic migration commands; do not replay unexplained old migrations. The existing internal-inbox migration was not applied by this audit.

```powershell
node scripts/check-account-integration.mjs --isolated
node scripts/check-legal-integration.mjs --isolated
node scripts/check-notification-integration.mjs
```

During this audit these commands exited 1 **before client creation** because the QA variables were absent. Their integration assertions have not passed in this audit. On interruption, remove only the exact audited temporary schema after confirming it belongs to this run and the disposable database; never enumerate and delete arbitrary schemas.

## Read-only integrity assessment

`docs/qa-integrity-dry-run.sql` is an optional count-only inspection, not a migration or repair. Run it only on the approved QA database with representative fixtures first. It opens a read-only transaction and rolls back; a missing table means schema setup is incomplete, not an empty/healthy result. Save only sanitized counts and query errors.

Do not add owner/week uniqueness while duplicate groups exist. Collect restricted per-record evidence separately, preserve full backups/schema/roles and provider state, decide an authoritative merge with the owner/operator, rehearse on a copy, then propose a separately authorized transactional repair. Do not pick a winner by first row, delete orphan actual history, infer missing currencies, fabricate acceptance or restart subscriptions. Existing suspicious data was not inspected or repaired in this audit.

## Browser/provider continuation

Use two new ordinary synthetic users and separate records on the approved QA database, plus an admin **only if** a real support/admin module is built. Use real domain/database behavior; mock external email/payment transport in ordinary runs. Configure dedicated nonproduction mail recipients and Stripe test customers/clocks only with explicit approval.

Execute journeys A–L from `qa-audit-report.md`: exact legal version/proof/activation/trial, scheduled + historical workouts, completion/reopen/date correction, cross-week CAS, filtered whole-card drag/refresh, preset retries/reapply, default-currency and USD records, focus, inbox two-client state, expired access/export/delete/late jobs, each annual price and provider lifecycle. Mark absent steps/support/snooze/automatic money links as Not implemented; do not fabricate mocks as product evidence.

Check real 360/390px phones, tablet/desktop, text zoom, keyboard/focus return, scrolling, long labels, missing assets, loading/save-failure/retry, light/dark and reduced motion. Measure query/list size and latency before choosing optimizations. Never run load/security probes on an unverified environment.

Normal final checks:

```powershell
node --test tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js .
node node_modules/next/dist/bin/next build
```

Test commands do not authorize deployment, live billing, legal publication or data deletion. There is no existing repository CI workflow to reuse; no new CI runner was introduced during this audit.
