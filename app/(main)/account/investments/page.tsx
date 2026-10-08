import { Suspense } from "react";
import Loader from "@/app/components/shared/loader";
import { getInvestmentSnapshot } from "@/lib/actions/investments.actions";
import { investmentMarket } from "@/lib/investment-market";
import InvestmentsClient from "./InvestmentsClient";
// The private workspace waits for a verified session before rendering this page.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Investments />
    </Suspense>
  );
}
async function Investments() {
  const snapshot = await getInvestmentSnapshot();
  const positions = snapshot.positions.filter(position => !position.archived);
  const market = await investmentMarket(positions);
  return (
    <InvestmentsClient initialRevision={snapshot.revision} initialPositions={positions} initialMarket={market} />
  );
}
