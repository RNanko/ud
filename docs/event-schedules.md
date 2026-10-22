# Event schedules

Configured application database verified on 14 October 2026. Shared Events and Gym migrations 0040–0044 remain installed. Existing events, schedules, workout plans and completed sessions are preserved.

## User flow

1. Events → Add event → **Repeat weekly**.
2. Enter title, category, color, first date, weekdays, optional end date, and optional time/reminder/notes.
3. Save the schedule. Each matching week projects the occurrences without inserting future Events rows.
4. **Schedules** in Events lists definitions and can stop new occurrences from tomorrow. Previous dates and individually saved/completed occurrences remain.

Completing, reopening, editing, moving, and removing a scheduled card affect that occurrence. Its original identity stays stable after moving, so it does not reappear on its original day. Ordinary one-off events and presets retain their existing behavior. Copying an occurrence into a preset removes its schedule identity.

## Storage and setup

- `lib/db/0040_event_schedules.sql`: additive owner-scoped definitions, touched occurrences, and durable operation receipts. Existing tables and user records are not dropped.
- `lib/events/recurrence.ts`: bounded pure projection, weekday/date validation, stable occurrence IDs.
- `lib/events/schedule-store.ts`: owner-scoped reads, compare-and-swap writes, and retry receipts.
- `lib/actions/event-schedules.actions.ts`: authenticated web actions.
- Events and Gym readers include the same projected records. Reminders use the schedule timezone and a bounded nearby-date window.

Audit the configured database without modifying it:

```powershell
node scripts/apply-event-schedules-schema.mjs
```

After verifying the deployment target, install the additive migration:

```powershell
node scripts/apply-event-schedules-schema.mjs --apply --expected-host=<verified-host> --expected-database=<verified-database>
```

The installer checks database identity and migration checksum. It does not generate future occurrence rows. On a database without this schema, saving a schedule reports the missing database update.

## Boundaries

The native mobile Events editor has not acquired a schedule-creation interface in this change. Mobile inbox target validation recognizes projected occurrences; mobile recurrence editing requires its own API/editor verification.

## Database maintenance

The retired goal integration was cleaned up on 14 October 2026: removed three obsolete financial-table triggers, five obsolete migration receipts and 71 legacy tags from eight Events boards. Events content, completion status, shared schedules, financial data and all other application records passed preservation checks. Normal Events revision and inbox hooks remain enabled. The shared 0043 checksum was aligned only after both installed workout functions matched the retained SQL. Recovery data and the concise verification report are stored in the ignored `migration-backups/` directory.

## Verification

`tests/event-schedules.test.mjs` exercises real recurrence projection and the real store against isolated PostgreSQL (PGlite): no writes on future reads, identity through moves, deleted/stopped occurrences, ownership, receipts, stale-write conflicts, retry after reopening, source range reconciliation, and cascading account deletion.

Existing planner/workout/background queue tests remain part of the regression suite. Temporary maintenance checks verified repeatable cleanup, exact numeric preservation, backup failure rollback, preservation-check rollback, database identity checks and rejection of changed shared functions.

## Release preparation — 22 October 2026

The configured application database passed the existing read-only schedule and Finance icon validators. The additive `0050_canonical_activity_creation.sql` and `0051_canonical_event_moves.sql` functions were installed with the existing database-identity and checksum checks before publishing the application update. Installation creates functions and migration receipts; it does not create, move or delete saved Events or workouts. The Finance icon installer normalizes trailing whitespace when checking its receipt, so its own validator remains authoritative for `0052`.

Release validation: all 682 tests passed with zero skips or failures, ESLint passed for application/source files, and the production build completed with TypeScript checks and all 43 prerendered pages. The full run also caught and verified the repair for the Finance background-save retry control. Network/provider writes and destructive account-history checks were not part of this test run.
