ALTER TABLE "quote_likes" DROP CONSTRAINT "quote_likes_quote_id_quotes_id_fk";
--> statement-breakpoint
DROP INDEX "quote_user_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "quote_likes_unique" ON "quote_likes" USING btree ("quote_id","user_id");