-- Additive Phase 3 Events concurrency and durable receipts. No data reset.
CREATE TABLE IF NOT EXISTS b1_mobile_event_versions (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS b1_mobile_event_operations (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 operation_id uuid NOT NULL, fingerprint text NOT NULL,
 acknowledged_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,operation_id)
);
CREATE FUNCTION b1_mobile_event_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.data IS NOT DISTINCT FROM NEW.data THEN RETURN NEW; END IF;
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM "user" WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 INSERT INTO b1_mobile_event_versions(user_id,revision)
 VALUES(CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END,1)
 ON CONFLICT(user_id) DO UPDATE SET revision=b1_mobile_event_versions.revision+1;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b1_mobile_event_revision AFTER INSERT OR UPDATE OF data OR DELETE ON user_events
 FOR EACH ROW EXECUTE FUNCTION b1_mobile_event_revision();

CREATE FUNCTION b1_mobile_save_events(owner text, operation uuid, fingerprint_value text, expected bigint, patches jsonb)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE prior b1_mobile_event_operations; version bigint; patch jsonb; saved_data jsonb; present boolean;
BEGIN
 PERFORM 1 FROM "user" WHERE id=owner FOR UPDATE;
 IF NOT FOUND THEN RETURN 'unauthorized'; END IF;
 SELECT * INTO prior FROM b1_mobile_event_operations WHERE user_id=owner AND operation_id=operation;
 IF FOUND THEN
  IF prior.fingerprint=fingerprint_value THEN RETURN 'duplicate'; END IF;
  RETURN 'operation-reused';
 END IF;
 INSERT INTO b1_mobile_event_versions(user_id,revision) VALUES(owner,0) ON CONFLICT DO NOTHING;
 SELECT revision INTO version FROM b1_mobile_event_versions WHERE user_id=owner FOR UPDATE;
 IF version<>expected THEN RETURN 'conflict'; END IF;
 -- Preflight every source/destination before changing any row. Lock in a
 -- stable order. Web CAS and this trigger share the same revision source.
 FOR patch IN SELECT value FROM jsonb_array_elements(patches) ORDER BY value->>'week' LOOP
  SELECT data INTO saved_data FROM user_events WHERE user_id=owner AND week=patch->>'week' FOR UPDATE;
  present:=FOUND;
  IF present AND saved_data IS DISTINCT FROM patch->'before' THEN RETURN 'conflict'; END IF;
  IF NOT present AND patch->'before'<>'null'::jsonb THEN RETURN 'conflict'; END IF;
 END LOOP;
 FOR patch IN SELECT value FROM jsonb_array_elements(patches) ORDER BY value->>'week' LOOP
  IF patch->'before'='null'::jsonb THEN
   INSERT INTO user_events(id,user_id,week,data)
   VALUES('mobile-events:'||owner||':'||(patch->>'week'),owner,patch->>'week',patch->'data') ON CONFLICT DO NOTHING;
   IF NOT FOUND THEN RAISE EXCEPTION 'Event compare and swap failed'; END IF;
  ELSE
   UPDATE user_events SET data=patch->'data' WHERE user_id=owner AND week=patch->>'week' AND data=patch->'before';
   IF NOT FOUND THEN RAISE EXCEPTION 'Event compare and swap failed'; END IF;
  END IF;
 END LOOP;
 INSERT INTO b1_mobile_event_operations(user_id,operation_id,fingerprint) VALUES(owner,operation,fingerprint_value);
 RETURN 'saved';
END $$;
