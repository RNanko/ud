-- Shared checkbox command for saved one-offs and workouts. Scheduled ordinary
-- occurrences use b1_write_event_schedule_v2 with the same durable receipt table.
CREATE TABLE b1_activity_operations (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL, fingerprint text NOT NULL, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,operation_id)
);
CREATE FUNCTION b1_complete_activity(p_owner text,p_operation uuid,p_fingerprint text,p_kind text,p_id text,
  p_week text,p_before jsonb,p_next jsonb,p_plan text DEFAULT NULL,p_revision integer DEFAULT NULL,p_plan_revision integer DEFAULT NULL,
  p_schedule uuid DEFAULT NULL,p_original date DEFAULT NULL,p_schedule_revision integer DEFAULT NULL,p_slot text DEFAULT 'main',p_restore boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE receipt record; board record; session_row record; plan_row record; bound record; result jsonb; day_index integer; task_index integer; found_event jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('event-schedules'),hashtext(p_owner));
  SELECT * INTO receipt FROM b1_activity_operations WHERE user_id=p_owner AND operation_id=p_operation;
  IF FOUND THEN
    IF receipt.fingerprint<>p_fingerprint THEN RAISE EXCEPTION 'Operation reused'; END IF;
    RETURN receipt.result;
  END IF;
  IF p_kind='event' THEN
    SELECT * INTO board FROM user_events WHERE user_id=p_owner AND week=p_week FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'This event is unavailable'; END IF;
    SELECT (d.ordinality-1)::integer,(t.ordinality-1)::integer,t.value INTO day_index,task_index,found_event
      FROM jsonb_array_elements(board.data) WITH ORDINALITY d(value,ordinality),
           jsonb_array_elements(d.value->'tasks') WITH ORDINALITY t(value,ordinality)
      WHERE t.value->>'id'=p_id;
    IF found_event IS NULL OR found_event<>p_before THEN RAISE EXCEPTION 'Newer event changes exist'; END IF;
    UPDATE user_events SET data=jsonb_set(data,ARRAY[day_index::text,'tasks',task_index::text],p_next) WHERE id=board.id AND user_id=p_owner;
    result:=jsonb_build_object('kind','event','id',p_id,'data',p_next);
  ELSIF p_kind='workout' THEN
    IF p_plan IS NOT NULL THEN
      SELECT * INTO plan_row FROM gym_plans WHERE user_id=p_owner AND id=p_plan AND NOT archived FOR UPDATE;
      IF NOT FOUND OR plan_row.revision<>p_plan_revision THEN RAISE EXCEPTION 'Newer workout plan changes exist'; END IF;
    END IF;
    SELECT * INTO session_row FROM gym_sessions WHERE user_id=p_owner AND (id=p_id OR (p_plan IS NOT NULL AND plan_id=p_plan)) FOR UPDATE;
    IF FOUND THEN
      IF session_row.archived OR session_row.id<>p_id OR session_row.revision IS DISTINCT FROM p_revision OR session_row.data<>p_before THEN RAISE EXCEPTION 'Newer workout changes exist'; END IF;
      UPDATE gym_sessions SET data=p_next,revision=revision+1,last_mutation=p_operation::text WHERE id=p_id AND user_id=p_owner;
    ELSE
      IF p_plan IS NULL OR p_before IS NOT NULL OR p_revision IS NOT NULL THEN RAISE EXCEPTION 'This workout is unavailable'; END IF;
      INSERT INTO gym_sessions(id,user_id,plan_id,data,last_mutation) VALUES(p_id,p_owner,p_plan,p_next,p_operation::text);
    END IF;
    result:=jsonb_build_object('kind','workout','id',p_id,'data',p_next);
    IF p_restore AND p_plan IS NOT NULL AND plan_row.data=p_before->'originalPlan'
      AND plan_row.date=(plan_row.data->'scheduled'->>'originalDate')::date
      AND NOT EXISTS(SELECT 1 FROM user_events u,jsonb_array_elements(u.data) d,jsonb_array_elements(d->'tasks') t WHERE u.user_id=p_owner AND t->'workoutLink'->>'id' IN(p_plan,p_id)) THEN
      SELECT * INTO bound FROM b1_scheduled_workouts WHERE user_id=p_owner AND plan_id=p_plan;
      IF FOUND THEN
        -- Persist only a revision marker, never an empty workout or false result.
        INSERT INTO b1_event_occurrences(user_id,schedule_id,original_date,slot_id,date,revision,data)
          VALUES(p_owner,bound.schedule_id,bound.original_date,bound.slot_id,bound.original_date,0,
            jsonb_build_object('scheduleId',bound.schedule_id,'originalDate',bound.original_date,'slotId',bound.slot_id,'date',bound.original_date,'revision',0))
          ON CONFLICT(user_id,schedule_id,original_date,slot_id) DO UPDATE SET revision=b1_event_occurrences.revision+1,
            data=jsonb_set(b1_event_occurrences.data-'event','{revision}',to_jsonb(b1_event_occurrences.revision+1));
        DELETE FROM gym_sessions WHERE user_id=p_owner AND id=p_id;
        DELETE FROM gym_plans WHERE user_id=p_owner AND id=p_plan;
      END IF;
    END IF;
  ELSIF p_kind='scheduled' THEN
    result:=b1_write_event_schedule_v2(p_owner,p_operation,p_fingerprint,p_schedule,p_revision,p_next,p_original,p_week::date,p_schedule_revision,p_slot,p_restore);
  ELSE RAISE EXCEPTION 'Choose a supported activity';
  END IF;
  INSERT INTO b1_activity_operations(user_id,operation_id,fingerprint,result) VALUES(p_owner,p_operation,p_fingerprint,result);
  RETURN result;
END $$;
