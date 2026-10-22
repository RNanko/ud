-- Explicit currency edits use the existing atomic revisions and receipts.
-- No records are changed by this migration; old clients keep their behavior.
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
  IF COALESCE((command->>'changeCurrency')::boolean,false) AND
   (item->>'currency' IS NULL OR item->>'currency' NOT IN ('USD','EUR','GBP','CAD','AUD','CHF','JPY','CNY','HKD','SGD','INR','PLN','AED','NONE'))
   THEN RETURN jsonb_build_object('outcome','invalid'); END IF;
  IF (command->>'create')::boolean THEN
   -- A previously acknowledged creation is handled above. Existing or deleted
   -- IDs cannot be reused to resurrect a record through a new operation.
   IF EXISTS(SELECT 1 FROM finance_table WHERE id=command->>'id') THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
   IF EXISTS(SELECT 1 FROM b1_mobile_finance_operations WHERE user_id=owner AND fingerprint LIKE 'id:'||(command->>'id')||':%') THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
   INSERT INTO finance_table(id,user_id,date,amount,currency,category,subcategory,comment,type)
   VALUES(command->>'id',owner,(item->>'date')::timestamp,(item->>'amount')::numeric,item->>'currency',item->>'category',NULLIF(item->>'subcategory',''),NULLIF(item->>'comment',''),item->>'type');
  ELSE
   UPDATE finance_table SET date=(item->>'date')::timestamp,amount=(item->>'amount')::numeric,
    currency=CASE WHEN COALESCE((command->>'changeCurrency')::boolean,false) THEN item->>'currency' ELSE currency END,
    category=item->>'category',subcategory=NULLIF(item->>'subcategory',''),comment=NULLIF(item->>'comment',''),type=item->>'type'
    WHERE id=command->>'id' AND user_id=owner;
   GET DIAGNOSTICS changed=ROW_COUNT; IF changed<>1 THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
   -- Older commands preserve null/legacy currencies unless explicitly changed.
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
