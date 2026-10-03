-- Operator-requested local testing records, separate from real legal acceptance.
-- Application authentication, publication and checkout never read this table.
CREATE TABLE IF NOT EXISTS public.b1_development_account_setup (
 id text PRIMARY KEY,
 user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
 origin text NOT NULL CHECK(origin='http://localhost:3000'),
 environment text NOT NULL CHECK(environment='local-development'),
 email_verification_overridden boolean NOT NULL CHECK(email_verification_overridden),
 terms_acknowledged boolean NOT NULL CHECK(terms_acknowledged),
 privacy_acknowledged boolean NOT NULL CHECK(privacy_acknowledged),
 draft_documents jsonb NOT NULL,
 requested_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
