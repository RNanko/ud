# Momentum

Route: `/account/momentum`. Today, Journeys, and Weekly Review share the existing account shell, Gym form/dialog primitives, Finance selector, Radix tabs, Framer Motion, and Monday-based date-only week utilities. No new dependencies, authentication system, external content feed, or analytics were added.

## Setup

The existing `DATABASE_URL` is required. `lib/db/0020_momentum.sql` and its Drizzle snapshot/journal entry add one account-owned JSONB record with a revision and retry identifiers. Fresh installations can apply the existing Drizzle migration chain. For an existing installation where prior tables were applied manually, run:

```sh
node scripts/migrate-momentum.mjs
```

The additive setup was executed successfully against the configured development database. It does not modify existing source records. Its user foreign key cascades on account deletion.

## Storage and integration

- Daily selections store stable source references, optional reasons and estimates, not copied completion flags. Tasks are read from the owned board. Workout plans resolve to their linked session when one exists. Events use both week and occurrence ID. Gym projections are excluded from the manual-event feed, so the same workout appears once.
- Task creation/completion/rescheduling uses the existing To-Do compare-and-swap writer. New To-Do completions retain UTC completion timestamps; older undated completions remain undated. Event and workout editing, attendance, rescheduling, and logging open their existing interfaces through deep links. No elapsed event time is treated as attendance.
- Journeys snapshot editable template chapters and version metadata. Linked chapter progress resolves against current source evidence. Unlinked criteria can be explicitly user-confirmed. Pausing, archiving, or removing a journey never deletes linked activities. Milestone identifiers contain no copied source titles and are deduplicated; reopened/deleted evidence stops contributing to current progress.
- Focus sessions use UTC intervals, an intended local date, and timezone. Closed intervals and planned duration cap elapsed time. One unfinished timer is permitted per account. Revision checks serialize concurrent tab/device edits; bounded retry identifiers make ambiguous retries idempotent. Pause, refresh, background sleep, explicit extensions, duration corrections, and separate task completion are supported. The account-wide indicator links back to the current timer. Saved logs can be corrected in Weekly Review.
- Weekly reviews preserve personal reflections and an as-of generated summary. An explicit refresh saves a new summary version. Older source corrections do not silently rewrite saved reflections. Cardio activity types remain separate; quick workout confirmation contributes no fabricated performance metrics.
- Money is opt-in. Savings use exact minor units for PLN/EUR/USD/GBP, JPY, and KWD. Opening balance plus contributions minus withdrawals determines allocation, separately for each goal and currency. Unique allocation references prevent reusing an allocation across goals; split amounts must be explicitly recorded with distinct references. Edits/removals recalculate balance. Journal entries do not transfer funds.
- Momentum JSON export and confirmed clearing are in Customize. Clearing keeps source tools untouched. The application currently has no unified account export/delete UI to extend; account deletion at the auth/database layer cascades the new record.

## Boundaries

There is no course library or licensed reader; learning/reading use user-chosen tasks, focus logs, and personal confirmation. To-Do does not have recurring occurrences. Finance has no currency metadata, so Momentum links to actual Finance records without inventing currency totals, savings, or returns. Investment holdings remain in Investments; no contribution history or bank/broker connection is inferred. Account display units are unchanged; optional review distances are explicitly labeled in canonical km.

Monday is the existing application's week-start convention; no configurable week-start preference exists. Server reads enforce ownership. Polling (30 seconds), focus/visibility refresh, and cross-tab signals re-read canonical sources, without requiring both source and Momentum pages to be mounted. Revision conflicts require reload rather than overwriting newer changes. Source actions and selection writes are separate idempotent steps: if selection saving fails after task creation, the task remains in To-Do and the same ID can be retried.

No browser/device activity monitoring or automatic source completion is used. A corrected logged focus duration cannot exceed the timestamped elapsed interval. This first release uses a bounded JSONB record rather than a separate table per card; limits are enforced before writes (100 journeys, 5,000 focus sessions, 1,000 reviews, 100 savings goals).

## Validation

Domain/server tests cover owner isolation, daily thought stability, DST/year boundaries, canonical task writes, one unfinished timer under concurrent writes, paused/extended/corrected intervals, source deduplication, historical workout dates, explicit event confirmation, live chapter evidence, milestone deduplication, saved review versions, exact money parsing, allocation duplication, date validation, and failed-save retry. The existing Gym, Events, Finance, Investments, and whole-card To-Do regression suite is retained.

Executed on October 3, 2026: `npm test` passed all 141 tests; `npm run lint` passed with no warnings; `npx tsc --noEmit` passed; `npm run build` completed successfully, including TypeScript and route generation. The build emitted the existing advisory about outdated baseline-browser-mapping data.

Browser checks exercised canonical task creation and separate completion, saved main selection, focus pause/resume/refresh/navigation recovery, the persistent account indicator, linked chapter progress, review draft reopening, and a savings contribution (100.10 PLN opening + 20.20 PLN = 120.30 PLN). The page was checked at a 390 × 844 viewport without document overflow, and keyboard arrow navigation between tabs worked. Reduced-motion and closed-panel keyboard isolation are covered by component tests. Disposable QA records were removed using exact IDs and compare-and-swap conditions; concurrent user records, preferences, and the user's active timer were preserved. These checks do not claim every possible browser/device journey has been exercised.
