-- Additive Finance revisions/receipts; the existing tables remain canonical.
CREATE TABLE IF NOT EXISTS b1_mobile_finance_versions (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS b1_mobile_finance_operations (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 operation_id uuid NOT NULL, fingerprint text NOT NULL, acknowledged_revision bigint NOT NULL,
 acknowledged_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,operation_id)
);
CREATE OR REPLACE FUNCTION b1_mobile_finance_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner text;
BEGIN
 IF TG_OP='UPDATE' AND to_jsonb(OLD) IS NOT DISTINCT FROM to_jsonb(NEW) THEN RETURN NEW; END IF;
 owner=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
 IF NOT EXISTS(SELECT 1 FROM "user" WHERE id=owner) THEN RETURN OLD; END IF;
 INSERT INTO b1_mobile_finance_versions(user_id,revision) VALUES(owner,1)
 ON CONFLICT(user_id) DO UPDATE SET revision=b1_mobile_finance_versions.revision+1;
 IF TG_OP='UPDATE' AND OLD.user_id<>NEW.user_id AND EXISTS(SELECT 1 FROM "user" WHERE id=OLD.user_id) THEN
  INSERT INTO b1_mobile_finance_versions(user_id,revision) VALUES(OLD.user_id,1)
  ON CONFLICT(user_id) DO UPDATE SET revision=b1_mobile_finance_versions.revision+1;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER b1_mobile_finance_entry_revision AFTER INSERT OR UPDATE OR DELETE ON finance_table
 FOR EACH ROW EXECUTE FUNCTION b1_mobile_finance_revision();
CREATE TRIGGER b1_mobile_finance_category_revision AFTER INSERT OR UPDATE OR DELETE ON finance_categories
 FOR EACH ROW EXECUTE FUNCTION b1_mobile_finance_revision();

CREATE OR REPLACE FUNCTION b1_mobile_save_finance(owner text,operation uuid,fingerprint_value text,expected bigint,command jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE prior b1_mobile_finance_operations; version bigint; item jsonb; changed integer; category_name text;
BEGIN
 PERFORM 1 FROM "user" WHERE id=owner FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('outcome','unauthorized'); END IF;
 SELECT * INTO prior FROM b1_mobile_finance_operations WHERE user_id=owner AND operation_id=operation;
 IF FOUND THEN
  IF prior.fingerprint=fingerprint_value THEN RETURN jsonb_build_object('outcome','duplicate','revision',prior.acknowledged_revision); END IF; RETURN jsonb_build_object('outcome','operation-reused');
 END IF;
 INSERT INTO b1_mobile_finance_versions(user_id,revision) VALUES(owner,0) ON CONFLICT DO NOTHING;
 SELECT revision INTO version FROM b1_mobile_finance_versions WHERE user_id=owner FOR UPDATE;
 IF version<>expected THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
 IF command->>'kind'='entry' THEN
  item=command->'entry';
  IF (command->>'create')::boolean THEN
   -- A previously acknowledged creation is handled above. Existing or deleted
   -- IDs cannot be reused to resurrect a record through a new operation.
   IF EXISTS(SELECT 1 FROM finance_table WHERE id=command->>'id') THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
   IF EXISTS(SELECT 1 FROM b1_mobile_finance_operations WHERE user_id=owner AND fingerprint LIKE 'id:'||(command->>'id')||':%') THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
   INSERT INTO finance_table(id,user_id,date,amount,currency,category,subcategory,comment,type)
   VALUES(command->>'id',owner,(item->>'date')::timestamp,(item->>'amount')::numeric,item->>'currency',item->>'category',NULLIF(item->>'subcategory',''),NULLIF(item->>'comment',''),item->>'type');
  ELSE
   UPDATE finance_table SET date=(item->>'date')::timestamp,amount=(item->>'amount')::numeric,
    category=item->>'category',subcategory=NULLIF(item->>'subcategory',''),comment=NULLIF(item->>'comment',''),type=item->>'type'
    WHERE id=command->>'id' AND user_id=owner;
   GET DIAGNOSTICS changed=ROW_COUNT; IF changed<>1 THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
   -- Currency is intentionally not updated, including null/legacy values.
  END IF;
 ELSIF command->>'kind'='delete' THEN
  DELETE FROM finance_table WHERE id=command->>'id' AND user_id=owner;
  GET DIAGNOSTICS changed=ROW_COUNT; IF changed<>1 THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
 ELSIF command->>'kind'='category' THEN
  category_name=command->>'name';
  INSERT INTO finance_categories(id,user_id,name,normalized_name,type,hidden)
  VALUES('category:'||md5(owner||':'||(command->>'type')||':'||COALESCE(command->>'normalized_name',lower(category_name))),owner,category_name,COALESCE(command->>'normalized_name',lower(category_name)),command->>'type',(command->>'hidden')::boolean)
  ON CONFLICT(user_id,type,normalized_name) DO UPDATE SET hidden=EXCLUDED.hidden;
 ELSE RETURN jsonb_build_object('outcome','invalid'); END IF;
 SELECT revision INTO version FROM b1_mobile_finance_versions WHERE user_id=owner;
 INSERT INTO b1_mobile_finance_operations(user_id,operation_id,fingerprint,acknowledged_revision) VALUES(owner,operation,fingerprint_value,version);
 RETURN jsonb_build_object('outcome','saved','revision',version);
END $$;
