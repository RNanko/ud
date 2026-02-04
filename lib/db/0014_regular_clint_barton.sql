ALTER TABLE "quote_likes" DROP CONSTRAINT "quote_likes_quote_id_quotes_id_fk";
--> statement-breakpoint
DROP INDEX "quote_likes_unique";--> statement-breakpoint
ALTER TABLE "quote_likes" ADD CONSTRAINT "quote_likes_quote_id_user_id_unique" UNIQUE("quote_id","user_id");