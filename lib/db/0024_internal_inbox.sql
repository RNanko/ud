-- Additive, account-owned INTERNAL inbox. No auth/billing/price/legal changes.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS b1_inbox_state (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 product text NOT NULL CHECK(product='b1-way-personal'),
 source_revision bigint NOT NULL DEFAULT 0, reconciled_revision bigint NOT NULL DEFAULT -1, initialized_at timestamptz NOT NULL DEFAULT now(),
 reconciled_at timestamptz, checked_at timestamptz, lease_id text, lease_until timestamptz,
 PRIMARY KEY(user_id,product)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS b1_notifications (
 id text PRIMARY KEY, schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 product text NOT NULL CHECK(product='b1-way-personal'), category text NOT NULL,
 dedup_key text NOT NULL, source_key text NOT NULL, source_revision bigint NOT NULL DEFAULT 0,
 title text NOT NULL, body text NOT NULL, target jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), occurred_at timestamptz NOT NULL,
 available_at timestamptz NOT NULL, published_at timestamptz, expires_at timestamptz,
 invalidated_at timestamptz, suppressed boolean NOT NULL DEFAULT false,
 read_at timestamptz, archived_at timestamptz, revision integer NOT NULL DEFAULT 1,
 UNIQUE(user_id,product,dedup_key),
 CHECK(category IN ('event_reminder','workout_completed','goal_milestone','journey_milestone','goal_reminder','weekly_review','product_update'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS b1_inbox_latest ON b1_notifications(user_id,product,published_at DESC,id DESC) WHERE archived_at IS NULL AND invalidated_at IS NULL AND NOT suppressed;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS b1_inbox_unread ON b1_notifications(user_id,product,published_at) WHERE read_at IS NULL AND archived_at IS NULL AND invalidated_at IS NULL AND NOT suppressed;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS b1_inbox_source ON b1_notifications(user_id,product,source_key);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS b1_app_messages (
 id text PRIMARY KEY, product text NOT NULL CHECK(product='b1-way-personal'), actor_id text NOT NULL,
 title text NOT NULL, body text NOT NULL, status text NOT NULL CHECK(status='published'),
 available_at timestamptz NOT NULL, expires_at timestamptz, target jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);

-- A durable source hook runs in the source write's transaction. A later app
-- request/worker retries evaluation. Bumping this generation invalidates any
-- in-flight evaluator; cleared copies cannot retain deleted private content.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION b1_inbox_source_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner text; item_id text; row_data jsonb;
BEGIN
 row_data := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 owner := row_data->>'user_id'; item_id := row_data->>'id';
 IF TG_TABLE_NAME='b1_account_settings' AND row_data->>'product'<>'b1-way-personal' THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM "user" WHERE id=owner) OR EXISTS(SELECT 1 FROM b1_deletions WHERE user_id=owner AND product='b1-way-personal') THEN RETURN NULL; END IF;
 IF TG_TABLE_NAME='user_events' AND NOT (row_data->>'week' ~ '^\d{4}-WK\d{1,2}$') THEN RETURN NULL; END IF;
 INSERT INTO b1_inbox_state(user_id,product,source_revision) VALUES(owner,'b1-way-personal',1)
 ON CONFLICT(user_id,product) DO UPDATE SET source_revision=b1_inbox_state.source_revision+1;
 IF TG_TABLE_NAME='b1_account_settings' THEN
  -- Preferences apply to unpublished announcements too; re-enabling never
  -- resurrects an occurrence suppressed while this category was off.
  UPDATE b1_notifications SET suppressed=true,revision=revision+1
  WHERE user_id=owner AND product='b1-way-personal' AND category='product_update'
  AND available_at>now() AND NOT suppressed
  AND NOT COALESCE((row_data->'notifications'->>'productUpdates')::boolean,true);
 END IF;
 IF TG_TABLE_NAME<>'b1_account_settings' THEN
  UPDATE b1_notifications SET invalidated_at=now(),title='',body='',revision=revision+1
  WHERE user_id=owner AND product='b1-way-personal' AND (
    category IN ('goal_milestone','journey_milestone','goal_reminder','weekly_review')
    OR TG_TABLE_NAME='user_events' AND category='event_reminder' AND target->>'kind'='event' AND target->>'week'=row_data->>'week'
    OR TG_TABLE_NAME='gym_plans' AND source_key='workout:'||item_id
    OR TG_TABLE_NAME='gym_sessions' AND (source_key='session:'||item_id OR source_key='workout:'||(row_data->>'plan_id'))
  ) AND (invalidated_at IS NULL OR title<>'' OR body<>'');
 END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS b1_inbox_events ON user_events;
--> statement-breakpoint
CREATE TRIGGER b1_inbox_events AFTER INSERT OR UPDATE OR DELETE ON user_events FOR EACH ROW EXECUTE FUNCTION b1_inbox_source_changed();
--> statement-breakpoint
DROP TRIGGER IF EXISTS b1_inbox_plans ON gym_plans;
--> statement-breakpoint
CREATE TRIGGER b1_inbox_plans AFTER INSERT OR UPDATE OR DELETE ON gym_plans FOR EACH ROW EXECUTE FUNCTION b1_inbox_source_changed();
--> statement-breakpoint
DROP TRIGGER IF EXISTS b1_inbox_sessions ON gym_sessions;
--> statement-breakpoint
CREATE TRIGGER b1_inbox_sessions AFTER INSERT OR UPDATE OR DELETE ON gym_sessions FOR EACH ROW EXECUTE FUNCTION b1_inbox_source_changed();
--> statement-breakpoint
DROP TRIGGER IF EXISTS b1_inbox_momentum ON momentum_state;
--> statement-breakpoint
CREATE TRIGGER b1_inbox_momentum AFTER INSERT OR UPDATE OR DELETE ON momentum_state FOR EACH ROW EXECUTE FUNCTION b1_inbox_source_changed();
--> statement-breakpoint
DROP TRIGGER IF EXISTS b1_inbox_todo ON kanban_board;
--> statement-breakpoint
CREATE TRIGGER b1_inbox_todo AFTER INSERT OR UPDATE OR DELETE ON kanban_board FOR EACH ROW EXECUTE FUNCTION b1_inbox_source_changed();
--> statement-breakpoint
DROP TRIGGER IF EXISTS b1_inbox_settings ON b1_account_settings;
--> statement-breakpoint
CREATE TRIGGER b1_inbox_settings AFTER INSERT OR UPDATE OR DELETE ON b1_account_settings FOR EACH ROW EXECUTE FUNCTION b1_inbox_source_changed();

-- Atomic snapshot application, serialized with the transactional source hook.
-- Read/archive state and the original publication timestamp are never reset.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION b1_apply_inbox_snapshot(owner text,scope text,generation bigint,token text,candidates jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE state b1_inbox_state; c jsonb;
BEGIN
 SELECT * INTO state FROM b1_inbox_state WHERE user_id=owner AND product=scope FOR UPDATE;
 IF NOT FOUND OR state.source_revision<>generation OR state.lease_id IS DISTINCT FROM token OR scope<>'b1-way-personal'
 OR EXISTS(SELECT 1 FROM b1_deletions WHERE user_id=owner AND product=scope) THEN RETURN false; END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(candidates) LOOP
  INSERT INTO b1_notifications(id,user_id,product,category,dedup_key,source_key,source_revision,title,body,target,occurred_at,available_at,published_at,expires_at,suppressed)
  VALUES(md5(owner||scope||(c->>'key')),owner,scope,c->>'category',c->>'key',c->>'sourceKey',generation,c->>'title',c->>'body',c->'target',
   (c->>'occurredAt')::timestamptz,(c->>'availableAt')::timestamptz,
   CASE WHEN NOT (c->>'suppressed')::boolean AND (c->>'availableAt')::timestamptz<=now() AND ((c->>'expiresAt') IS NULL OR (c->>'expiresAt')::timestamptz>now()) THEN now() END,
   (c->>'expiresAt')::timestamptz,(c->>'suppressed')::boolean)
  ON CONFLICT(user_id,product,dedup_key) DO UPDATE SET
   source_revision=generation,title=excluded.title,body=excluded.body,target=excluded.target,
   available_at=CASE WHEN excluded.category='event_reminder' THEN excluded.available_at ELSE b1_notifications.available_at END,
   occurred_at=CASE WHEN excluded.category='event_reminder' THEN excluded.occurred_at ELSE b1_notifications.occurred_at END,
   expires_at=excluded.expires_at,invalidated_at=NULL,
   suppressed=b1_notifications.suppressed OR (excluded.suppressed AND b1_notifications.published_at IS NULL),
   published_at=CASE WHEN NOT b1_notifications.suppressed AND NOT excluded.suppressed THEN COALESCE(b1_notifications.published_at,excluded.published_at) ELSE b1_notifications.published_at END,
   revision=b1_notifications.revision+CASE WHEN (b1_notifications.title,b1_notifications.body,b1_notifications.target,b1_notifications.expires_at,b1_notifications.invalidated_at,b1_notifications.published_at)
    IS DISTINCT FROM (excluded.title,excluded.body,excluded.target,excluded.expires_at,NULL,COALESCE(b1_notifications.published_at,excluded.published_at)) THEN 1 ELSE 0 END;
 END LOOP;
 UPDATE b1_notifications SET invalidated_at=now(),title='',body='',revision=revision+1
 WHERE user_id=owner AND product=scope AND category<>'product_update' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(candidates) item WHERE item->>'key'=dedup_key)
 AND (invalidated_at IS NULL OR title<>'' OR body<>'');
 UPDATE b1_inbox_state SET reconciled_at=now(),reconciled_revision=generation,lease_id=NULL,lease_until=NULL WHERE user_id=owner AND product=scope;
 RETURN true;
END $$;

-- The earlier shared mail worker already rejects reminder kinds. Cancel only
-- the ManForth legacy reminder IDs, leaving auth/security and other scopes alone.
--> statement-breakpoint
UPDATE b1_email_outbox SET status='suppressed',payload='',lease_until=NULL
WHERE kind='reminder' AND id LIKE 'b1-way-personal:%' AND status IN ('pending','retry');
