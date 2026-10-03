CREATE TABLE "gym_entities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"last_mutation" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gym_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"timezone" text NOT NULL,
	"data" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"last_mutation" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gym_rest_days" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"timezone" text NOT NULL,
	"rest" boolean NOT NULL,
	CONSTRAINT "gym_rest_owner_date_unique" UNIQUE("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "gym_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text,
	"data" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"last_mutation" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gym_sessions_plan_unique" UNIQUE("plan_id")
);
--> statement-breakpoint
ALTER TABLE "gym_entities" ADD CONSTRAINT "gym_entities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_plans" ADD CONSTRAINT "gym_plans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_rest_days" ADD CONSTRAINT "gym_rest_days_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_sessions" ADD CONSTRAINT "gym_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_sessions" ADD CONSTRAINT "gym_sessions_plan_id_gym_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."gym_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gym_entities_owner_idx" ON "gym_entities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gym_plans_owner_date_idx" ON "gym_plans" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "gym_sessions_owner_idx" ON "gym_sessions" USING btree ("user_id");