import "server-only";
import { ZodError } from "zod";
import type { MoneyResult } from "./types";

export async function moneyAction<S>(
  write: () => Promise<{ acknowledgedOperationId: string }>,
  read: () => Promise<S>,
): Promise<MoneyResult<S>> {
  try {
    const receipt = await write();
    // The receipt may describe an older successful operation. Always render the
    // current snapshot, so replaying a create cannot resurrect a deleted record.
    return { success: true, acknowledgedOperationId: receipt.acknowledgedOperationId, snapshot: await read() };
  } catch (error) {
    const domainError = error instanceof Error && "status" in error && "code" in error ? error as Error & { status: number; code: string } : null;
    if (domainError?.status === 409) {
      try {
        return { success: false, status: "conflict", message: "Newer changes exist. Your draft is kept. Review the latest values before saving again.", snapshot: await read() };
      } catch { /* A missing response stays retryable with the original envelope. */ }
    } else if (error instanceof ZodError) {
      return { success: false, status: "rejected", message: error.issues[0]?.message || "Check your details." };
    } else if (domainError && [400, 401, 403].includes(domainError.status)) {
      return { success: false, status: "rejected", message: domainError.message };
    }
    return { success: false, status: "unknown", message: "We could not confirm this change. Your draft is kept. Retry the same change to check its outcome safely." };
  }
}
