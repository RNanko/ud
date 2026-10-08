"use client";

import { LoaderCircle } from "lucide-react";
import { Button } from "@/app/components/ui/button";

export default function SessionButton({ status = "loading", onRetry, className }: {
  status?: "loading" | "error";
  onRetry?: () => void;
  className?: string;
}) {
  const loading = status === "loading";
  return <Button type="button" className={className} disabled={loading} aria-busy={loading}
    aria-label={loading ? "Loading account" : "Retry account check"} onClick={onRetry}>
    {loading ? <LoaderCircle size={20} className="motion-safe:animate-spin" aria-hidden="true" /> : "Retry connection"}
  </Button>;
}
