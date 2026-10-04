-- Additive revisions/receipts around canonical manually recorded positions.
-- Caller privileges, no administrator execution or destructive backfill.
CREATE TABLE IF NOT EXISTS b1_mobile_investment_versions (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,revision bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS b1_mobile_investment_operations (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,operation_id uuid NOT NULL,
 fingerprint text NOT NULL,acknowledged_revision bigint NOT NULL,acknowledged_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,operation_id)
);
CREATE OR REPLACE FUNCTION b1_mobile_investment_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner text;
BEGIN
 IF TG_OP='UPDATE' AND to_jsonb(OLD) IS NOT DISTINCT FROM to_jsonb(NEW) THEN RETURN NEW; END IF;
 owner=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
 IF NOT EXISTS(SELECT 1 FROM "user" WHERE id=owner) THEN RETURN OLD; END IF;
 INSERT INTO b1_mobile_investment_versions(user_id,revision) VALUES(owner,1)
 ON CONFLICT(user_id) DO UPDATE SET revision=b1_mobile_investment_versions.revision+1;
 IF TG_OP='UPDATE' AND OLD.user_id<>NEW.user_id AND EXISTS(SELECT 1 FROM "user" WHERE id=OLD.user_id) THEN
  INSERT INTO b1_mobile_investment_versions(user_id,revision) VALUES(OLD.user_id,1)
  ON CONFLICT(user_id) DO UPDATE SET revision=b1_mobile_investment_versions.revision+1;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER b1_mobile_investment_position_revision AFTER INSERT OR UPDATE OR DELETE ON investment_positions
 FOR EACH ROW EXECUTE FUNCTION b1_mobile_investment_revision();
CREATE OR REPLACE FUNCTION b1_mobile_save_investment(owner text,operation uuid,fingerprint_value text,expected bigint,command jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE prior b1_mobile_investment_operations; version bigint; item jsonb; changed integer;
BEGIN
 PERFORM 1 FROM "user" WHERE id=owner FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('outcome','unauthorized'); END IF;
 SELECT * INTO prior FROM b1_mobile_investment_operations WHERE user_id=owner AND operation_id=operation;
 IF FOUND THEN
  IF prior.fingerprint=fingerprint_value THEN RETURN jsonb_build_object('outcome','duplicate','revision',prior.acknowledged_revision); END IF;
  RETURN jsonb_build_object('outcome','operation-reused');
 END IF;
 INSERT INTO b1_mobile_investment_versions(user_id,revision) VALUES(owner,0) ON CONFLICT DO NOTHING;
 SELECT revision INTO version FROM b1_mobile_investment_versions WHERE user_id=owner FOR UPDATE;
 IF version<>expected THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
 IF command->>'kind'='position' THEN
  item=command->'position';
  IF item->>'currency'<>'USD' THEN RETURN jsonb_build_object('outcome','invalid'); END IF;
  IF (command->>'create')::boolean THEN
   IF EXISTS(SELECT 1 FROM investment_positions WHERE id=command->>'id') OR EXISTS(
    SELECT 1 FROM b1_mobile_investment_operations WHERE user_id=owner AND fingerprint LIKE 'id:'||(command->>'id')||':%'
   ) THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
   INSERT INTO investment_positions(id,user_id,kind,asset_id,symbol,name,buy_price,quantity,bought_on,currency,manual_price,manual_price_at)
   VALUES(command->>'id',owner,item->>'kind',item->>'assetId',item->>'symbol',item->>'name',(item->>'buyPrice')::numeric,(item->>'quantity')::numeric,(item->>'boughtOn')::date,'USD',NULLIF(item->>'manualPrice','')::numeric,CASE WHEN NULLIF(item->>'manualPrice','') IS NULL THEN NULL ELSE now() AT TIME ZONE 'UTC' END);
  ELSE
   UPDATE investment_positions SET kind=item->>'kind',asset_id=item->>'assetId',symbol=item->>'symbol',name=item->>'name',
    buy_price=(item->>'buyPrice')::numeric,quantity=(item->>'quantity')::numeric,bought_on=(item->>'boughtOn')::date,
    manual_price=NULLIF(item->>'manualPrice','')::numeric,manual_price_at=CASE WHEN NULLIF(item->>'manualPrice','') IS NULL THEN NULL ELSE now() AT TIME ZONE 'UTC' END
    WHERE id=command->>'id' AND user_id=owner AND currency='USD' AND NOT archived;
   GET DIAGNOSTICS changed=ROW_COUNT;IF changed<>1 THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
  END IF;
 ELSIF command->>'kind'='archive' THEN
  UPDATE investment_positions SET archived=(command->>'archived')::boolean WHERE id=command->>'id' AND user_id=owner;
  GET DIAGNOSTICS changed=ROW_COUNT;IF changed<>1 THEN RETURN jsonb_build_object('outcome','conflict'); END IF;
 ELSE RETURN jsonb_build_object('outcome','invalid'); END IF;
 SELECT revision INTO version FROM b1_mobile_investment_versions WHERE user_id=owner;
 INSERT INTO b1_mobile_investment_operations(user_id,operation_id,fingerprint,acknowledged_revision) VALUES(owner,operation,fingerprint_value,version);
 RETURN jsonb_build_object('outcome','saved','revision',version);
END $$;
