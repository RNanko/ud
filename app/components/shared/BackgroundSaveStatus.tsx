"use client";

import { LoaderCircle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { BackgroundSaveError } from "@/lib/background-save-queue";

export default function BackgroundSaveStatus({
  count,
  failure,
  onRetry,
  onDiscard,
  showProgress = true,
}: {
  count: number;
  failure: BackgroundSaveError | null;
  onRetry: () => void;
  onDiscard: () => void;
  showProgress?: boolean;
}) {
  if (failure)
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm"
      >
        <p className="min-w-0 flex-1">{failure.message}</p>
        {failure.status !== "conflict" && (
          <Button variant="outline" onClick={onRetry}>
            Retry save
          </Button>
        )}
        {failure.status !== "unknown" && (
          <Button variant="ghost" onClick={onDiscard}>
            Use saved version
          </Button>
        )}
      </div>
    );
  if (!showProgress) return null;
  return (
    <span
      role="status"
      aria-live="polite"
      className="flex min-h-5 items-center gap-2 text-xs text-muted-foreground"
    >
      {count > 0 && (
        <>
          <LoaderCircle
            size={14}
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
          <span>Saving changes</span>
        </>
      )}
    </span>
  );
}
