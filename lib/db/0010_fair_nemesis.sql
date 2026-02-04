CREATE TABLE "quote_likes" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"author" text NOT NULL,
	"quote" text NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_likes" ADD CONSTRAINT "quote_likes_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_user_unique" ON "quote_likes" USING btree ("quote_id","user_id");