import type { Units } from "./types";

export const gymUnitsKey = "gym-display-units";
export const defaultGymUnits: Units = { weight: "kg", distance: "km" };
export function parseGymUnits(value: string | null): Units | null {
  try {
    const saved = JSON.parse(value || "null");
    return saved && ["kg", "lb"].includes(saved.weight) && ["km", "mi"].includes(saved.distance)
      ? { weight: saved.weight, distance: saved.distance } : null;
  } catch { return null; }
}
