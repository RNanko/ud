"use client";
import { useState } from "react";
import Image from "next/image";
import { catalogueById } from "@/lib/gym/catalogue";
export default function CatalogueIcon({id, size = 96, label, decorative = true}: {id: string; size?: number; label?: string; decorative?: boolean}) {
  const asset = catalogueById.get(id), [failed, setFailed] = useState<string | null>(null);
  if (!asset || failed === asset.icon) return null;
  return <span className="inline-flex shrink-0 items-center justify-center" style={{width: size, height: size}} aria-hidden={decorative || undefined}>
    <Image src={asset.icon} alt={decorative ? "" : label || asset.name} width={size} height={size} loading="lazy" unoptimized className="object-contain" onError={() => setFailed(asset.icon)} />
  </span>;
}
