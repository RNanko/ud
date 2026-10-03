CREATE TABLE IF NOT EXISTS "momentum_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"mutations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'momentum_state_user_id_user_id_fk' AND conrelid = 'momentum_state'::regclass) THEN
    ALTER TABLE "momentum_state" ADD CONSTRAINT "momentum_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
