"use client";

import AppErrorScreen, { type AppErrorProps } from "./components/shared/errors/AppErrorScreen";

export default function ErrorPage({ error, retry }: AppErrorProps) {
  return <AppErrorScreen error={error} onRetry={retry} fullPage />;
}
