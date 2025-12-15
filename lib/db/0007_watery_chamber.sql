CREATE TABLE "kanban_board" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP TABLE "finance_expenses" CASCADE;--> statement-breakpoint
DROP TABLE "finance_income" CASCADE;--> statement-breakpoint
ALTER TABLE "kanban_board" ADD CONSTRAINT "kanban_board_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;