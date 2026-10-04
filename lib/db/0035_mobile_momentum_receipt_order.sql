-- Preserve chronological order of the bounded legacy web receipt list.
-- Mobile acknowledgments remain in their independent durable table.
CREATE OR REPLACE FUNCTION b1_mobile_save_momentum(owner text,operation uuid,fingerprint_value text,expected bigint,value jsonb,identity_collection text,identity_id text,creating boolean)
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
 UPDATE momentum_state SET data=value,revision=version+1,mutations=(SELECT COALESCE(jsonb_agg(x ORDER BY n),'[]') FROM (SELECT x,n FROM jsonb_array_elements(COALESCE(momentum_state.mutations,'[]')||jsonb_build_array(operation::text)) WITH ORDINALITY e(x,n) ORDER BY n DESC LIMIT 256) q),updated_at=now() WHERE user_id=owner;
 INSERT INTO b1_mobile_momentum_operations(user_id,operation_id,fingerprint,acknowledged_revision) VALUES(owner,operation,fingerprint_value,version+1);
 RETURN jsonb_build_object('outcome','saved','revision',version+1);
END $$;
