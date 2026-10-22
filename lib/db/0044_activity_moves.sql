-- Moving a workout changes its effective calendar date, never its recorded results.
CREATE FUNCTION b1_move_workout_activity(p_owner text,p_operation uuid,p_hash text,p_id text,p_before jsonb,p_date date,p_timezone text,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE receipt record; existing record; ref jsonb; result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('event-schedules'),hashtext(p_owner));
  SELECT * INTO receipt FROM b1_activity_operations WHERE user_id=p_owner AND operation_id=p_operation;
  IF FOUND THEN
    IF receipt.fingerprint<>p_hash THEN RAISE EXCEPTION 'Operation reused'; END IF;
    RETURN receipt.result;
  END IF;
  SELECT * INTO existing FROM gym_plans WHERE user_id=p_owner AND id=p_id FOR UPDATE;
  IF (p_before->>'revision')::integer=-1 THEN
    IF FOUND THEN RAISE EXCEPTION 'Newer workout changes exist'; END IF;
    ref:=p_before->'data'->'scheduled';
    PERFORM b1_materialize_scheduled_workout(p_owner,p_id,(ref->>'scheduleId')::uuid,(ref->>'originalDate')::date,COALESCE(ref->>'slotId','main'),
      (ref->>'scheduleRevision')::integer,(ref->>'revision')::integer,(p_before->>'date')::date,p_before->>'timezone',p_before->'data');
  ELSE
    IF NOT FOUND OR existing.archived OR existing.revision<>(p_before->>'revision')::integer OR existing.data<>p_before->'data'
      OR existing.date<>(p_before->>'date')::date THEN RAISE EXCEPTION 'Newer workout changes exist'; END IF;
  END IF;
  UPDATE gym_plans SET date=p_date,timezone=p_timezone,data=p_data,revision=revision+1,last_mutation=p_operation::text
    WHERE user_id=p_owner AND id=p_id RETURNING jsonb_build_object('id',id,'date',date,'timezone',timezone,'data',data,'revision',revision) INTO result;
  INSERT INTO b1_activity_operations(user_id,operation_id,fingerprint,result) VALUES(p_owner,p_operation,p_hash,result);
  RETURN result;
END $$;

CREATE FUNCTION b1_cancel_virtual_workout(p_owner text,p_operation uuid,p_hash text,p_plan text,p_ref jsonb,p_date date)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE receipt record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('event-schedules'),hashtext(p_owner));
  SELECT * INTO receipt FROM b1_event_schedule_operations WHERE user_id=p_owner AND operation_id=p_operation;
  IF FOUND THEN
    IF receipt.fingerprint<>p_hash THEN RAISE EXCEPTION 'Operation reused'; END IF;
    RETURN receipt.result;
  END IF;
  IF EXISTS(SELECT 1 FROM gym_plans WHERE user_id=p_owner AND id=p_plan) THEN RAISE EXCEPTION 'Newer workout changes exist'; END IF;
  RETURN b1_write_event_schedule_v2(p_owner,p_operation,p_hash,(p_ref->>'scheduleId')::uuid,(p_ref->>'revision')::integer,NULL::jsonb,
    (p_ref->>'originalDate')::date,p_date,(p_ref->>'scheduleRevision')::integer,COALESCE(p_ref->>'slotId','main'),false);
END $$;
