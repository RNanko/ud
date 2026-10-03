-- Additive B1-Way personal-development launch. No existing identities or history are replaced.
CREATE TABLE IF NOT EXISTS b1_account_settings (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, product text NOT NULL,
 preferences jsonb NOT NULL, notifications jsonb NOT NULL, revision integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,product)
);
ALTER TABLE finance_table ADD COLUMN IF NOT EXISTS currency text;
-- Historical finance amounts have no recorded currency: remain NULL, never guessed or converted.
ALTER TABLE investment_positions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
CREATE UNIQUE INDEX IF NOT EXISTS user_events_owner_week_unique ON user_events(user_id,week);
-- Existing investment UI/provider contracts were explicitly USD; any existing currency column is preserved.
CREATE TABLE IF NOT EXISTS b1_memberships (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, product text NOT NULL,
 enrolled_at timestamptz, trial_started_at timestamptz, trial_ends_at timestamptz,
 customer_id text UNIQUE, subscription_id text UNIQUE, billing_currency text, price_id text,
 paid_confirmed boolean NOT NULL DEFAULT false, paid_through timestamptz, renewal_off boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'eligible', grace_until timestamptz, operator_review boolean NOT NULL DEFAULT false,
 checkout_id text, checkout_operation text, checkout_currency text, checkout_price text, checkout_lease timestamptz,
 checkout_expires timestamptz, last_synced_at timestamptz, sync_error text, PRIMARY KEY(user_id,product)
);
CREATE TABLE IF NOT EXISTS b1_rate_buckets (key text PRIMARY KEY, count integer NOT NULL, started_at timestamptz NOT NULL, expires_at timestamptz NOT NULL);
ALTER TABLE b1_memberships ADD COLUMN IF NOT EXISTS sync_lock text;
ALTER TABLE b1_memberships ADD COLUMN IF NOT EXISTS sync_lease timestamptz;
ALTER TABLE b1_memberships ADD COLUMN IF NOT EXISTS grace_period_key text;
CREATE TABLE IF NOT EXISTS b1_email_ledgers (
 recipient_key text NOT NULL, purpose text NOT NULL, sends integer NOT NULL DEFAULT 0,
 first_at timestamptz, last_at timestamptz, blocked_until timestamptz, active_attempt text,
 PRIMARY KEY(recipient_key,purpose)
);
CREATE TABLE IF NOT EXISTS b1_email_attempts (
 id text PRIMARY KEY, token_hash text NOT NULL UNIQUE, email text NOT NULL, purpose text NOT NULL,
 owner_id text REFERENCES "user"(id) ON DELETE CASCADE, old_email text,
 code_digest text NOT NULL, version integer NOT NULL DEFAULT 1, wrong_attempts integer NOT NULL DEFAULT 0,
 expires_at timestamptz NOT NULL, verified_at timestamptz, consumed_at timestamptz, user_id text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS b1_email_outbox (
 id text PRIMARY KEY, recipient_key text NOT NULL, scope text NOT NULL, kind text NOT NULL, payload text NOT NULL,
 status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, provider_id text,
 next_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), outcome text
);
CREATE INDEX IF NOT EXISTS b1_email_outbox_due ON b1_email_outbox(status,next_at);
CREATE TABLE IF NOT EXISTS b1_email_suppressions (scope text NOT NULL, recipient_key text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(scope,recipient_key));
CREATE TABLE IF NOT EXISTS b1_provider_events (provider text NOT NULL,event_id text NOT NULL,payload jsonb NOT NULL,status text NOT NULL DEFAULT 'pending',attempts integer NOT NULL DEFAULT 0,next_at timestamptz NOT NULL DEFAULT now(),lease_until timestamptz,error text,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(provider,event_id));
CREATE TABLE IF NOT EXISTS b1_recovery_claims (token_key text PRIMARY KEY,user_id text NOT NULL,purpose text NOT NULL,claimed_at timestamptz,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS b1_notification_receipts (user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,key));
-- No FK: this operational tombstone must survive identity deletion and delayed provider events.
CREATE TABLE IF NOT EXISTS b1_deletions (user_id text NOT NULL,product text NOT NULL,customer_id text,subscription_id text,status text NOT NULL DEFAULT 'pending',created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,error text,PRIMARY KEY(user_id,product));

ALTER TABLE b1_account_settings ADD COLUMN IF NOT EXISTS notification_checked_at timestamptz;
