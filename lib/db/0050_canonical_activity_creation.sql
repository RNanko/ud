-- Additive source operations. No existing records are changed on installation.
CREATE FUNCTION b1_create_event_activity(p_owner text,p_operation uuid,p_hash text,p_week text,p_day text,p_event jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE receipt record; board record; idx integer; result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('event-schedules'),hashtext(p_owner));
  SELECT * INTO receipt FROM b1_activity_operations WHERE user_id=p_owner AND operation_id=p_operation;
  IF FOUND THEN
    IF receipt.fingerprint<>p_hash THEN RAISE EXCEPTION 'Operation reused'; END IF;
    RETURN receipt.result;
  END IF;
  IF p_event->>'id'<>p_operation::text OR p_event->>'kind'<>'manual' OR p_event->>'completed'<>'false'
    OR p_event ?| ARRAY['workout','workoutLink','scheduled','momentumSeriesId']
    OR p_day NOT IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') THEN
    RAISE EXCEPTION 'Choose an ordinary event';
  END IF;
  INSERT INTO user_events(id,user_id,week,data) VALUES('activity-week:'||md5(p_owner||':'||p_week),p_owner,p_week,'[]'::jsonb)
    ON CONFLICT(user_id,week) DO NOTHING;
  SELECT * INTO STRICT board FROM user_events WHERE user_id=p_owner AND week=p_week FOR UPDATE;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(board.data) d,jsonb_array_elements(d->'tasks') t WHERE t->>'id'=p_operation::text) THEN
    RAISE EXCEPTION 'Event identity is already used';
  END IF;
  SELECT (ordinality-1)::integer INTO idx FROM jsonb_array_elements(board.data) WITH ORDINALITY d WHERE value->>'day'=p_day;
  IF idx IS NULL THEN
    board.data:=board.data||jsonb_build_array(jsonb_build_object('id',lower(p_day),'day',p_day,'tasks',jsonb_build_array(p_event)));
  ELSE
    IF jsonb_array_length(board.data->idx->'tasks')>=150 THEN RAISE EXCEPTION 'Choose another day or remove an unused event'; END IF;
    board.data:=jsonb_set(board.data,ARRAY[idx::text,'tasks'],(board.data->idx->'tasks')||jsonb_build_array(p_event));
  END IF;
  UPDATE user_events SET data=board.data WHERE id=board.id AND user_id=p_owner;
  result:=jsonb_build_object('id','event:'||p_operation::text);
  INSERT INTO b1_activity_operations(user_id,operation_id,fingerprint,result) VALUES(p_owner,p_operation,p_hash,result);
  RETURN result;
END $$;

CREATE FUNCTION b1_activate_workout_activity(p_owner text,p_operation uuid,p_hash text,p_plan jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE receipt record; ref jsonb; result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('event-schedules'),hashtext(p_owner));
  SELECT * INTO receipt FROM b1_activity_operations WHERE user_id=p_owner AND operation_id=p_operation;
  IF FOUND THEN
    IF receipt.fingerprint<>p_hash THEN RAISE EXCEPTION 'Operation reused'; END IF;
    RETURN receipt.result;
  END IF;
  ref:=p_plan->'data'->'scheduled';
  IF (p_plan->>'revision')::integer<>-1 OR ref IS NULL OR EXISTS(SELECT 1 FROM gym_plans WHERE user_id=p_owner AND id=p_plan->>'id') THEN
    RAISE EXCEPTION 'Newer workout changes exist';
  END IF;
  PERFORM b1_materialize_scheduled_workout(p_owner,p_plan->>'id',(ref->>'scheduleId')::uuid,(ref->>'originalDate')::date,COALESCE(ref->>'slotId','main'),
    (ref->>'scheduleRevision')::integer,(ref->>'revision')::integer,(p_plan->>'date')::date,p_plan->>'timezone',p_plan->'data');
  result:=jsonb_build_object('id','workout:plan:'||(p_plan->>'id'));
  INSERT INTO b1_activity_operations(user_id,operation_id,fingerprint,result) VALUES(p_owner,p_operation,p_hash,result);
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION b1_create_event_activity(text,uuid,text,text,text,jsonb), b1_activate_workout_activity(text,uuid,text,jsonb) FROM PUBLIC;
