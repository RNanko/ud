import { getFinanceSnapshot } from "@/lib/actions/finance.actions";
import { requireUserId } from "@/lib/session";
import FinanceClient from "./FinanceClient";

export async function Finance() {
  const userId = await requireUserId();
  const snapshot = await getFinanceSnapshot(userId);
  return (
    <FinanceClient
      initialEntries={snapshot.entries}
      initialCategories={snapshot.categories}
      initialRevision={snapshot.revision}
      userId={userId}
    />
  );
}
