-- Additive, account-owned durable receipts. The function runs with the caller's
-- permissions; no SECURITY DEFINER, credentials, or production grant changes.
CREATE TABLE b1_mobile_gym_operations (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 operation_id uuid NOT NULL, fingerprint text NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,operation_id)
);
CREATE FUNCTION b1_mobile_save_gym(p_owner text,p_operation uuid,p_fingerprint text,
 p_kind text,p_id text,p_before jsonb,p_after jsonb,p_dependency jsonb,p_start boolean)
 RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE target text; current_row jsonb; receipt record; chosen text := p_id; dependency_row jsonb; changed integer;
BEGIN
 PERFORM 1 FROM "user" WHERE id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('outcome','unauthorized'); END IF;
 SELECT fingerprint,result INTO receipt FROM b1_mobile_gym_operations WHERE user_id=p_owner AND operation_id=p_operation;
 IF FOUND THEN
  IF receipt.fingerprint<>p_fingerprint THEN RETURN jsonb_build_object('outcome','operation-reused'); END IF;
  RETURN receipt.result || jsonb_build_object('outcome','duplicate');
 END IF;
 target := CASE p_kind WHEN 'entity' THEN 'gym_entities' WHEN 'plan' THEN 'gym_plans' WHEN 'session' THEN 'gym_sessions' WHEN 'rest' THEN 'gym_rest_days' END;
 IF target IS NULL THEN RAISE EXCEPTION 'Unsupported Gym resource'; END IF;
 IF p_dependency IS NOT NULL THEN
  SELECT to_jsonb(t)-'created_at' INTO dependency_row FROM gym_plans t WHERE user_id=p_owner AND id=p_dependency->>'id' FOR UPDATE;
  IF dependency_row IS DISTINCT FROM p_dependency OR COALESCE((dependency_row->>'archived')::boolean,true) THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
 END IF;
 IF p_start AND p_after->>'plan_id' IS NOT NULL THEN
  SELECT to_jsonb(t)-'created_at' INTO current_row FROM gym_sessions t WHERE user_id=p_owner AND plan_id=p_after->>'plan_id' FOR UPDATE;
  IF current_row IS NOT NULL THEN
   IF (current_row->>'archived')::boolean THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
   chosen:=current_row->>'id';
   INSERT INTO b1_mobile_gym_operations VALUES(p_owner,p_operation,p_fingerprint,jsonb_build_object('kind',p_kind,'id',chosen),now());
   RETURN jsonb_build_object('outcome','saved','kind',p_kind,'id',chosen);
  END IF;
 END IF;
 EXECUTE format('SELECT to_jsonb(t)-''created_at'' FROM %I t WHERE user_id=$1 AND id=$2 FOR UPDATE',target) INTO current_row USING p_owner,p_id;
 IF current_row IS DISTINCT FROM p_before THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
 IF current_row IS NOT NULL AND p_kind<>'rest' AND (current_row->>'archived')::boolean THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
 IF p_kind='plan' AND p_before IS NOT NULL AND NOT COALESCE((p_after->>'archived')::boolean,false)
  AND EXISTS(SELECT 1 FROM gym_sessions WHERE user_id=p_owner AND plan_id=p_id AND NOT archived) THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
 IF p_before IS NULL THEN
  IF p_kind='entity' THEN
   INSERT INTO gym_entities(id,user_id,kind,data,revision,last_mutation) VALUES(p_id,p_owner,p_after->>'kind',p_after->'data',0,p_operation::text) ON CONFLICT DO NOTHING;
  ELSIF p_kind='plan' THEN
   INSERT INTO gym_plans(id,user_id,date,timezone,data,revision,last_mutation) VALUES(p_id,p_owner,(p_after->>'date')::date,p_after->>'timezone',p_after->'data',0,p_operation::text) ON CONFLICT DO NOTHING;
  ELSIF p_kind='session' THEN
   INSERT INTO gym_sessions(id,user_id,plan_id,data,revision,last_mutation) VALUES(p_id,p_owner,p_after->>'plan_id',p_after->'data',0,p_operation::text) ON CONFLICT DO NOTHING;
  ELSE
   INSERT INTO gym_rest_days(id,user_id,date,timezone,rest) VALUES(p_id,p_owner,(p_after->>'date')::date,p_after->>'timezone',(p_after->>'rest')::boolean) ON CONFLICT DO NOTHING;
  END IF;
 ELSE
  IF p_kind='rest' THEN
   UPDATE gym_rest_days SET rest=(p_after->>'rest')::boolean,timezone=p_after->>'timezone' WHERE id=p_id AND user_id=p_owner;
  ELSIF p_kind='plan' THEN
   UPDATE gym_plans SET data=p_after->'data',date=(p_after->>'date')::date,timezone=p_after->>'timezone',archived=COALESCE((p_after->>'archived')::boolean,false),revision=revision+1,last_mutation=p_operation::text WHERE id=p_id AND user_id=p_owner;
  ELSE
   EXECUTE format('UPDATE %I SET data=$1,archived=$2,revision=revision+1,last_mutation=$3 WHERE id=$4 AND user_id=$5',target)
    USING p_after->'data',COALESCE((p_after->>'archived')::boolean,false),p_operation::text,p_id,p_owner;
  END IF;
 END IF;
 GET DIAGNOSTICS changed = ROW_COUNT;
 IF changed<>1 THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
 INSERT INTO b1_mobile_gym_operations VALUES(p_owner,p_operation,p_fingerprint,jsonb_build_object('kind',p_kind,'id',chosen),now());
 RETURN jsonb_build_object('outcome','saved','kind',p_kind,'id',chosen);
END $$;
