-- Optional count-only QA inspection. NOT executed during this audit.
-- Requires an explicitly approved disposable DB with the reviewed schema.
-- No private record IDs, content, credentials or customer references are output.
BEGIN TRANSACTION READ ONLY;

SELECT 'todo_duplicate_owners' AS check_name, COUNT(*) AS groups
FROM (SELECT user_id FROM kanban_board GROUP BY user_id HAVING COUNT(*) > 1) AS conflicts;

SELECT 'event_duplicate_owner_weeks' AS check_name, COUNT(*) AS groups
FROM (SELECT user_id,week FROM user_events GROUP BY user_id,week HAVING COUNT(*) > 1) AS conflicts;

SELECT 'workout_duplicate_plan_sessions' AS check_name, COUNT(*) AS groups
FROM (SELECT user_id,plan_id FROM gym_sessions WHERE plan_id IS NOT NULL GROUP BY user_id,plan_id HAVING COUNT(*) > 1) AS conflicts;

-- A missing plan does not authorize deleting actual history.
SELECT 'sessions_missing_or_foreign_plan' AS check_name, COUNT(*) AS records
FROM gym_sessions s LEFT JOIN gym_plans p ON p.id=s.plan_id AND p.user_id=s.user_id
WHERE s.plan_id IS NOT NULL AND p.id IS NULL;

SELECT 'inbox_duplicate_owner_product_key' AS check_name, COUNT(*) AS groups
FROM (SELECT user_id,product,dedup_key FROM b1_notifications GROUP BY user_id,product,dedup_key HAVING COUNT(*) > 1) AS conflicts;

SELECT 'inbox_missing_identity' AS check_name, COUNT(*) AS records
FROM b1_notifications n LEFT JOIN "user" u ON u.id=n.user_id WHERE u.id IS NULL;

-- Legacy missing/unsupported currencies are preserved, not inferred or converted.
SELECT 'finance_unassigned_currency' AS check_name, COUNT(*) AS records
FROM finance_table WHERE currency IS NULL;

SELECT 'investments_legacy_non_usd' AS check_name, COUNT(*) AS records
FROM investment_positions WHERE currency IS DISTINCT FROM 'USD';

ROLLBACK;
