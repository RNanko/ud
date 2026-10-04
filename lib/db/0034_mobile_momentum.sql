-- Additive, account-scoped durable acknowledgments. Canonical Momentum JSON stays authoritative.
CREATE TABLE b1_mobile_momentum_operations (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, operation_id uuid NOT NULL,
 fingerprint text NOT NULL, acknowledged_revision bigint NOT NULL, acknowledged_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,operation_id)
);
CREATE TABLE b1_mobile_momentum_identities (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, collection text NOT NULL, id text NOT NULL,
 PRIMARY KEY(user_id,collection,id)
);
CREATE FUNCTION b1_mobile_momentum_ids(value jsonb) RETURNS TABLE(collection text,id text) LANGUAGE sql IMMUTABLE AS $$
 SELECT k,x->>'id' FROM (VALUES('journeys'),('focus'),('reviews'),('savings')) c(k),jsonb_array_elements(COALESCE(value->k,'[]')) x
 UNION SELECT 'entries',e->>'id' FROM jsonb_array_elements(COALESCE(value->'savings','[]')) p,jsonb_array_elements(COALESCE(p->'entries','[]')) e
 UNION SELECT k,x->>'id' FROM (VALUES('goals'),('scopes'),('records')) c(k),jsonb_array_elements(COALESCE(value->'tracker'->k,'[]')) x
$$;
INSERT INTO b1_mobile_momentum_identities SELECT user_id,collection,id FROM momentum_state m CROSS JOIN LATERAL b1_mobile_momentum_ids(m.data) WHERE id IS NOT NULL ON CONFLICT DO NOTHING;
CREATE FUNCTION b1_mobile_momentum_observe() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.data IS DISTINCT FROM OLD.data AND NEW.revision<=OLD.revision THEN NEW.revision=OLD.revision+1; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b1_mobile_momentum_revision BEFORE UPDATE ON momentum_state FOR EACH ROW EXECUTE FUNCTION b1_mobile_momentum_observe();
CREATE FUNCTION b1_mobile_momentum_claims() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner text;
BEGIN
 owner=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
 IF EXISTS(SELECT 1 FROM "user" WHERE id=owner) THEN
  IF TG_OP<>'INSERT' THEN INSERT INTO b1_mobile_momentum_identities SELECT owner,collection,id FROM b1_mobile_momentum_ids(OLD.data) WHERE id IS NOT NULL ON CONFLICT DO NOTHING; END IF;
  IF TG_OP<>'DELETE' THEN INSERT INTO b1_mobile_momentum_identities SELECT owner,collection,id FROM b1_mobile_momentum_ids(NEW.data) WHERE id IS NOT NULL ON CONFLICT DO NOTHING; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER b1_mobile_momentum_claims AFTER INSERT OR UPDATE OR DELETE ON momentum_state FOR EACH ROW EXECUTE FUNCTION b1_mobile_momentum_claims();
CREATE FUNCTION b1_mobile_save_momentum(owner text,operation uuid,fingerprint_value text,expected bigint,value jsonb,identity_collection text,identity_id text,creating boolean)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE prior b1_mobile_momentum_operations; version bigint;
BEGIN
 PERFORM 1 FROM "user" WHERE id=owner FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('outcome','unauthorized'); END IF;
 SELECT * INTO prior FROM b1_mobile_momentum_operations WHERE user_id=owner AND operation_id=operation;
 IF FOUND THEN
  IF prior.fingerprint=fingerprint_value THEN RETURN jsonb_build_object('outcome','duplicate','revision',prior.acknowledged_revision); END IF;
  RETURN jsonb_build_object('outcome','operation-reused');
 END IF;
 SELECT revision INTO version FROM momentum_state WHERE user_id=owner FOR UPDATE;
 IF NOT FOUND OR version<>expected THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
 IF identity_collection IS NOT NULL THEN
  IF creating THEN
   IF EXISTS(SELECT 1 FROM b1_mobile_momentum_identities WHERE user_id=owner AND collection=identity_collection AND id=identity_id) THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM momentum_state m CROSS JOIN LATERAL b1_mobile_momentum_ids(m.data) i WHERE m.user_id=owner AND i.collection=identity_collection AND i.id=identity_id) THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
 END IF;
 UPDATE momentum_state SET data=value,revision=version+1,mutations=(SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT x FROM jsonb_array_elements(COALESCE(momentum_state.mutations,'[]')||jsonb_build_array(operation::text)) WITH ORDINALITY e(x,n) ORDER BY n DESC LIMIT 256) q),updated_at=now() WHERE user_id=owner;
 INSERT INTO b1_mobile_momentum_operations(user_id,operation_id,fingerprint,acknowledged_revision) VALUES(owner,operation,fingerprint_value,version+1);
 RETURN jsonb_build_object('outcome','saved','revision',version+1);
END $$;
