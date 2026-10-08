"use client";

import { useEffect } from "react";
import AppErrorScreen, { type AppErrorProps } from "./components/shared/errors/AppErrorScreen";
import styles from "./components/shared/errors/app-error.module.css";

export default function GlobalError({ error, retry }: AppErrorProps) {
  useEffect(() => {
    let preference = "system";
    try { preference = localStorage.getItem("theme") ?? "system"; } catch { /* System theme remains available. */ }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.appErrorTheme = preference === "dark" || (preference !== "light" && media.matches) ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => { media.removeEventListener("change", apply); delete document.documentElement.dataset.appErrorTheme; };
  }, []);

  return <html lang="en" className={styles.document}>
    <head><title>Something went wrong | ManForth</title><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
    <body><AppErrorScreen error={error} onRetry={retry} fullPage /></body>
  </html>;
}
