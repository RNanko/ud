"use client";
import { Printer, Download } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { LegalDocument } from "@/lib/legal/types";
export function downloadLegal(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function LegalActions({ document }: { document: LegalDocument }) {
  return <div className="legal-actions"><Button variant="outline" onClick={() => window.print()}><Printer size={17} />Print / save PDF</Button><Button variant="outline" asChild><a href={`/api/public/legal/document?kind=${document.kind}&version=${document.version}`}><Download size={17} />Download this version</a></Button></div>;
}
