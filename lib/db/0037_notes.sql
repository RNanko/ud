-- Additive Notes storage. Migration/import leaves existing user_notes unchanged.
-- Explicit deletion of an imported note clears only its original legacy slot.
CREATE TABLE IF NOT EXISTS b1_notes (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 title text NOT NULL, blocks jsonb NOT NULL CHECK (jsonb_typeof(blocks)='array'),
 revision bigint NOT NULL DEFAULT 1 CHECK (revision>=0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 pinned boolean NOT NULL DEFAULT false, position integer NOT NULL DEFAULT 0 CHECK (position>=0)
);
CREATE INDEX IF NOT EXISTS b1_notes_owner_order_idx ON b1_notes(user_id,pinned,position,id);
CREATE TABLE IF NOT EXISTS b1_notes_state (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0)
);
CREATE TABLE IF NOT EXISTS b1_notes_operations (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, operation_id uuid NOT NULL,
 fingerprint text NOT NULL, note_id text, acknowledged_revision bigint NOT NULL,
 acknowledged_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,operation_id)
);
CREATE INDEX IF NOT EXISTS b1_notes_operation_note_idx ON b1_notes_operations(user_id,note_id);
-- No FK to b1_notes: this ledger deliberately survives a note's deletion, so a
-- later migration run cannot bring back a legacy note the user already removed.
CREATE TABLE IF NOT EXISTS b1_notes_legacy_imports (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 source_id text NOT NULL, item_position bigint NOT NULL, note_id text NOT NULL UNIQUE,
 imported_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,source_id,item_position)
);

CREATE OR REPLACE FUNCTION b1_notes_prepare_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id OR NEW.created_at<>OLD.created_at THEN
  RAISE EXCEPTION 'Note identity is immutable';
 END IF;
 NEW.revision=OLD.revision;
 NEW.updated_at=OLD.updated_at;
 IF NEW.title IS DISTINCT FROM OLD.title OR NEW.blocks IS DISTINCT FROM OLD.blocks THEN
  NEW.updated_at=GREATEST(clock_timestamp(),OLD.updated_at+interval '1 millisecond');
  NEW.revision=OLD.revision+1;
 ELSIF NEW.pinned IS DISTINCT FROM OLD.pinned THEN
  NEW.revision=OLD.revision+1;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION b1_notes_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner text;
BEGIN
 IF TG_OP='UPDATE' AND to_jsonb(OLD) IS NOT DISTINCT FROM to_jsonb(NEW) THEN RETURN NEW; END IF;
 owner=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
 IF EXISTS(SELECT 1 FROM "user" WHERE id=owner) THEN
  INSERT INTO b1_notes_state(user_id,revision) VALUES(owner,1)
  ON CONFLICT(user_id) DO UPDATE SET revision=b1_notes_state.revision+1;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS b1_notes_prepare ON b1_notes;
CREATE TRIGGER b1_notes_prepare BEFORE UPDATE ON b1_notes FOR EACH ROW EXECUTE FUNCTION b1_notes_prepare_update();
DROP TRIGGER IF EXISTS b1_notes_revision ON b1_notes;
CREATE TRIGGER b1_notes_revision AFTER INSERT OR UPDATE OR DELETE ON b1_notes FOR EACH ROW EXECUTE FUNCTION b1_notes_changed();

CREATE OR REPLACE FUNCTION b1_save_note(owner text,operation uuid,fingerprint_value text,expected_board bigint,command jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE prior b1_notes_operations; version bigint; changed integer; target text; expected_note bigint;
        selected_ids text[]; actual_ids text[]; next_position integer;
        stored_bytes bigint; previous_bytes bigint; next_bytes bigint;
BEGIN
 PERFORM 1 FROM "user" WHERE id=owner FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('outcome','unauthorized'); END IF;
 SELECT * INTO prior FROM b1_notes_operations WHERE user_id=owner AND operation_id=operation;
 IF FOUND THEN
  IF prior.fingerprint=fingerprint_value THEN RETURN jsonb_build_object('outcome','duplicate','revision',prior.acknowledged_revision); END IF;
  RETURN jsonb_build_object('outcome','operation-reused');
 END IF;
 INSERT INTO b1_notes_state(user_id,revision) VALUES(owner,0) ON CONFLICT DO NOTHING;
 SELECT revision INTO version FROM b1_notes_state WHERE user_id=owner FOR UPDATE;
 target=command->>'id';
 expected_note=(command->>'expectedRevision')::bigint;
 IF command->>'kind'='save' THEN
  IF jsonb_typeof(command->'blocks') IS DISTINCT FROM 'array' OR jsonb_typeof(command->'title') IS DISTINCT FROM 'string' THEN RETURN jsonb_build_object('outcome','invalid'); END IF;
  SELECT COALESCE(sum(octet_length(title)+octet_length(blocks::text)),0) INTO stored_bytes FROM b1_notes WHERE user_id=owner;
  SELECT COALESCE((SELECT octet_length(title)+octet_length(blocks::text) FROM b1_notes WHERE user_id=owner AND id=target),0) INTO previous_bytes;
  next_bytes=octet_length(command->>'title')+octet_length((command->'blocks')::text);
  -- Existing imported history is preserved; reducing an oversized account is
  -- always allowed. The owner-row lock also serializes this storage budget.
  IF next_bytes>previous_bytes AND stored_bytes-previous_bytes+next_bytes>10485760 THEN RETURN jsonb_build_object('outcome','storage-limit'); END IF;
  IF expected_note IS NULL THEN
   IF EXISTS(SELECT 1 FROM b1_notes WHERE id=target) OR
      EXISTS(SELECT 1 FROM b1_notes_operations WHERE user_id=owner AND note_id=target) OR
      EXISTS(SELECT 1 FROM b1_notes_legacy_imports WHERE user_id=owner AND note_id=target)
   THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
   IF (SELECT count(*) FROM b1_notes WHERE user_id=owner)>=1000 THEN RETURN jsonb_build_object('outcome','limit'); END IF;
   SELECT COALESCE(max(position),-1)+1 INTO next_position FROM b1_notes WHERE user_id=owner AND NOT pinned;
   INSERT INTO b1_notes(id,user_id,title,blocks,position) VALUES(target,owner,command->>'title',command->'blocks',next_position);
  ELSE
   UPDATE b1_notes SET title=command->>'title',blocks=command->'blocks'
    WHERE id=target AND user_id=owner AND revision=expected_note;
   GET DIAGNOSTICS changed=ROW_COUNT; IF changed<>1 THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
  END IF;
 ELSIF command->>'kind'='delete' THEN
 DELETE FROM b1_notes WHERE id=target AND user_id=owner AND revision=expected_note;
  GET DIAGNOSTICS changed=ROW_COUNT; IF changed<>1 THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
  IF to_regclass('public.user_notes') IS NOT NULL THEN
   -- Keep array ordinals and the import tombstone stable. Dynamic SQL allows
   -- installations without the optional legacy table; parameters remain bound.
   EXECUTE $purge$
    UPDATE public.user_notes source
    SET data=jsonb_set(source.data,ARRAY[(imported.item_position-1)::text],'null'::jsonb,false)
    FROM b1_notes_legacy_imports imported
    WHERE imported.user_id=$1 AND imported.note_id=$2
     AND source.user_id=$1 AND source.id=imported.source_id
     AND jsonb_typeof(source.data)='array'
     AND jsonb_typeof(source.data #> ARRAY[(imported.item_position-1)::text])='object'
   $purge$ USING owner,target;
  END IF;
 ELSIF command->>'kind'='pin' THEN
  SELECT COALESCE(max(position),-1)+1 INTO next_position FROM b1_notes WHERE user_id=owner AND pinned=(command->>'pinned')::boolean;
  UPDATE b1_notes SET pinned=(command->>'pinned')::boolean,
    position=CASE WHEN pinned IS DISTINCT FROM (command->>'pinned')::boolean THEN next_position ELSE position END
    WHERE id=target AND user_id=owner AND revision=expected_note;
  GET DIAGNOSTICS changed=ROW_COUNT; IF changed<>1 THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
 ELSIF command->>'kind'='reorder' THEN
  IF version<>expected_board OR jsonb_typeof(command->'ids') IS DISTINCT FROM 'array' THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
  SELECT COALESCE(array_agg(value ORDER BY value),ARRAY[]::text[]) INTO selected_ids FROM jsonb_array_elements_text(command->'ids');
  SELECT COALESCE(array_agg(id ORDER BY id),ARRAY[]::text[]) INTO actual_ids FROM b1_notes WHERE user_id=owner AND pinned=(command->>'pinned')::boolean;
  IF selected_ids IS DISTINCT FROM actual_ids THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
  UPDATE b1_notes n SET position=ordered.ordinality::integer-1
   FROM jsonb_array_elements_text(command->'ids') WITH ORDINALITY ordered(id,ordinality)
   WHERE n.id=ordered.id AND n.user_id=owner;
 ELSE RETURN jsonb_build_object('outcome','invalid'); END IF;
 SELECT revision INTO version FROM b1_notes_state WHERE user_id=owner;
 INSERT INTO b1_notes_operations(user_id,operation_id,fingerprint,note_id,acknowledged_revision)
 VALUES(owner,operation,fingerprint_value,target,version);
 RETURN jsonb_build_object('outcome','saved','revision',version);
END $$;

-- Import bounded, structurally valid legacy NoteItem values. Malformed/oversized
-- records remain untouched in user_notes and in the normal account export.
-- Source row + array ordinal (not the potentially repeated legacy ID) identifies
-- an item. A ledger entry and its imported note are committed in this same block.
DO $$
DECLARE legacy record; item jsonb; digest text; note_id_value text; body text; title_value text;
        timestamp_value timestamptz; blocks_value jsonb; next_position integer; inserted integer;
BEGIN
 IF to_regclass('public.user_notes') IS NULL THEN RETURN; END IF;
 FOR legacy IN SELECT n.id AS source_id,n.user_id,a.value,a.ordinality
  FROM user_notes n CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(n.data)='array' THEN n.data ELSE '[]'::jsonb END) WITH ORDINALITY a(value,ordinality)
  ORDER BY n.user_id,n.id,a.ordinality
 LOOP
  item=legacy.value;
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR jsonb_typeof(item->'event') IS DISTINCT FROM 'string'
    OR jsonb_typeof(item->'createdAt') IS DISTINCT FROM 'number'
    OR (item ? 'description' AND jsonb_typeof(item->'description') IS DISTINCT FROM 'string')
    OR (item ? 'date' AND jsonb_typeof(item->'date') IS DISTINCT FROM 'string') THEN CONTINUE; END IF;
  IF (item->>'createdAt')::numeric<0 OR (item->>'createdAt')::numeric>253402300799000 THEN CONTINUE; END IF;
  title_value=item->>'event';
  body=CASE WHEN item ? 'date' AND item->>'date'<>'' THEN 'Date: '||(item->>'date')||E'\n\n' ELSE '' END||COALESCE(item->>'description','');
  IF char_length(title_value)>200 OR char_length(body)>20000 OR octet_length(title_value||body)>700000 THEN CONTINUE; END IF;
  timestamp_value=to_timestamp(((item->>'createdAt')::numeric/1000)::double precision);
  digest=md5(jsonb_build_array('notes-v1',legacy.user_id,legacy.source_id,legacy.ordinality)::text);
  note_id_value=substr(digest,1,8)||'-'||substr(digest,9,4)||'-5'||substr(digest,14,3)||'-a'||substr(digest,18,3)||'-'||substr(digest,21,12);
  INSERT INTO b1_notes_legacy_imports(user_id,source_id,item_position,note_id)
   VALUES(legacy.user_id,legacy.source_id,legacy.ordinality,note_id_value) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT; IF inserted=0 THEN CONTINUE; END IF;
  blocks_value=jsonb_build_array(jsonb_build_object('id',note_id_value||'-text','type','text','text',body));
  SELECT COALESCE(max(position),-1)+1 INTO next_position FROM b1_notes WHERE user_id=legacy.user_id AND NOT pinned;
  INSERT INTO b1_notes(id,user_id,title,blocks,created_at,updated_at,position)
   VALUES(note_id_value,legacy.user_id,title_value,blocks_value,timestamp_value,timestamp_value,next_position);
 END LOOP;
END $$;
