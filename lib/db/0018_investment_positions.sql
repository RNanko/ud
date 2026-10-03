CREATE TABLE "investment_positions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"asset_id" text,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"buy_price" numeric(30, 12) NOT NULL,
	"quantity" numeric(30, 12) NOT NULL,
	"bought_on" date NOT NULL,
	"manual_price" numeric(30, 12),
	"manual_price_at" timestamp,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "investment_positions" ADD CONSTRAINT "investment_positions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "investment_positions_owner_idx" ON "investment_positions" USING btree ("user_id");