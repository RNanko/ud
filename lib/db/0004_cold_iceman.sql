ALTER TABLE "finance_expenses" RENAME COLUMN "emount" TO "amount";--> statement-breakpoint
ALTER TABLE "finance_income" RENAME COLUMN "emount" TO "amount";--> statement-breakpoint
ALTER TABLE "finance_income" RENAME COLUMN "source" TO "category";