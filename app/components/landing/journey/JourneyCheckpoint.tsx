import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import type { CSSProperties } from "react";
import { checkpoints, featureById, positionStyle, type FeatureId } from "./journey-config";
import styles from "./journey.module.css";

export default function JourneyCheckpoint({ point, featureId, selected, onChoose }: {
  point: typeof checkpoints[number]; featureId?: FeatureId; selected: boolean; onChoose: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: point.id });
  const feature = featureId ? featureById(featureId) : null;
  const Icon = feature?.icon ?? Plus;
  return <div ref={setNodeRef} className={`${styles.checkpointSlot} ${point.id === "ridge" ? styles.ridgeSlot : ""}`} style={{ ...positionStyle(point), "--accent": feature?.color ?? "#8dd7eb" } as CSSProperties} data-occupied={!!feature} data-over={isOver} data-ready={selected}>
    <button type="button" className={`${styles.checkpoint} ${feature ? styles.placed : ""} ${point.id === "ridge" ? styles.bakedSlot : ""}`} onClick={onChoose} aria-label={`${point.title}: ${feature ? feature.title + ", view or move demo card" : "empty checkpoint, place selected card"}`} aria-describedby="journey-status">
      <Icon size={20} aria-hidden />{feature ? <span>{feature.title}</span> : point.id === "ridge" ? <span className={styles.dropLabel}>Add milestone here<small>Choose a card to begin</small></span> : null}
    </button>
  </div>;
}
