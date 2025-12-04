ALTER TABLE "finance_expenses" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_income" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_income" ADD CONSTRAINT "finance_income_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;