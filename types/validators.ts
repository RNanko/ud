import z from "zod";

// export const financeExpensesSchema = z.object({
//   date: z.string().nonempty("Date is required"),
//   category: z.string().min(1, "Category is required"),
//   subcategory: z.string().min(1, "Subcategory is required"),
//   amount: z.coerce
//     .number("Amount must be a number")
//     .nonnegative("Enter expense without minus"),
//   comment: z.string().optional(),
// });

// export const financeIncomeSchema = z.object({
//   date: z.string().nonempty(),
//   category: z.string().min(1, "Category is required"),
//   amount: z.coerce
//     .number("Amount must be a number")
//     .nonnegative("Enter amount without minus"),
//   comment: z.string().optional(),
// });

export const financeTableSchema = z.object({
  date: z.string().nonempty("Date is required"),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().min(1, "Subcategory is required"),
  amount: z.coerce
    .number("Amount must be a number")
    .nonnegative("Enter amount without minus"),
  comment: z.string().optional().nullable(),
});