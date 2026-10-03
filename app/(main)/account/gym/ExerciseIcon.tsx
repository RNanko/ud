"use client";

import { useState } from "react";
import { Dumbbell } from "lucide-react";
import Image from "next/image";
import { exerciseArtwork, exerciseIcons, categoryIcons } from "@/lib/gym/icons";
import type { Category, IconKey } from "@/lib/gym/types";
export default function ExerciseIcon({
  icon,
  exerciseId,
  size = 64,
  label,
  decorative = true
}: {
  icon: IconKey;
  exerciseId?: string;
  size?: number;
  label?: string;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const artwork = exerciseId ? exerciseArtwork[exerciseId] : undefined;
  const source = [artwork, exerciseIcons[icon]].find(src => src && !failed.includes(src));
  return <span style={{
    width: size,
    height: size
  }} className="inline-flex shrink-0 items-center justify-center" aria-hidden={decorative || undefined}>{!source ? <Dumbbell size={size / 2} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label || "Exercise"} /> : <Image src={source} width={size} height={size} unoptimized loading="lazy" alt={decorative ? "" : label || "Exercise equipment"} onError={() => setFailed(previous => [...previous, source])} />}</span>;
}

export function ExerciseCategoryIcon({ category }: { category: Category }) {
  return <Image src={categoryIcons[category]} width={32} height={32} unoptimized loading="lazy" alt="" aria-hidden />;
}
