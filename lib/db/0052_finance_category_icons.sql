-- Account-owned category appearance; previous clients preserve saved icons.
ALTER TABLE finance_categories ADD COLUMN icon text;
ALTER TABLE finance_categories ADD CONSTRAINT finance_categories_icon_known CHECK(icon IS NULL OR icon IN ('spending:01_01_groceries','spending:01_02_restaurants','spending:01_03_coffee','spending:01_04_takeout','spending:01_05_alcohol','spending:01_06_snacks','spending:01_07_food-delivery','spending:01_08_dining-out','spending:01_09_meal-prep','spending:01_10_vitamins','spending:02_01_rent','spending:02_02_mortgage','spending:02_03_utilities','spending:02_04_internet','spending:02_05_phone','spending:02_06_home-insurance','spending:02_07_property-tax','spending:02_08_maintenance','spending:02_09_furniture','spending:02_10_home-goods','spending:03_01_car','spending:03_02_fuel','spending:03_03_public-transit','spending:03_04_rideshare','spending:03_05_parking','spending:03_06_car-insurance','spending:03_07_car-service','spending:03_08_tolls','spending:03_09_bicycle','spending:03_10_ev-charging','spending:04_01_health-insurance','spending:04_02_doctor','spending:04_03_dental','spending:04_04_vision','spending:04_05_prescriptions','spending:04_06_therapy','spending:04_07_gym','spending:04_08_fitness-classes','spending:04_09_sports','spending:04_10_wellness','spending:05_01_subscriptions','spending:05_02_streaming','spending:05_03_music','spending:05_04_apps','spending:05_05_games','spending:05_06_books','spending:05_07_movies','spending:05_08_concerts','spending:05_09_events','spending:05_10_hobbies','spending:06_01_clothing','spending:06_02_shoes','spending:06_03_accessories','spending:06_04_beauty','spending:06_05_personal-care','spending:06_06_barber-salon','spending:06_07_electronics','spending:06_08_gifts','spending:06_09_shopping','spending:06_10_luxury','spending:07_01_travel','spending:07_02_flights','spending:07_03_hotels','spending:07_04_car-rental','spending:07_05_activities','spending:07_06_travel-insurance','spending:07_07_bags-gear','spending:07_08_cruises','spending:07_09_tours','spending:07_10_vacation','spending:08_01_work','spending:08_02_office-supplies','spending:08_03_software','spending:08_04_business-travel','spending:08_05_coworking','spending:08_06_education','spending:08_07_courses','spending:08_08_certificates','spending:08_09_conferences','spending:08_10_misc-work','spending:09_01_kids','spending:09_02_childcare','spending:09_03_school','spending:09_04_toys','spending:09_05_activities','spending:09_06_family-care','spending:09_07_pet-care','spending:09_08_pet-food','spending:09_09_pet-vet','spending:09_10_pet-supplies','spending:10_01_savings','spending:10_02_investments','spending:10_03_retirement','spending:10_04_emergency-fund','spending:10_05_debt-payment','spending:10_06_credit-card','spending:10_07_taxes','spending:10_08_fees-charges','spending:10_09_donations','spending:10_10_miscellaneous','revenue:award_trophy','revenue:cashflow','revenue:consulting','revenue:crypto_income','revenue:document_payment','revenue:donations_support','revenue:education_income','revenue:furniture_sales','revenue:gift_income','revenue:growth_chart','revenue:interest_income','revenue:investment_payout','revenue:invoice_payment','revenue:laptop','revenue:marketing','revenue:music_royalties','revenue:partnership','revenue:presentation_growth','revenue:receipt_income','revenue:recurring_revenue','revenue:rental_income','revenue:sales_checkout','revenue:sales_performance','revenue:savings_piggybank','revenue:shopping_revenue','revenue:startup_rocket','revenue:storefront','revenue:subscription_revenue','revenue:tips_jar','revenue:video_monetization'));
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
  INSERT INTO finance_categories(id,user_id,name,normalized_name,type,hidden,icon)
  VALUES('category:'||md5(owner||':'||(command->>'type')||':'||COALESCE(command->>'normalized_name',lower(category_name))),owner,category_name,COALESCE(command->>'normalized_name',lower(category_name)),command->>'type',(command->>'hidden')::boolean,command->>'icon')
  ON CONFLICT(user_id,type,normalized_name) DO UPDATE SET hidden=EXCLUDED.hidden,icon=CASE WHEN command ? 'icon' THEN EXCLUDED.icon ELSE finance_categories.icon END;
 ELSE RETURN jsonb_build_object('outcome','invalid'); END IF;
 SELECT revision INTO version FROM b1_mobile_finance_versions WHERE user_id=owner;
 INSERT INTO b1_mobile_finance_operations(user_id,operation_id,fingerprint,acknowledged_revision) VALUES(owner,operation,fingerprint_value,version);
 RETURN jsonb_build_object('outcome','saved','revision',version);
END $$;
