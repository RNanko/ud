CREATE TABLE "finance_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "finance_categories_owner_type_name" UNIQUE("user_id","type","normalized_name")
);
--> statement-breakpoint
ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;