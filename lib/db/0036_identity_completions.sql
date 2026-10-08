-- Apply after 0021. Reservations deliberately precede signup identity creation.
-- They never contain plaintext passwords, reset tokens, or OTP codes.
CREATE TABLE IF NOT EXISTS b1_identity_completions (
 proof_kind text NOT NULL CHECK (proof_kind IN ('email','recovery')),
 proof_id text NOT NULL,
 owner_id text NOT NULL,
 purpose text NOT NULL CHECK (purpose IN ('signup','email-change','verify-account','recovery','migration')),
 request_key text NOT NULL,
 email text NOT NULL,
 old_email text,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','committed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 committed_at timestamptz,
 PRIMARY KEY(proof_kind,proof_id),
 CHECK ((status='committed') = (committed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS b1_identity_completions_owner_idx ON b1_identity_completions(owner_id);
-- No FK is possible while signup is reserved before its identity exists.
CREATE OR REPLACE FUNCTION b1_delete_identity_completions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM b1_identity_completions WHERE owner_id=OLD.id;
 RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS b1_identity_completions_delete ON "user";
CREATE TRIGGER b1_identity_completions_delete AFTER DELETE ON "user"
 FOR EACH ROW EXECUTE FUNCTION b1_delete_identity_completions();
