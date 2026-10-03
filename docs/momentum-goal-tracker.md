# Momentum Goal Tracker

The Goal Tracker is part of `/account/momentum`, below the daily mission/focus controls. It preserves Today, Journeys, Weekly Review, Recent Wins, existing tasks, the workout calendar and actual Gym logs. Nothing is seeded into real accounts.

## Reuse and setup

- Uses the existing blue/orange theme tokens, Momentum panels, Gym buttons/forms/dialogs/confirmation controls, FinanceSelect, Framer Motion and reduced-motion handling. No dependency or UI framework was added.
- Persists an optional `tracker` object inside the existing authenticated `momentum_state.data` JSONB document. Older documents work without it. The existing owner-scoped revision compare-and-swap writer, mutation IDs, retry handling, export and delete-all include this object.
- No new SQL migration is required for this add-on. A fresh installation still needs the existing Momentum, Gym and Events database schema and configured `DATABASE_URL`/authentication described in the app's existing setup.
- Events' three named week presets use an owner-scoped `user_events` document keyed `week-presets`. The old `default-WK` remains intact and is exposed as a saved week until the named collection is written. Individual event presets use the existing `event-presets` document.

## Sources and rules

| Metric | What counts | What does not count |
| --- | --- | --- |
| Minimum balance | A dated authoritative/opening balance in a named manual cash scope, plus later settled incoming/outgoing movements. A newer snapshot resets movements already included. Negative balances are preserved. | Investments, credit limits, pending/planned payments, automatic bank verification. |
| Savings allocation | Period contributions minus withdrawals in one existing Momentum savings pot. | Its opening balance or a general cash balance. |
| Completed sessions | Distinct canonical completed Gym session IDs on their actual workout date; explicitly confirmed quick completions count without fabricated metrics. | Active/planned workouts, an additional Events projection, or cardio inside the same session. |
| Training days | Distinct actual dates with completed Gym sessions. | Several workouts on the same date counted as several days. |
| Activities | Confirmed manual Events occurrences, optionally explicitly selected. | Gym-linked projections or an elapsed scheduled time. |
| Confirmed visits | One personally confirmed visit/group reference in a named manual activity scope. | Inferred venue, location monitoring, individual exercises counted as visits. |
| Activity minutes | Saved focus intervals tied to selected task/event/workout references or a linked journey, plus confirmed manual duration intervals in a selected activity scope. | Pauses, discarded/running/unsaved time, scheduled durations or task completion without actual time. |
| Investment contributions | Confirmed manual external contributions minus withdrawals in a named investment-account scope and one currency. | Opening value, trades, dividends, market gains, pending deposits or checked reminders. |

Cash and investment scopes are **manual recording**, not bank/broker connections. Finance transaction rows do not provide reliable account ownership/balance/settlement or transfer semantics, so they are not silently interpreted as a bank account. Recording does not execute a transfer or trade. Currencies remain separate; money uses integer minor units, with no invented exchange rate.

Record references are unique across manual sources and the existing savings allocation journal. For a split, explicitly record distinct portion references and amounts; no source bank transfer is inferred. Internal transfers entirely inside a named cash scope cancel out: record only money entering/leaving its boundary.

Time intervals are clipped to local calendar periods and unioned, so overlapping eligible intervals count once. A manual record explicitly linked to a timer never adds a second copy of its duration. Corrected focus durations are allocated to the earliest recorded active intervals. Removed source labels do not erase saved focus evidence; unavailable filters without evidence require an update.

## Dates, revisions, completeness and reminders

- Calendar weeks reuse the application's Monday-start date utility. No separate week-start preference currently exists. Goals retain their chosen IANA timezone; UTC occurrence timestamps and local date context are stored together. Timezone day boundaries handle 23/25-hour DST days. The local record editor rejects nonexistent spring-forward times; an ambiguous autumn time resolves to one UTC occurrence, which is shown in details/export.
- Weekly/monthly targets reset without carrying excess or shortfall forward. Creation explicitly chooses the chosen start date or includes the whole current calendar period; the target is never prorated. Ongoing/range goals have their own windows.
- Target/filter edits create current- or next-period rule revisions. Original calendar/timezone/start are preserved; create another goal to change them. Earlier definitions remain readable. Corrected/deleted actual records or reopened workouts rebuild evaluations and mark revised results. Saved written reviews and snapshots change only by explicit review refresh.
- Throughout-period balance rules require a baseline before period start, no recorded breach, and explicit checked coverage through the evaluated date. A last snapshot alone cannot prove full-month maintenance. Stale balances retain their amounts but show **Needs update**, not confirmed current attainment.
- Source loads fail honestly; missing sources are not converted to reliable zero. A successfully loaded source with no eligible recorded activity may show zero, with clear recording limitations.
- Reminder days/time and optional lead days are opt-in, displayed when opening Momentum. Snooze/dismiss receipts prevent repeated occurrences; attained periods suppress reminders and future periods resume. Balance reminders key off changed calculation state. No external notification delivery or scheduler is implemented.
- A threshold can be recognized once per goal/period. Withdrawals/corrections can bring a card below target again without a repeat award. Balance is a continuing condition and does not earn a permanently completed achievement.

## Privacy and controls

Money goals follow Momentum's Money preference, and their amounts are hidden by default, including the minimum embedded in rule text and financial progress graphics. Goals can be pinned, moved with accessible up/down controls, hidden, paused or archived. Details expose contributing records and period history.

Goal deletion removes its definition/history/reminders, not shared actual records. **Manage manual sources** keeps records available after a goal is deleted. Individual records can be removed with confirmation; an unused scope and its records can be deleted separately. Historical rule references protect a still-used scope. The existing full Momentum export/deletion includes all tracker data.

History backfills up to 120 periods when a goal is created and preserves already-recorded periods. Details show the latest 24; export contains retained history. Collection limits prevent an unbounded JSON document. Source corrections are checked on refresh, source-change notifications, focus/visibility return and relevant saves, rather than through a background synchronizer.

## Events presets

Save up to three named weeks. Preview and explicitly confirm replacement of a chosen slot; remove a slot before adding a fourth. Applying a selected preset uses the existing preview/application flow and stable operation IDs. It copies planned targets and timing only, not actual results, completion flags or timestamps. Individual event preset removal leaves scheduled events intact. Collection writes reject stale state and remain idempotent on retry.

## Verification

- Automated real-module tests cover balance arithmetic/negative values/snapshots/coverage/staleness, savings opening exclusion, canonical session/day counting, manual visits/ownership, focus union/splitting/DST, contribution reversals/period resets, rule revisions, refresh key ordering, reminder receipts, failure states, shared-record deletion/export and review windows.
- Preset tests cover the three-slot limit, replacement, retries, stale writes, owner isolation, legacy preservation and exclusion of actual workout results.
- Browser verification uses disposable, explicitly named QA goals/sources, which are removed afterward. No example financial transactions or completed workouts are added.
- Final executed command results are reported in the delivery message; production build emits the existing non-failing baseline-browser-mapping freshness notice.
