-- Move a saved ordinary Event atomically, including across ISO weeks.
CREATE FUNCTION b1_move_event_activity(p_owner text,p_operation uuid,p_hash text,p_from_week text,p_to_week text,p_day text,p_before jsonb,p_next jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE receipt record; source record; destination record; idx integer; task_idx integer; found_event jsonb; result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('event-schedules'),hashtext(p_owner));
  SELECT * INTO receipt FROM b1_activity_operations WHERE user_id=p_owner AND operation_id=p_operation;
  IF FOUND THEN
    IF receipt.fingerprint<>p_hash THEN RAISE EXCEPTION 'Operation reused'; END IF;
    RETURN receipt.result;
  END IF;
  IF p_next->>'id' IS DISTINCT FROM p_before->>'id' OR p_next->'completed' IS DISTINCT FROM p_before->'completed'
    OR p_next->'completedAt' IS DISTINCT FROM p_before->'completedAt' OR p_next ?| ARRAY['scheduled','workout']
    OR p_day NOT IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') THEN RAISE EXCEPTION 'Choose a valid event move'; END IF;
  INSERT INTO user_events(id,user_id,week,data) VALUES('activity-week:'||md5(p_owner||':'||p_to_week),p_owner,p_to_week,'[]'::jsonb)
    ON CONFLICT(user_id,week) DO NOTHING;
  PERFORM id FROM user_events WHERE user_id=p_owner AND week IN(p_from_week,p_to_week) ORDER BY week FOR UPDATE;
  SELECT * INTO STRICT source FROM user_events WHERE user_id=p_owner AND week=p_from_week;
  SELECT (d.ordinality-1)::integer,(t.ordinality-1)::integer,t.value INTO idx,task_idx,found_event
    FROM jsonb_array_elements(source.data) WITH ORDINALITY d(value,ordinality),jsonb_array_elements(d.value->'tasks') WITH ORDINALITY t(value,ordinality)
    WHERE t.value->>'id'=p_before->>'id';
  IF found_event IS NULL OR found_event<>p_before THEN RAISE EXCEPTION 'Newer event changes exist'; END IF;
  UPDATE user_events SET data=jsonb_set(data,ARRAY[idx::text,'tasks'],(data->idx->'tasks')-task_idx) WHERE user_id=p_owner AND id=source.id;
  SELECT * INTO STRICT destination FROM user_events WHERE user_id=p_owner AND week=p_to_week;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(destination.data) d,jsonb_array_elements(d->'tasks') t WHERE t->>'id'=p_next->>'id') THEN
    RAISE EXCEPTION 'Event identity is already used';
  END IF;
  SELECT (ordinality-1)::integer INTO idx FROM jsonb_array_elements(destination.data) WITH ORDINALITY d WHERE value->>'day'=p_day;
  IF idx IS NULL THEN destination.data:=destination.data||jsonb_build_array(jsonb_build_object('id',lower(p_day),'day',p_day,'tasks',jsonb_build_array(p_next)));
  ELSE
    IF jsonb_array_length(destination.data->idx->'tasks')>=150 THEN RAISE EXCEPTION 'Choose another destination day'; END IF;
    destination.data:=jsonb_set(destination.data,ARRAY[idx::text,'tasks'],(destination.data->idx->'tasks')||jsonb_build_array(p_next));
  END IF;
  UPDATE user_events SET data=destination.data WHERE user_id=p_owner AND id=destination.id;
  result:=jsonb_build_object('id','event:'||(p_next->>'id'));
  INSERT INTO b1_activity_operations(user_id,operation_id,fingerprint,result) VALUES(p_owner,p_operation,p_hash,result);
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION b1_move_event_activity(text,uuid,text,text,text,text,jsonb,jsonb) FROM PUBLIC;
