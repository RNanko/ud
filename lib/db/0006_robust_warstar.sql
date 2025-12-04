CREATE TABLE "finance_table" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" timestamp NOT NULL,
	"amount" numeric DEFAULT '0' NOT NULL,
	"category" text,
	"subcategory" text,
	"comment" text,
	"type" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "finance_table" ADD CONSTRAINT "finance_table_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;