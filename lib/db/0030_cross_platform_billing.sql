-- Additive cross-platform billing. Account trial and checkout stay in b1_memberships.
-- One row per verified subscription; provider is independent of client platform.
CREATE TABLE IF NOT EXISTS b1_billing_sources (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 product text NOT NULL, provider text NOT NULL CHECK(provider IN ('stripe','apple_app_store','google_play')),
 environment text NOT NULL CHECK(environment IN ('production','test','sandbox','unknown')),
 subscription_id text NOT NULL, processor text NOT NULL CHECK(processor IN ('stripe','revenuecat')),
 status text NOT NULL, provider_status text NOT NULL, confirmed boolean NOT NULL DEFAULT false,
 paid_through timestamptz, grace_until timestamptz, renewal_off boolean NOT NULL DEFAULT false,
 currency text, amount_minor bigint CHECK(amount_minor>=0), provider_product_id text, provider_price_id text,
 observed_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(provider,environment,subscription_id)
);
CREATE INDEX IF NOT EXISTS b1_billing_owner_product ON b1_billing_sources(user_id,product);
-- Existing records are preserved and explicitly unknown until provider verification.
INSERT INTO b1_billing_sources(user_id,product,provider,environment,subscription_id,processor,status,provider_status,confirmed,paid_through,grace_until,renewal_off,currency,provider_price_id,observed_at)
 SELECT user_id,product,'stripe','unknown',subscription_id,'stripe',CASE WHEN paid_confirmed THEN 'active' ELSE 'pending' END,status,paid_confirmed,paid_through,grace_until,renewal_off,billing_currency,price_id,COALESCE(last_synced_at,enrolled_at,now())
 FROM b1_memberships WHERE subscription_id IS NOT NULL ON CONFLICT DO NOTHING;
ALTER TABLE b1_provider_events ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'unknown';
-- New queue IDs include environment; old queue records remain processable.
CREATE INDEX IF NOT EXISTS b1_provider_events_due ON b1_provider_events(provider,status,next_at);
