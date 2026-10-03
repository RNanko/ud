-- Additive personal-product legal evidence. No historical acceptance is backfilled.
CREATE TABLE IF NOT EXISTS public.b1_legal_documents (
 id text PRIMARY KEY, product text NOT NULL, locale text NOT NULL, kind text NOT NULL CHECK(kind IN('terms','privacy')),
 version text NOT NULL, content jsonb NOT NULL, content_hash text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','approved','published')),
 review jsonb, published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(product,locale,kind,version)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.b1_legal_active (
 product text NOT NULL, locale text NOT NULL,
 terms_id text NOT NULL REFERENCES public.b1_legal_documents(id), privacy_id text NOT NULL REFERENCES public.b1_legal_documents(id),
 statement_version text NOT NULL, statement text NOT NULL, purchase_ready boolean NOT NULL DEFAULT false,
 activated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(product,locale)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.b1_legal_signup_choices (
 id text PRIMARY KEY, attempt_id text NOT NULL REFERENCES public.b1_email_attempts(id) ON DELETE CASCADE,
 intended_user_id text NOT NULL, product text NOT NULL, locale text NOT NULL,
 terms_id text NOT NULL REFERENCES public.b1_legal_documents(id), privacy_id text NOT NULL REFERENCES public.b1_legal_documents(id),
 statement_version text NOT NULL, statement text NOT NULL, terms_accepted boolean NOT NULL CHECK(terms_accepted),
 privacy_acknowledged boolean NOT NULL CHECK(privacy_acknowledged), agreed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(attempt_id,terms_id,privacy_id,statement_version)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.b1_legal_signup_reservations (
 attempt_id text PRIMARY KEY REFERENCES public.b1_email_attempts(id) ON DELETE CASCADE,
 intended_user_id text NOT NULL UNIQUE, choice_id text NOT NULL REFERENCES public.b1_legal_signup_choices(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.b1_legal_acceptances (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE, product text NOT NULL,
 context text NOT NULL CHECK(context IN('registration','purchase')), locale text NOT NULL,
 terms_id text NOT NULL REFERENCES public.b1_legal_documents(id), privacy_id text NOT NULL REFERENCES public.b1_legal_documents(id),
 terms_hash text NOT NULL, privacy_hash text NOT NULL, statement_version text NOT NULL, statement text NOT NULL,
 terms_accepted_at timestamptz NOT NULL, privacy_acknowledged_at timestamptz NOT NULL, associated_at timestamptz NOT NULL DEFAULT now(),
 platform text NOT NULL DEFAULT 'web' CHECK(platform='web'), receipt jsonb NOT NULL,
 UNIQUE(user_id,product,context,id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.b1_legal_purchases (
 operation text PRIMARY KEY, user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
 product text NOT NULL, terms_id text NOT NULL REFERENCES public.b1_legal_documents(id), privacy_id text NOT NULL REFERENCES public.b1_legal_documents(id),
 currency text NOT NULL, amount integer NOT NULL, price_id text NOT NULL, receipt jsonb NOT NULL, presented_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.b1_legal_document_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.content IS DISTINCT FROM NEW.content OR OLD.content_hash IS DISTINCT FROM NEW.content_hash
 OR OLD.id IS DISTINCT FROM NEW.id OR OLD.product IS DISTINCT FROM NEW.product OR OLD.locale IS DISTINCT FROM NEW.locale
 OR OLD.kind IS DISTINCT FROM NEW.kind OR OLD.version IS DISTINCT FROM NEW.version THEN
  RAISE EXCEPTION 'Legal document contents are immutable: create a new version';
 END IF;
 IF OLD.status='published' AND (NEW.status<>'published' OR OLD.review IS DISTINCT FROM NEW.review OR OLD.published_at IS DISTINCT FROM NEW.published_at) THEN
  RAISE EXCEPTION 'Published legal metadata is immutable';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS b1_legal_document_immutable ON public.b1_legal_documents;
--> statement-breakpoint
CREATE TRIGGER b1_legal_document_immutable BEFORE UPDATE ON public.b1_legal_documents FOR EACH ROW EXECUTE FUNCTION public.b1_legal_document_immutable();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.b1_finalize_signup_legal() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE r b1_legal_signup_reservations; c b1_legal_signup_choices; a b1_legal_active;
 t b1_legal_documents; p b1_legal_documents; e b1_email_attempts;
BEGIN
 SELECT * INTO r FROM b1_legal_signup_reservations WHERE intended_user_id=NEW.id FOR UPDATE;
 -- Other B1-Way products and existing users are not reinterpreted.
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT * INTO c FROM b1_legal_signup_choices WHERE id=r.choice_id;
 SELECT * INTO e FROM b1_email_attempts WHERE id=r.attempt_id;
 SELECT * INTO a FROM b1_legal_active WHERE product=c.product AND locale=c.locale FOR SHARE;
 SELECT * INTO t FROM b1_legal_documents WHERE id=c.terms_id;
 SELECT * INTO p FROM b1_legal_documents WHERE id=c.privacy_id;
 IF e.purpose<>'signup' OR e.owner_id IS NOT NULL OR lower(e.email)<>lower(NEW.email)
 OR e.user_id<>NEW.id OR e.verified_at IS NULL OR e.consumed_at IS NULL OR e.expires_at<=now()
 OR c.product<>'b1-way-personal' OR c.locale<>'en' OR NOT c.terms_accepted OR NOT c.privacy_acknowledged
 OR a.product IS NULL OR a.terms_id<>c.terms_id OR a.privacy_id<>c.privacy_id OR a.statement_version<>c.statement_version
 OR t.status<>'published' OR p.status<>'published' OR t.kind<>'terms' OR p.kind<>'privacy'
 OR t.product<>c.product OR p.product<>c.product OR t.locale<>c.locale OR p.locale<>c.locale
 OR (t.content->>'effectiveDate')::date>current_date OR (p.content->>'effectiveDate')::date>current_date THEN
  RAISE EXCEPTION 'Eligible legal acceptance and owned email proof are required';
 END IF;
 INSERT INTO b1_legal_acceptances(id,user_id,product,context,locale,terms_id,privacy_id,terms_hash,privacy_hash,statement_version,statement,terms_accepted_at,privacy_acknowledged_at,receipt)
 VALUES(c.id,NEW.id,c.product,'registration',c.locale,t.id,p.id,t.content_hash,p.content_hash,c.statement_version,c.statement,c.agreed_at,c.agreed_at,
 jsonb_build_object('terms',t.content,'privacy',p.content,'agreementStatement',c.statement,'termsAcceptance',true,'privacyNoticeAcknowledgment',true,'locale',c.locale,'platform','web'));
 RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS b1_finalize_signup_legal ON public."user";
--> statement-breakpoint
CREATE TRIGGER b1_finalize_signup_legal AFTER INSERT ON public."user" FOR EACH ROW EXECUTE FUNCTION public.b1_finalize_signup_legal();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.b1_legal_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD IS DISTINCT FROM NEW THEN RAISE EXCEPTION 'Legal evidence is immutable'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS b1_legal_choice_immutable ON public.b1_legal_signup_choices;
--> statement-breakpoint
CREATE TRIGGER b1_legal_choice_immutable BEFORE UPDATE ON public.b1_legal_signup_choices FOR EACH ROW EXECUTE FUNCTION public.b1_legal_evidence_immutable();
--> statement-breakpoint
DROP TRIGGER IF EXISTS b1_legal_acceptance_immutable ON public.b1_legal_acceptances;
--> statement-breakpoint
CREATE TRIGGER b1_legal_acceptance_immutable BEFORE UPDATE ON public.b1_legal_acceptances FOR EACH ROW EXECUTE FUNCTION public.b1_legal_evidence_immutable();
--> statement-breakpoint
DROP TRIGGER IF EXISTS b1_legal_purchase_immutable ON public.b1_legal_purchases;
--> statement-breakpoint
CREATE TRIGGER b1_legal_purchase_immutable BEFORE UPDATE ON public.b1_legal_purchases FOR EACH ROW EXECUTE FUNCTION public.b1_legal_evidence_immutable();
