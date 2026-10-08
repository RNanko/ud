"use client";

import dynamic from "next/dynamic";
import { FinanceViewLoader } from "./FinanceViewTransition";

export const FinancePlayground = dynamic(() => import("./FinancePlayground"), {
  ssr: false,
  loading: () => <FinanceViewLoader label="Add action" />,
});
export const FinanceDashboard = dynamic(() => import("./FinanceDashboard"), {
  ssr: false,
  loading: () => <FinanceViewLoader label="Dashboard" />,
});
export const FinanceBoard = dynamic(() => import("./FinanceBoard"), {
  ssr: false,
  loading: () => <FinanceViewLoader label="Money board" />,
});
export const FinanceHistory = dynamic(() => import("./FinanceHistory"), {
  ssr: false,
  loading: () => <FinanceViewLoader label="History" />,
});
