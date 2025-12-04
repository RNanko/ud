CREATE TABLE "finance_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"category" text NOT NULL,
	"subcategory" text NOT NULL,
	"emount" numeric NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "finance_income" (
	"id" text PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"emount" numeric DEFAULT '0' NOT NULL,
	"source" text,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
