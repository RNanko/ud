import z from "zod";

export const financeEntrySchema = z.object({
  type: z.enum(["+", "-"]),
  currency: z.enum(["PLN", "EUR", "USD"]).optional(),
  date: z.iso.date("Choose a valid date"),
  category: z.string().trim().min(1, "Add a category").max(200),
  subcategory: z.string().trim().max(200).optional().default(""),
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a positive amount with up to two decimals")
    .transform(Number).pipe(z.number().finite().positive("Amount must be greater than zero").max(999999999999, "Amount is too large")),
  comment: z.string().trim().max(5000).optional().default(""),
});

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
  date: z.iso.date("Enter a valid date"),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().min(1, "Subcategory is required"),
  amount: z.string().trim().min(1, "Amount is required").transform(Number).pipe(
    z.number("Amount must be a number").finite().nonnegative("Enter amount without minus"),
  ),
  comment: z.string().optional().nullable(),
});
