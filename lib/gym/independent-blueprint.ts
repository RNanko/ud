import type { Blueprint } from "./types";

/** A copy is a one-off workout, not another instance of the source schedule. */
export function independentBlueprint(blueprint: Blueprint): Blueprint {
  const copy = structuredClone(blueprint);
  delete copy.scheduled;
  delete copy.momentumSeriesId;
  return copy;
}
