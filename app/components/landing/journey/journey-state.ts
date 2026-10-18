import type { CheckpointId, FeatureId, Placements } from "./journey-config";

export function placeFeature(placements: Placements, feature: FeatureId, target: CheckpointId, from: CheckpointId | null = null): { placements: Placements; occupied: boolean } {
  if (placements[target] && target !== from) return { placements, occupied: true };
  const next = { ...placements };
  if (from) delete next[from];
  next[target] = feature;
  return { placements: next, occupied: false };
}
