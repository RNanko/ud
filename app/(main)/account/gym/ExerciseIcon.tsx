"use client";

import { categoryIconIds, resolveExerciseIconId } from "@/lib/gym/icons";
import type { Category, IconKey } from "@/lib/gym/types";
import CatalogueIcon from "./CatalogueIcon";
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
  const id = resolveExerciseIconId(exerciseId, icon);
  return id ? <CatalogueIcon id={id} size={size} label={label} decorative={decorative} /> : null;
}

export function ExerciseCategoryIcon({ category }: { category: Category }) {
  return <CatalogueIcon id={categoryIconIds[category]} size={32} />;
}
