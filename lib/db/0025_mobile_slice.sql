-- Additive Phase 2 API concurrency/receipts. Apply only to verified isolated data.
-- The original web board and its data/IDs remain the shared source of truth.
CREATE TABLE IF NOT EXISTS b1_mobile_todo_versions (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS b1_mobile_operations (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 operation_id uuid NOT NULL, resource text NOT NULL CHECK(resource IN ('todo','preferences')),
 fingerprint text NOT NULL, acknowledged_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,operation_id)
);
-- A tombstone revision survives board deletion; web writes increment it too.
CREATE OR REPLACE FUNCTION b1_mobile_todo_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.data IS NOT DISTINCT FROM NEW.data THEN RETURN NEW; END IF;
 -- Parent-account deletion cascades must not recreate a child FK row.
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "user" WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 INSERT INTO b1_mobile_todo_versions(user_id,revision)
 VALUES(CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END,1)
 ON CONFLICT(user_id) DO UPDATE SET revision=b1_mobile_todo_versions.revision+1;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS b1_mobile_todo_revision ON kanban_board;
CREATE TRIGGER b1_mobile_todo_revision AFTER INSERT OR UPDATE OF data OR DELETE ON kanban_board
 FOR EACH ROW EXECUTE FUNCTION b1_mobile_todo_revision();

CREATE OR REPLACE FUNCTION b1_mobile_save_todo(owner text, operation uuid, fingerprint_value text, expected bigint, board jsonb)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE prior b1_mobile_operations; version bigint; board_count integer;
BEGIN
 -- One owner/operation is serialized through the existing user row. Receipts
 -- and the board change commit together; failed CAS leaves no receipt.
 PERFORM 1 FROM "user" WHERE id=owner FOR UPDATE;
 IF NOT FOUND THEN RETURN 'unauthorized'; END IF;
 SELECT * INTO prior FROM b1_mobile_operations WHERE user_id=owner AND operation_id=operation;
 IF FOUND THEN
   IF prior.resource='todo' AND prior.fingerprint=fingerprint_value THEN RETURN 'duplicate'; END IF;
   RETURN 'operation-reused';
 END IF;
 INSERT INTO b1_mobile_todo_versions(user_id,revision) VALUES(owner,0) ON CONFLICT DO NOTHING;
 SELECT revision INTO version FROM b1_mobile_todo_versions WHERE user_id=owner FOR UPDATE;
 IF version<>expected THEN RETURN 'conflict'; END IF;
 SELECT count(*) INTO board_count FROM kanban_board WHERE user_id=owner;
 IF board_count>1 THEN RETURN 'conflict'; END IF;
 IF board_count=0 THEN
   INSERT INTO kanban_board(id,user_id,data) VALUES('todo:'||owner,owner,board);
 ELSE
   UPDATE kanban_board SET data=board,updated_at=now() WHERE user_id=owner;
 END IF;
 INSERT INTO b1_mobile_operations(user_id,operation_id,resource,fingerprint) VALUES(owner,operation,'todo',fingerprint_value);
 RETURN 'saved';
END $$;

CREATE OR REPLACE FUNCTION b1_mobile_save_preferences(owner text, operation uuid, fingerprint_value text, expected bigint, prefs jsonb, notification_defaults jsonb)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE prior b1_mobile_operations; version bigint;
BEGIN
 PERFORM 1 FROM "user" WHERE id=owner FOR UPDATE;
 IF NOT FOUND THEN RETURN 'unauthorized'; END IF;
 SELECT * INTO prior FROM b1_mobile_operations WHERE user_id=owner AND operation_id=operation;
 IF FOUND THEN
   IF prior.resource='preferences' AND prior.fingerprint=fingerprint_value THEN RETURN 'duplicate'; END IF;
   RETURN 'operation-reused';
 END IF;
 SELECT revision INTO version FROM b1_account_settings WHERE user_id=owner AND product='b1-way-personal' FOR UPDATE;
 IF NOT FOUND THEN
   IF expected<>0 THEN RETURN 'conflict'; END IF;
   INSERT INTO b1_account_settings(user_id,product,preferences,notifications,revision)
   VALUES(owner,'b1-way-personal',prefs,notification_defaults,1) ON CONFLICT DO NOTHING;
   IF NOT FOUND THEN RETURN 'conflict'; END IF;
 ELSE
   IF version<>expected THEN RETURN 'conflict'; END IF;
   UPDATE b1_account_settings SET preferences=prefs,revision=revision+1,updated_at=now()
   WHERE user_id=owner AND product='b1-way-personal' AND revision=expected;
   IF NOT FOUND THEN RETURN 'conflict'; END IF;
 END IF;
 INSERT INTO b1_mobile_operations(user_id,operation_id,resource,fingerprint) VALUES(owner,operation,'preferences',fingerprint_value);
 RETURN 'saved';
END $$;
