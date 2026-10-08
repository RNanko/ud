"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Recovery links intentionally open a fresh document when app routing has failed. */

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowRight,
  CircleAlert,
  House,
  LifeBuoy,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { brand } from "@/lib/brand";
import styles from "./app-error.module.css";

export type AppErrorProps = { error: unknown; retry: () => void };

function errorReference(error: unknown): string | null {
  if (!error || (typeof error !== "object" && typeof error !== "function"))
    return null;
  try {
    // Never read arbitrary getters or show provider messages, stacks or payloads.
    const value = Object.getOwnPropertyDescriptor(error, "digest")?.value;
    return typeof value === "string" &&
      /^\d{1,10}$/.test(value) &&
      Number(value) <= 4_294_967_295
      ? value
      : null;
  } catch {
    return null;
  }
}

export default function AppErrorScreen({
  error,
  onRetry,
  title = "Let’s try that again.",
  fullPage = false,
}: {
  error?: unknown;
  onRetry: () => void;
  title?: string;
  fullPage?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [offline, setOffline] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const reference = errorReference(error);
  const Content = fullPage ? "main" : "div";

  console.log(error);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const connected = () => setOffline(false),
      disconnected = () => setOffline(true);
    if (!navigator.onLine) disconnected();
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, []);

  const retry = () => {
    if (pending) return;
    setRetryFailed(false);
    startTransition(() => {
      try {
        onRetry();
      } catch {
        setRetryFailed(true);
      }
    });
  };

  return (
    <div
      className={`${styles.shell} ${fullPage ? styles.fullPage : styles.inWorkspace}`}
    >
      {fullPage && (
        <header className={styles.header}>
          <a
            href="/"
            className={styles.brand}
            aria-label={`${brand.productName} home`}
          >
            <span className={styles.wordmark}>{brand.wordmark}</span>
            <span className={styles.byline}>{brand.brandLine}</span>
          </a>
          <a href="/help" className={styles.headerHelp}>
            <LifeBuoy size={16} aria-hidden="true" />
            Help
          </a>
        </header>
      )}

      <Content className={styles.content}>
        <section className={styles.card} aria-labelledby="app-error-title">
          <div className={styles.illustration} aria-hidden="true">
            <span className={styles.outerOrbit} />
            <span className={styles.innerOrbit} />
            <span className={styles.core}>
              <CircleAlert size={34} strokeWidth={1.5} />
            </span>
            <span className={styles.orbitDot} />
          </div>
          <p className={styles.eyebrow}>Page unavailable</p>
          <h1
            id="app-error-title"
            ref={heading}
            tabIndex={-1}
            className={styles.title}
          >
            {title}
          </h1>
          <p className={styles.description} role="status" aria-live="polite">
            {offline
              ? "You’re offline. Reconnect, then try again."
              : retryFailed
                ? "We couldn’t restart this page. Reload it to try a fresh start."
                : "Something interrupted this page. Try again, or return to your workspace."}
          </p>

          <nav className={styles.actions} aria-label="Page recovery">
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              onClick={retry}
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? (
                <LoaderCircle
                  size={18}
                  className={styles.spinner}
                  aria-hidden="true"
                />
              ) : (
                <RefreshCw size={18} aria-hidden="true" />
              )}
              {pending ? "Trying again…" : "Try again"}
            </button>
            <a
              href="/account/momentum"
              className={`${styles.button} ${styles.secondary}`}
            >
              Open app
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </nav>

          <div className={styles.secondaryActions}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={styles.textLink}
            >
              Reload page
            </button>
            <span aria-hidden="true">·</span>
            <a href="/" className={styles.textLink}>
              <House size={15} aria-hidden="true" />
              Back to home
            </a>
          </div>
          {reference && (
            <p className={styles.reference}>
              Reference <span>{reference}</span>
            </p>
          )}
        </section>
      </Content>

      <footer className={styles.footer}>
        <span>Still having trouble?</span>
        <a href="/help" className={styles.textLink}>
          <LifeBuoy size={16} aria-hidden="true" />
          Get help
          <ArrowRight size={14} aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}
