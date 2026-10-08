import type { z } from "zod";
import type { financeWriteSchema } from "../mobile/finance-contract";
import type { investmentWriteSchema } from "../mobile/investment-contract";
import type { FinanceEntry } from "../finance";
import type { FinanceCategory } from "../finance-playground";
import type { InvestmentPosition } from "../investments";

export type FinanceCommand = z.input<typeof financeWriteSchema>;
export type InvestmentCommand = z.input<typeof investmentWriteSchema>;
export type FinanceSnapshot = { revision: number; entries: FinanceEntry[]; categories: FinanceCategory[] };
export type InvestmentSnapshot = { revision: number; positions: (InvestmentPosition & { archived: boolean })[] };
export type MoneyResult<S> =
  | { success: true; acknowledgedOperationId: string; snapshot: S }
  | { success: false; status: "conflict"; message: string; snapshot: S }
  | { success: false; status: "rejected" | "unknown"; message: string };
