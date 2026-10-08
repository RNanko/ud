"use client";
import { Button } from "@/app/components/ui/button";

export default function MoneyRecovery({ status, message, draft, latest, canRetry = true, onRetry, onDiscard }: {
  status: "sending" | "unknown" | "conflict"; message: string; draft: string; latest?: string;
  canRetry?: boolean; onRetry: () => void; onDiscard: () => void;
}) {
  return <section role="alert" aria-label="Review pending money change" className="my-4 space-y-3 rounded-2xl border border-orange-400/40 bg-card p-4 text-sm">
    <p>{message}</p>
    <p className="whitespace-pre-wrap wrap-anywhere"><strong>Your change: </strong>{draft}</p>
    {status === "conflict" && <p className="whitespace-pre-wrap wrap-anywhere"><strong>Latest saved values: </strong>{latest}</p>}
    {status !== "sending" && <div className="flex flex-wrap gap-2">
      {canRetry && <Button type="button" variant="outline" onClick={onRetry}>{status === "conflict" ? "Save my change after review" : "Retry the same change"}</Button>}
      {status === "conflict" && <Button type="button" variant="ghost" onClick={onDiscard}>Discard my change and use latest</Button>}
    </div>}
    {status === "unknown" && <p>Keep this page open until the change is confirmed. The original details are held for a safe retry.</p>}
  </section>;
}
