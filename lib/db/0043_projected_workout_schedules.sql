CREATE TABLE b1_scheduled_workouts (
  user_id text NOT NULL, schedule_id uuid NOT NULL, original_date date NOT NULL,
  slot_id text NOT NULL DEFAULT 'main', plan_id text NOT NULL REFERENCES gym_plans(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id,schedule_id,original_date,slot_id), UNIQUE(user_id,plan_id),
  FOREIGN KEY(user_id,schedule_id) REFERENCES b1_event_schedules(user_id,id) ON DELETE CASCADE
);

CREATE FUNCTION b1_materialize_scheduled_workout(p_owner text,p_id text,p_schedule uuid,p_original date,p_slot text,
  p_schedule_revision integer,p_occurrence_revision integer,p_date date,p_timezone text,p_data jsonb)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE current_schedule jsonb; current_revision integer; mapped text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('event-schedules'),hashtext(p_owner));
  SELECT plan_id INTO mapped FROM b1_scheduled_workouts WHERE user_id=p_owner AND schedule_id=p_schedule AND original_date=p_original AND slot_id=p_slot;
  IF FOUND THEN RETURN mapped; END IF;
  SELECT data INTO current_schedule FROM b1_event_schedules WHERE user_id=p_owner AND id=p_schedule FOR UPDATE;
  IF NOT FOUND OR (current_schedule->>'revision')::integer<>p_schedule_revision THEN RAISE EXCEPTION 'Newer workout schedule changes exist'; END IF;
  IF current_schedule->>'stoppedFrom' IS NOT NULL AND p_original>=(current_schedule->>'stoppedFrom')::date THEN RAISE EXCEPTION 'Workout schedule is stopped'; END IF;
  SELECT revision INTO current_revision FROM b1_event_occurrences WHERE user_id=p_owner AND schedule_id=p_schedule AND original_date=p_original AND slot_id=p_slot FOR UPDATE;
  IF COALESCE(current_revision,-1)<>p_occurrence_revision THEN RAISE EXCEPTION 'Newer workout occurrence changes exist'; END IF;
  INSERT INTO gym_plans(id,user_id,date,timezone,data,last_mutation) VALUES(p_id,p_owner,p_date,p_timezone,p_data,p_id);
  INSERT INTO b1_scheduled_workouts(user_id,schedule_id,original_date,slot_id,plan_id) VALUES(p_owner,p_schedule,p_original,p_slot,p_id);
  RETURN p_id;
END $$;

CREATE FUNCTION b1_complete_virtual_workout(p_owner text,p_operation uuid,p_hash text,p_plan text,p_session text,p_schedule uuid,p_original date,p_slot text,
  p_schedule_revision integer,p_occurrence_revision integer,p_date date,p_timezone text,p_blueprint jsonb,p_session_data jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE receipt record; result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('event-schedules'),hashtext(p_owner));
  SELECT * INTO receipt FROM b1_activity_operations WHERE user_id=p_owner AND operation_id=p_operation;
  IF FOUND THEN
    IF receipt.fingerprint<>p_hash THEN RAISE EXCEPTION 'Operation reused'; END IF;
    RETURN receipt.result;
  END IF;
  IF EXISTS(SELECT 1 FROM b1_scheduled_workouts WHERE user_id=p_owner AND schedule_id=p_schedule AND original_date=p_original AND slot_id=p_slot) THEN RAISE EXCEPTION 'Newer workout changes exist'; END IF;
  PERFORM b1_materialize_scheduled_workout(p_owner,p_plan,p_schedule,p_original,p_slot,p_schedule_revision,p_occurrence_revision,p_date,p_timezone,p_blueprint);
  result:=b1_complete_activity(p_owner,p_operation,p_hash,'workout',p_session,'',NULL,p_session_data,p_plan,NULL,0);
  RETURN result;
END $$;
