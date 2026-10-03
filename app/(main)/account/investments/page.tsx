import { Suspense } from "react";
import Loader from "@/app/components/shared/loader";
import { getInvestmentPositions } from "@/lib/actions/investments.actions";
import { investmentMarket } from "@/lib/investment-market";
import InvestmentsClient from "./InvestmentsClient";

export default function Page() { return <Suspense fallback={<Loader />}><Investments /></Suspense>; }
async function Investments() {
  const positions = await getInvestmentPositions();
  const market = await investmentMarket(positions);
  return <InvestmentsClient initialPositions={positions} initialMarket={market} />;
}
