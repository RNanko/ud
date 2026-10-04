"use client";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";

/** The readable server preview stays available even without JS or when the interactive chunk fails. */
export default function DeferredAppPreview({ preview, children, momentum }: { preview: ReactNode; children: ReactNode; momentum: ReactNode }) {
  const [Preview, setPreview] = useState<ComponentType<{ children: ReactNode }> | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  const container = useRef<HTMLDivElement>(null), pending = useRef(false), mounted = useRef(true);
  async function load() {
    if (pending.current) return;
    pending.current = true;
    setStatus("loading");
    try {
      const loaded = await import("./AppPreview");
      if (mounted.current) setPreview(() => loaded.default);
    } catch {
      if (mounted.current) setStatus("failed");
      pending.current = false;
    }
  }
  useEffect(() => {
    mounted.current = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { observer.disconnect(); void load(); }
    }, { threshold: 0.01 });
    if (container.current) observer.observe(container.current);
    return () => { mounted.current = false; observer.disconnect(); };
  }, []);
  return <div ref={container}>
    {Preview ? <Preview>{children}</Preview> : <>
      {preview}
      <div className="mf-preview-load"><button type="button" className="mf-primary" onClick={() => void load()} disabled={status === "loading"}>{status === "failed" ? "Retry interactive preview" : status === "loading" ? "Loading interactive preview…" : "Load interactive preview"}</button><p className="mf-small" role="status">{status === "failed" ? "The interactive preview could not load. The examples below remain readable." : "Example data only. Loading the demo does not change your account."}</p></div>
      {children}{momentum}
    </>}
  </div>;
}
