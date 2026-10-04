# ManForth internal inbox

The authenticated header contains one bell linking directly to
`/account/notifications`. Public headers have no private inbox. There is no bell
popover or message modal. The page lists unread messages only, with pagination.
Visiting the page alone does not mark messages read.

Opening a message displays its full text inline on the same page and explicitly
saves `read: true`. After server confirmation, the shared list removes its card
and the badge decreases immediately. The selected text remains readable inline,
with a **Read** status. Related Events/Gym/Momentum records have a separate link.
Mark read, Archive and Mark all read also save to the backend. Read history is
retained in storage but is not shown as inbox cards or offered as an All filter.

The bell and page use one provider/cache, one refresh cycle and one write lock.
There are no parallel page/bell lists. Failed writes retain unread state and show
Retry; a confirmed write remains applied even if its follow-up refresh fails.

## Reuse and files

The feature reuses Better Auth, `requireUserId`, Neon/account settings, the
existing quota service and protected account job. UI uses the existing Button,
Next Link, Lucide icons, typography, rounded surfaces, theme
variables `primary-plus` (blue) and `primary-minus` (orange). There are no new
packages, assets, push permissions or messaging providers.

- `lib/notifications/types.ts`: versioned contracts and structured targets.
- `lib/notifications/produce.ts`: pure clock-controlled domain evaluation.
- `lib/notifications/store.ts`: scoped persistence, reconciliation and operator publication.
- `lib/actions/notifications.actions.ts`: authenticated web operations.
- `app/components/notifications`: provider, bell, list, history and skeleton.
- Account settings: internal categories and existing reminder quiet hours.
- Events/Gym timing editor: Off / 10 / 30 minutes before; Off is initial.
- Momentum destination handling: owned goal/journey anchors, review tab/week.

## Database and migration

Run from the existing app directory, with its existing `DATABASE_URL`:

```sh
npm run notifications -- --migrate
```

`lib/db/0024_internal_inbox.sql` is an additive, transactional, re-runnable
migration. It adds `b1_inbox_state`, `b1_notifications`, `b1_app_messages`, indexes
and transactional source triggers. The configured development DB migration was
applied during implementation. Apply the same file to other deployments before
serving the new code. No schema push is needed. Existing source records, prices,
legal acceptance, credentials and language-product membership are untouched.

Recipient rows have account foreign keys with deletion cascade, a fixed
`b1-way-personal` product scope, unique recipient/product/dedup identity,
schema version, structured target, source generation, revision, availability,
publication, expiry, invalidation and independent read/archive state.

Storage is the existing **Neon PostgreSQL database**, configured server-side by
`DATABASE_URL`; notification content/read state is not stored in localStorage.

| Table | Purpose |
| --- | --- |
| `b1_notifications` | Per-user inbox rows, scoped by `user_id` and `product`. `read_at IS NULL` means unread; a read stores a UTC timestamp and increments `revision`. `archived_at` hides a dismissed row. |
| `b1_app_messages` | Full server-published announcement content, referenced by recipient inbox rows. |
| `b1_inbox_state` | Per-user reconciliation progress, source revisions and refresh lease. It prevents duplicate or stale generated messages. |
| `b1_account_settings.notifications` | Each user's enabled categories and quiet-hour preferences. |

Read messages stay in the database. Reconciliation preserves their read status.
Browser memory caches only the current account's unread list and clears it on
logout/account switch. Other tabs refresh after a broadcast; other devices
converge on focus, manual refresh or the visible polling cycle.

Source triggers bump a durable generation in the same transaction as a saved
source change, and immediately withdraw/redact affected copies. Reconciliation
claims a short per-account DB lease, reads a consistent source snapshot and
applies it only if the source generation and lease still match. Failed
post-commit evaluation does not turn a successful workout save into a failure;
app entry/focus/polling or the existing worker retries it. State changes use
explicit desired values and revision comparison. Exact retries are idempotent;
conflicting stale changes require refresh. Reading never changes source activity.

## Actual source hooks

| Source | Saved messages and invalidation |
| --- | --- |
| Events (`user_events`) | Explicit timed reminder, canonical event ID. Completion/deletion/week changes withdraw it. Preset rows are excluded. |
| Gym (`gym_plans`, `gym_sessions`) | One reminder per plan ID, including its derived Events card. Active or completed session cancels that reminder. Actual saved completion creates one session message; confirmation without measurements says so. |
| Momentum (`momentum_state`) | Current actual goal period attained, real chapter/journey criteria, explicit goal reminders and current weekly-review availability. |
| To-Do (`kanban_board`) | Durable invalidation/recalculation of supporting Momentum criteria; no message per checkbox. |
| Account settings | Re-evaluates reminder preferences, timezone and week-start; preserves published history. Future announcements are suppressed when product updates are disabled. |
| Published app message | Protected server-only operator service, fixed product scope and explicit recipients. No public creation endpoint. |

Existing server domain actions also invoke the evaluator after successful
commits. Database triggers cover legacy writers and missed hooks. Template-only
edits do not create completion records. Reading, dismissing or archiving never
completes a task, event, workout or goal.

Reminders evaluate real local dates/times in IANA zones and store UTC instants.
Untimed records get no reminder. Pending evaluation is limited to upcoming
48-hour occurrences; availability is the selected lead time, expiry is the
event start. No late starts-soon messages are published. DST gaps are skipped;
folds choose the first matching instant. Calendar days use existing utilities.
Quiet hours suppress due reminder occurrences, not completed workout history.
Weekly review is available from 18:00 on the last day of the user's week until
the next local week begins, and is withdrawn when that review is submitted.

Completion catch-up is restricted to records after inbox initialization and a
seven-day recency window. Existing old achievements are recorded as suppressed
baseline identities on first reconciliation. Re-enabling a category does not
resurrect suppressed occurrences or replay old daily prompts. Edits preserve
notification identity/read state; corrected criteria withdraw unsupported wins.

## Publication and designated development test

Set `NOTIFICATION_OPERATOR_IDS` to explicitly authorized **existing account IDs**.
Empty disables ordinary operator publication. Only this server-only command can
publish; browser clients cannot choose recipients or create arbitrary messages.

```sh
npm run notifications -- --publish path/to/message.json
```

Example file, with actual operator and recipient IDs supplied by the operator:

```json
{
  "id": "0c1f14e5-e48d-4a53-b48c-ed0e88d6edb1",
  "product": "b1-way-personal",
  "actor": "AUTHORIZED_EXISTING_ACCOUNT_ID",
  "recipients": ["EXISTING_MANFORTH_RECIPIENT_ID"],
  "title": "Published release note",
  "body": "The actual release details in plain text.",
  "availableAt": "2026-10-03T12:00:00.000Z",
  "expiresAt": null,
  "target": null
}
```

One recipient record per published announcement UUID is retained across retries.
Content/publication for an existing UUID stays immutable; use a fresh UUID for a
different release. Recipient membership/settings scope and deletion tombstones
are checked. Null target opens full announcement details. Other supported
targets must still pass the destination's existing account/source authorization.
Plain text only; never include tokens, passwords, OTPs or payment credentials.

```sh
npm run notifications -- --test
```

This explicit test command requires localhost:3000, non-production, non-Vercel,
and exactly one existing `test@test.com` account. It publishes a clearly labelled
development message only to that account, with a stable UUID for retry safety.
It creates no account, source completion, email or push, and only grants the
designated account operator authorization inside that CLI process. It cannot
run through a web endpoint. A test message was published and used for browser
verification during implementation.

`npm run notifications -- --test-reset` applies the same development guards
and restores only this designated test message to available/unread, useful
after testing its archive action. It never restores other history.

## Refresh and deployment limits

The client reconciles on authenticated entry, focus/reconnect and
a 60-second visible-page cycle, with single-flight requests and backoff up to
five minutes. Hidden pages stop requests; logout/account switch discards private
cache and old responses. Same-browser tabs broadcast state changes; separate
devices converge on focus/refresh or polling. Failed loads show unknown or
explicitly last-known counts/content. Failed writes retain saved state with Retry.

The existing protected `POST /api/account/jobs` calls the same evaluator for up
to 20 previously initialized account inboxes, ordered by last check. Its existing
`CRON_SECRET` authorization is retained. No new scheduler is installed. If the
deployment already schedules this endpoint, reconciliation also runs there;
otherwise active app use supplies reconciliation. The worker is bounded, so
large deployments may need more frequent existing job invocations.

These are **internal messages only**. There are no email/push calls or permission
prompts, sounds or constant bell animations. A closed browser does not alert,
and this release makes no exact-time phone alarm promise. Existing authentication,
security and approved payment-provider delivery are independent and unchanged.
Legacy reminder-email enqueue/worker suppression remains; migration cancels
only pending ManForth legacy reminder IDs, not shared auth/security queues.

There is no administrator publishing UI, native client, realtime subscription,
trial/billing alert producer or Finance/Investments message producer in this
release. Those categories are not presented as integrated settings.

## Future mobile service contract

Current web transport uses authenticated Next Server Actions. Native clients
would need a thin authenticated HTTP adapter calling the same services; no
native transport is claimed to exist now.

- `getNotifications({filter: "all" | "unread", cursor: null | opaqueCursor})`:
  latest 20 eligible rows, next cursor, full eligible unread count, as-of instant,
  locale/timezone. Chronology is `(publishedAt, id)` descending. Reads are pure.
- `changeNotificationState({id, revision, read: true|false})` or
  `{id, revision, archived: true|false}`: exactly one explicit state field.
- `readAllNotifications()`: a single server statement snapshots **availability**;
  future messages remain unread even if their source row was created earlier.
- `reconcileNotifications()`: separate protected write operation, never a GET side effect.
- `getNotificationDetail(id)`: account-owned message and full announcement text.
- `saveAccountSettings`: existing revisioned preference operation.

Recipients always derive from the trusted session; client-supplied `userId` is
not accepted. Mutations use origin validation plus existing quotas. Private
payloads/counts are not shared-cacheable. Read/preferences remain usable for
expired memberships; source actions retain their existing entitlement checks.
Targets are discriminated `event`, `workout`, `goal`, `journey`, `review`,
`account`, `announcement` objects, mapped separately to web/native destinations.

## Executed verification

- Current full regression suite: **373 tests passed**, zero failures/skips.
  Includes 20 notification producer/UI checks and 7 SQL integration checks.
- UI tests cover direct bell navigation, unread-only cards, inline reading,
  failed save/retry, a failed refresh after a confirmed read, repeated clicks,
  stale responses, unread pagination, mark-all, hidden pages and logout guards.
- `tests/notification-sql.test.mjs` executes the actual inbox migration and
  repository queries using disposable PGlite PostgreSQL. Checks read timestamps,
  revision changes, persistence, ownership, pagination, exact retries, stale
  conflicts, preserved read history during reconciliation, archive and mark-all
  excluding future messages. No configured application database is used.
- `tsc --noEmit`, full ESLint and production build: passed.
- Actual local app with its configured Neon backend: keyboard bell activation
  opened the page directly; the existing designated `test@test.com` fixture
  changed from 1 unread to Read/0 unread on opening; reload preserved Read and
  showed no unread card. No email, push or new source activity was created.
- Desktop and 390px phone layout verified: no modal, no horizontal overflow.
  Screenshots: `docs/qa-artifacts/notifications-inline-read.jpg` and
  `docs/qa-artifacts/notifications-phone.jpg`. Temporary viewport was reset.

The older isolated Neon integration script was not rerun for this UI update:
`QA_DATABASE_URL` / `QA_DATABASE_ISOLATED` are not configured in the web `.env`.
Disposable PostgreSQL tests and the designated local browser fixture were used
instead. The script's dedicated-database guard remains intact.

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
Run `npm run test:notifications:db` explicitly with DB access for disposable
integration fixtures. It never writes public user/source records or email queues.
