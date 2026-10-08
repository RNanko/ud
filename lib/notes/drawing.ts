import type { NotePoint, NoteStroke } from "../notes";

export const DRAWING_WIDTH = 1000;
export const DRAWING_HEIGHT = 700;
export const DRAWING_HISTORY_LIMIT = 30;
export const DRAWING_COLORS = [
  { name: "Ink", value: "#172033" },
  { name: "Blue", value: "#2563EB" },
  { name: "Green", value: "#15803D" },
  { name: "Orange", value: "#C2410C" },
  { name: "Red", value: "#DC2626" },
  { name: "Purple", value: "#7C3AED" },
] as const;
export const DRAWING_WIDTHS = [2, 5, 10] as const;

type PaperRect = { left: number; top: number; width: number; height: number };
const unit = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 100_000) / 100_000;

/** Coordinates remain independent of viewport, scroll position and pixel density. */
export function drawingPoint(clientX: number, clientY: number, rect: PaperRect): NotePoint | null {
  if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
  return { x: unit((clientX - rect.left) / rect.width), y: unit((clientY - rect.top) / rect.height) };
}

/** Keep the endpoint, discard subpixel duplicates and never exceed the server limit. */
export function extendDrawingPoints(points: NotePoint[], incoming: NotePoint[], limit: number, endpoint = false): NotePoint[] {
  const next = [...points];
  for (let index = 0; index < incoming.length && next.length < limit; index++) {
    const point = incoming[index], previous = next.at(-1);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) continue;
    const distance = previous ? Math.hypot((point.x - previous.x) * DRAWING_WIDTH, (point.y - previous.y) * DRAWING_HEIGHT) : Infinity;
    if (distance > 0 && (distance >= 0.7 || endpoint && index === incoming.length - 1)) next.push(point);
  }
  return next.length === points.length ? points : next;
}

export function drawingSurface(width: number, density: number) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
  // Bound backing-store allocation on high-density/zoomed displays.
  const ratio = Number.isFinite(density) && density > 0 ? Math.min(density, 3) : 1;
  const pixelWidth = Math.min(4096, Math.max(1, Math.round(safeWidth * ratio)));
  return { width: pixelWidth, height: Math.max(1, Math.round(pixelWidth * DRAWING_HEIGHT / DRAWING_WIDTH)) };
}

export type DrawingHistory = { past: NoteStroke[][]; present: NoteStroke[]; future: NoteStroke[][] };
export const createDrawingHistory = (strokes: NoteStroke[]): DrawingHistory => ({ past: [], present: [...strokes], future: [] });
export function sameDrawing(left: NoteStroke[], right: NoteStroke[]) {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}
export function commitDrawing(history: DrawingHistory, strokes: NoteStroke[]): DrawingHistory {
  if (sameDrawing(history.present, strokes)) return history;
  return { past: [...history.past, history.present].slice(-DRAWING_HISTORY_LIMIT), present: [...strokes], future: [] };
}
export function undoDrawing(history: DrawingHistory): DrawingHistory {
  const previous = history.past.at(-1);
  return previous ? { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future].slice(0, DRAWING_HISTORY_LIMIT) } : history;
}
export function redoDrawing(history: DrawingHistory): DrawingHistory {
  const next = history.future[0];
  return next ? { past: [...history.past, history.present].slice(-DRAWING_HISTORY_LIMIT), present: next, future: history.future.slice(1) } : history;
}

/** Replay ordered vectors: erasing changes earlier ink without repainting the paper. */
export function renderDrawing(context: CanvasRenderingContext2D, strokes: NoteStroke[], width: number, height: number) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.setTransform(width / DRAWING_WIDTH, 0, 0, height / DRAWING_HEIGHT, 0, 0);
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.beginPath();
    const first = stroke.points[0];
    if (stroke.points.length === 1) {
      context.arc(first.x * DRAWING_WIDTH, first.y * DRAWING_HEIGHT, stroke.width / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.moveTo(first.x * DRAWING_WIDTH, first.y * DRAWING_HEIGHT);
      for (const point of stroke.points.slice(1)) context.lineTo(point.x * DRAWING_WIDTH, point.y * DRAWING_HEIGHT);
      context.stroke();
    }
  }
  context.globalCompositeOperation = "source-over";
}
