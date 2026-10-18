import { CalendarDays, Dumbbell, Wallet, TrendingUp, Flag, NotebookPen } from "lucide-react";
import type { CSSProperties } from "react";

export const features = [
  { id: "plan-event", title: "Plan Event", icon: CalendarDays, color: "#c18aff", description: "Put a meaningful moment on your calendar." },
  { id: "check-workout", title: "Check Workout", icon: Dumbbell, color: "#4ae3ae", description: "Record a completed training day." },
  { id: "track-finance", title: "Track Finance", icon: Wallet, color: "#ffb96b", description: "Understand income and spending." },
  { id: "invest-future", title: "Invest for Tomorrow", icon: TrendingUp, color: "#edce81", description: "Follow investments and contributions." },
  { id: "reach-goal", title: "Reach a Goal", icon: Flag, color: "#6cdcf2", description: "Explore a target you choose. Goal placement is a visual concept in this preview." },
  { id: "quick-note", title: "Capture a Note", icon: NotebookPen, color: "#80cfff", description: "Keep an idea before it disappears." },
] as const;
export type FeatureId = typeof features[number]["id"];
export type Feature = typeof features[number];
export type Point = { x: number; y: number };
// Coordinates are measured against the supplied originals, then normalized to
// the documented crops. Picture and overlays scale as one, without object-cover.
const desktop = (x: number, y: number): Point => ({ x: x / 1672, y: y / 941 });
const mobile = (x: number, y: number): Point => ({ x: (x - 180) / 620, y: (y - 350) / 956 });
export const checkpoints = [
  { id: "footpath", title: "Footpath", desktop: desktop(1290, 619), mobile: mobile(658, 1222), side: "left" },
  { id: "ridge", title: "Ridge", desktop: desktop(1285, 553), mobile: mobile(380, 1043), side: "right" },
  { id: "ascent", title: "Ascent", desktop: desktop(1288, 362), mobile: mobile(460, 792), side: "left" },
] as const;
export type CheckpointId = typeof checkpoints[number]["id"];
export type Placements = Partial<Record<CheckpointId, FeatureId>>;
export const illustratedCards = [
  { feature: "plan-event", desktop: desktop(1231, 247), mobile: mobile(344, 687), width: 176 / 1672, mobileWidth: 244 / 620 },
  { feature: "check-workout", desktop: desktop(1076, 358), mobile: mobile(617, 928), width: 198 / 1672, mobileWidth: 275 / 620 },
  { feature: "track-finance", desktop: desktop(1452, 430), mobile: null, width: 197 / 1672, mobileWidth: 0 },
  { feature: "reach-goal", desktop: desktop(1403, 116), mobile: null, width: 182 / 1672, mobileWidth: 0 },
] as const;
export function positionStyle(point: { desktop: Point; mobile: Point | null }): CSSProperties {
  return { "--x": `${point.desktop.x * 100}%`, "--y": `${point.desktop.y * 100}%`, "--mx": `${(point.mobile?.x ?? 0) * 100}%`, "--my": `${(point.mobile?.y ?? 0) * 100}%` } as CSSProperties;
}
export const featureById = (id: FeatureId) => features.find(feature => feature.id === id)!;
