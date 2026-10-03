import { Suspense } from "react";
import Loader from "@/app/components/shared/loader";
import { getFinanceData, getFinanceCategories } from "@/lib/actions/finance.actions";
import { requireUserId } from "@/lib/session";
import { serializeFinanceEntry } from "@/lib/finance";
import FinanceClient from "./FinanceClient";

export default function Page() {
  return <Suspense fallback={<Loader />}><Finance /></Suspense>;
}

export async function Finance() {
  const userId = await requireUserId();
  const [data, categories] = await Promise.all([getFinanceData(userId), getFinanceCategories(userId)]);
  return <FinanceClient initialEntries={data.map(serializeFinanceEntry)} initialCategories={categories} userId={userId} />;
}
