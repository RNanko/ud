import type { CSSProperties } from "react";
import { GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import type { Feature } from "./journey-config";
import styles from "./journey.module.css";

export default function JourneyFeatureCard({ feature, selected, onChoose }: { feature: Feature; selected: boolean; onChoose: () => void }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: feature.id });
  const Icon = feature.icon;
  return <button ref={setNodeRef} {...listeners} type="button" className={styles.featureCard} style={{ "--accent": feature.color } as CSSProperties} aria-label={`Choose ${feature.title}`} aria-pressed={selected} aria-describedby="journey-status" data-dragging={isDragging} onClick={onChoose}>
    <Icon size={24} aria-hidden /><span>{feature.title}</span><GripVertical size={16} aria-hidden className={styles.grip} />
  </button>;
}
