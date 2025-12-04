import { InferSelectModel } from "drizzle-orm";
import { financeTable } from "@/lib/db/schema";

type FinanceRow = InferSelectModel<typeof financeTable>;

export default function FinanceList({ data }: { data: FinanceRow[] }) {
  if (!data.length) {
    return <div>Empty list</div>;
  }

  return (
    <div className="container mx-auto py-5">
      <h2>TEXT</h2>

      {data.map((row) => (
        <div className="border-b-4 pb-2" key={row.id}>
          <p>Amount: {row.amount}</p>
          <p>Category: {row.category ?? "—"}</p>
          <p>Comment: {row.comment ?? "—"}</p>
          <p>Type: {row.type ?? "—"}</p>
        </div>
      ))}
    </div>
  );
}
