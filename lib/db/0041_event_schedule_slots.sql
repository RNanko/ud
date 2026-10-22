-- Extend 0040 without changing saved single-slot identities or applied checksums.
ALTER TABLE b1_event_occurrences ADD COLUMN slot_id text NOT NULL DEFAULT 'main';
ALTER TABLE b1_event_occurrences DROP CONSTRAINT b1_event_occurrences_pkey;
ALTER TABLE b1_event_occurrences ADD PRIMARY KEY(user_id,schedule_id,original_date,slot_id);
ALTER TABLE b1_event_occurrences ADD CONSTRAINT b1_event_slot_valid CHECK(slot_id ~ '^[a-zA-Z0-9_-]{1,40}$');

CREATE FUNCTION b1_write_event_schedule_v2(p_owner text,p_operation uuid,p_fingerprint text,p_id uuid,p_expected integer,p_data jsonb,
  p_original date DEFAULT NULL,p_date date DEFAULT NULL,p_schedule_revision integer DEFAULT NULL,p_slot text DEFAULT 'main',p_restore boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE receipt record; current_revision integer; schedule_revision integer; result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('event-schedules'),hashtext(p_owner));
  SELECT * INTO receipt FROM b1_event_schedule_operations WHERE user_id=p_owner AND operation_id=p_operation;
  IF FOUND THEN
    IF receipt.fingerprint<>p_fingerprint THEN RAISE EXCEPTION 'Operation reused'; END IF;
    RETURN receipt.result;
  END IF;
  IF p_original IS NULL THEN
    SELECT revision INTO current_revision FROM b1_event_schedules WHERE user_id=p_owner AND id=p_id FOR UPDATE;
    IF COALESCE(current_revision,-1)<>p_expected THEN RAISE EXCEPTION 'Newer schedule changes exist'; END IF;
    result:=jsonb_set(p_data,'{revision}',to_jsonb(p_expected+1));
    INSERT INTO b1_event_schedules(user_id,id,revision,data) VALUES(p_owner,p_id,p_expected+1,result)
      ON CONFLICT(user_id,id) DO UPDATE SET revision=excluded.revision,data=excluded.data;
  ELSE
    SELECT revision INTO schedule_revision FROM b1_event_schedules WHERE user_id=p_owner AND id=p_id FOR UPDATE;
    IF schedule_revision IS NULL OR schedule_revision<>p_schedule_revision THEN RAISE EXCEPTION 'Newer schedule changes exist'; END IF;
    SELECT revision INTO current_revision FROM b1_event_occurrences WHERE user_id=p_owner AND schedule_id=p_id AND original_date=p_original AND slot_id=p_slot FOR UPDATE;
    IF COALESCE(current_revision,-1)<>p_expected THEN RAISE EXCEPTION 'Newer occurrence changes exist'; END IF;
    result:=jsonb_build_object('scheduleId',p_id,'originalDate',p_original,'date',p_date,'revision',p_expected+1);
    IF p_slot<>'main' THEN result:=result||jsonb_build_object('slotId',p_slot); END IF;
    -- A restored virtual slot keeps only its revision marker, preventing ABA races.
    -- A JSON null event is cancellation; absence of event means use the rule.
    IF NOT p_restore THEN result:=result||jsonb_build_object('event',p_data); END IF;
    INSERT INTO b1_event_occurrences(user_id,schedule_id,original_date,slot_id,date,revision,data) VALUES(p_owner,p_id,p_original,p_slot,p_date,p_expected+1,result)
      ON CONFLICT(user_id,schedule_id,original_date,slot_id) DO UPDATE SET date=excluded.date,revision=excluded.revision,data=excluded.data;
  END IF;
  INSERT INTO b1_event_schedule_operations(user_id,operation_id,fingerprint,result) VALUES(p_owner,p_operation,p_fingerprint,result);
  RETURN result;
END $$;

-- Older single-slot clients still use the same authoritative writer and lock.
CREATE OR REPLACE FUNCTION b1_write_event_schedule(p_owner text,p_operation uuid,p_fingerprint text,p_id uuid,p_expected integer,p_data jsonb,
  p_original date DEFAULT NULL,p_date date DEFAULT NULL,p_schedule_revision integer DEFAULT NULL)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT b1_write_event_schedule_v2(p_owner,p_operation,p_fingerprint,p_id,p_expected,p_data,p_original,p_date,p_schedule_revision);
$$;
