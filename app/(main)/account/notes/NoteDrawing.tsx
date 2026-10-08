"use client";

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Eraser, PenLine, Redo2, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { NOTES_LIMITS, type NoteStroke } from "@/lib/notes";
import {
  DRAWING_COLORS, DRAWING_HEIGHT, DRAWING_WIDTH, DRAWING_WIDTHS,
  commitDrawing, createDrawingHistory, drawingPoint, drawingSurface, extendDrawingPoints,
  redoDrawing, renderDrawing, sameDrawing, undoDrawing, type DrawingHistory,
} from "@/lib/notes/drawing";

type Props = {
  strokes: NoteStroke[];
  onChange?: (strokes: NoteStroke[]) => void;
  readOnly?: boolean;
  label?: string;
  className?: string;
  maxPoints?: number;
  maxStrokes?: number;
};
type ActiveStroke = { pointerId: number; stroke: NoteStroke; pointLimit: number; warned: boolean };

/** Mount with the drawing block's ID as its key; history belongs to that block. */
export default function NoteDrawing({ strokes, onChange, readOnly = false, label = "Note drawing", className = "", maxPoints = NOTES_LIMITS.totalPoints, maxStrokes = NOTES_LIMITS.strokesPerDrawing }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = useRef<ActiveStroke | null>(null), frame = useRef<number | null>(null);
  const visible = useRef(!readOnly);
  const [history, setHistory] = useState(() => createDrawingHistory(strokes));
  const [source, setSource] = useState(strokes);
  const current = useRef(history);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState<string>(DRAWING_COLORS[0].value), [width, setWidth] = useState<number>(DRAWING_WIDTHS[1]);
  const [clearOpen, setClearOpen] = useState(false), [notice, setNotice] = useState("");
  const helpId = useId();
  const editable = !readOnly && !!onChange;
  // A replacement from the parent starts a new history. An echo of this
  // component's own immutable commit keeps undo/redo intact.
  if (source !== strokes) {
    setSource(strokes);
    if (!sameDrawing(history.present, strokes)) setHistory(createDrawingHistory(strokes));
  }

  const paint = useCallback(() => {
    if (!visible.current) return;
    const element = canvas.current, context = element?.getContext("2d");
    if (!element || !context) return;
    const pending = active.current?.stroke;
    renderDrawing(context, pending ? [...current.current.present, pending] : current.current.present, element.width, element.height);
  }, []);
  const schedulePaint = useCallback(() => {
    if (!visible.current || frame.current !== null) return;
    frame.current = requestAnimationFrame(() => { frame.current = null; paint(); });
  }, [paint]);
  const cancelStroke = useCallback(() => {
    const pending = active.current, element = canvas.current;
    active.current = null;
    if (pending && element?.hasPointerCapture(pending.pointerId)) element.releasePointerCapture(pending.pointerId);
    schedulePaint();
  }, [schedulePaint]);

  useEffect(() => {
    if (current.current !== history) {
      cancelStroke();
      current.current = history;
    }
    schedulePaint();
  }, [history, cancelStroke, schedulePaint]);
  useEffect(() => { if (!editable) cancelStroke(); }, [editable, cancelStroke]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let density: MediaQueryList | null = null;
    function resize() {
      if (!element || !visible.current) return;
      const size = drawingSurface(element.getBoundingClientRect().width, window.devicePixelRatio);
      if (element.width !== size.width || element.height !== size.height) { element.width = size.width; element.height = size.height; }
      schedulePaint();
      density?.removeEventListener("change", resize);
      density = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      density.addEventListener("change", resize);
    }
    const observer = new ResizeObserver(resize);
    // Note lists can contain many papers. Keep their layout, but allocate a
    // backing store only near the viewport; editable paper is always active.
    function setVisible(shown: boolean) {
      if (!element) return;
      visible.current = shown;
      if (shown) {
        observer.observe(element);
        window.addEventListener("resize", resize);
        resize();
      } else {
        observer.unobserve(element);
        window.removeEventListener("resize", resize);
        density?.removeEventListener("change", resize); density = null;
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = null;
        element.width = 1; element.height = 1;
      }
    }
    const viewport = readOnly && typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(entries => {
        const entry = entries.find(item => item.target === element);
        if (entry) setVisible(entry.isIntersecting);
      }, { rootMargin: "300px" }) : null;
    setVisible(!viewport);
    viewport?.observe(element);
    const hidden = () => { if (document.hidden) cancelStroke(); };
    if (!readOnly) {
      window.addEventListener("blur", cancelStroke);
      document.addEventListener("visibilitychange", hidden);
    }
    return () => {
      visible.current = false;
      viewport?.disconnect();
      observer.disconnect(); density?.removeEventListener("change", resize);
      window.removeEventListener("resize", resize); window.removeEventListener("blur", cancelStroke);
      document.removeEventListener("visibilitychange", hidden);
      const pending = active.current; active.current = null;
      if (pending && element.hasPointerCapture(pending.pointerId)) element.releasePointerCapture(pending.pointerId);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [cancelStroke, schedulePaint, readOnly]);

  function publish(next: DrawingHistory) {
    if (!editable || next === current.current) return;
    if (next.present.length > Math.min(NOTES_LIMITS.strokesPerDrawing, maxStrokes) || next.present.reduce((sum, stroke) => sum + stroke.points.length, 0) > Math.min(NOTES_LIMITS.totalPoints, maxPoints)) {
      setNotice("This change exceeds the note's drawing limit. Clear some drawing before restoring more."); return;
    }
    cancelStroke(); current.current = next; setHistory(next); setNotice("");
    onChange?.(next.present); schedulePaint();
  }
  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!editable) return;
    event.stopPropagation();
    if (active.current || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    const remaining = Math.floor(Math.min(NOTES_LIMITS.totalPoints, maxPoints)) - current.current.present.reduce((sum, stroke) => sum + stroke.points.length, 0);
    if (current.current.present.length >= Math.min(NOTES_LIMITS.strokesPerDrawing, maxStrokes) || remaining < 1) {
      setNotice("This drawing has reached its limit. Undo or clear some drawing before adding more."); return;
    }
    const point = drawingPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    if (!point) return;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { return; }
    active.current = { pointerId: event.pointerId, pointLimit: Math.min(NOTES_LIMITS.pointsPerStroke, remaining), warned: false,
      stroke: { id: crypto.randomUUID(), color, width: tool === "eraser" ? Math.min(40, width * 4) : width, tool, points: [point] } };
    setNotice(""); schedulePaint();
  }
  function collect(event: PointerEvent<HTMLCanvasElement>, endpoint = false) {
    const pending = active.current;
    if (!pending || pending.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect(), native = event.nativeEvent;
    const samples = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    const incoming = [...samples, native].flatMap(sample => {
      const point = drawingPoint(sample.clientX, sample.clientY, rect); return point ? [point] : [];
    });
    pending.stroke.points = extendDrawingPoints(pending.stroke.points, incoming, pending.pointLimit, endpoint);
    if (pending.stroke.points.length >= pending.pointLimit && !pending.warned) {
      pending.warned = true; setNotice("This stroke reached its length limit. Lift your pointer to finish it.");
    }
    schedulePaint();
  }
  function pointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (active.current?.pointerId !== event.pointerId) return;
    collect(event, true);
    const pending = active.current!; active.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    publish(commitDrawing(current.current, [...current.current.present, pending.stroke]));
  }
  function pointerCancel(event: PointerEvent<HTMLCanvasElement>) {
    if (active.current?.pointerId !== event.pointerId) return;
    event.stopPropagation(); cancelStroke();
  }

  return <div className={`min-w-0 space-y-2 ${className}`} data-note-drawing>
    {editable && <div className="flex flex-wrap items-center gap-2" aria-label={`${label} tools`} role="group">
      <div className="flex gap-1" role="group" aria-label="Drawing tool">
        <Button type="button" variant="outline" className="min-h-11 rounded-xl" aria-pressed={tool === "pen"} onClick={() => setTool("pen")}><PenLine aria-hidden="true" />Pen</Button>
        <Button type="button" variant="outline" className="min-h-11 rounded-xl" aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}><Eraser aria-hidden="true" />Eraser</Button>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Pen color">
        {DRAWING_COLORS.map(choice => <button key={choice.value} type="button" aria-label={`${choice.name} pen`} aria-pressed={color === choice.value && tool === "pen"} title={`${choice.name} pen`} onClick={() => { setColor(choice.value); setTool("pen"); }} className={`flex size-11 items-center justify-center rounded-xl border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${color === choice.value && tool === "pen" ? "border-foreground bg-muted" : "border-border"}`}><span className="size-5 rounded-full border border-black/15" style={{ backgroundColor: choice.value }} /></button>)}
      </div>
      <div className="flex gap-1" role="group" aria-label="Stroke width">
        {DRAWING_WIDTHS.map((size, index) => <Button key={size} type="button" variant="outline" className="min-h-11 min-w-11 rounded-xl px-2" aria-label={`${["Thin", "Medium", "Thick"][index]} stroke`} title={`${["Thin", "Medium", "Thick"][index]} stroke`} aria-pressed={width === size} onClick={() => setWidth(size)}><span aria-hidden="true" className="block w-5 rounded-full bg-current" style={{ height: size }} /></Button>)}
      </div>
      <div className="flex gap-1" role="group" aria-label="Drawing history">
        <Button type="button" variant="outline" className="min-h-11 min-w-11 rounded-xl px-2" aria-label="Undo drawing" title="Undo drawing" disabled={!history.past.length} onClick={() => publish(undoDrawing(current.current))}><Undo2 aria-hidden="true" /></Button>
        <Button type="button" variant="outline" className="min-h-11 min-w-11 rounded-xl px-2" aria-label="Redo drawing" title="Redo drawing" disabled={!history.future.length} onClick={() => publish(redoDrawing(current.current))}><Redo2 aria-hidden="true" /></Button>
        <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={!history.present.length} onClick={() => setClearOpen(true)}><Trash2 aria-hidden="true" />Clear</Button>
      </div>
    </div>}
    <div className="relative w-full overflow-hidden rounded-xl border border-black/15 bg-white" style={{ aspectRatio: `${DRAWING_WIDTH} / ${DRAWING_HEIGHT}` }}>
      <canvas ref={canvas} width={1} height={1} className={`block h-full w-full ${editable ? "cursor-crosshair" : ""}`} style={{ touchAction: editable ? "none" : "auto" }} draggable={false} role="img" aria-label={label} aria-describedby={editable ? helpId : undefined}
        onPointerDown={editable ? pointerDown : undefined} onPointerMove={editable ? event => collect(event) : undefined} onPointerUp={editable ? pointerUp : undefined}
        onPointerCancel={pointerCancel} onLostPointerCapture={pointerCancel} onContextMenu={editable ? event => event.preventDefault() : undefined}>
        {editable ? "Drawing paper. Use a mouse, finger or pen to draw." : "Drawing attached to this note."}
      </canvas>
    </div>
    {editable && <><p id={helpId} className="text-xs text-muted-foreground">Draw with a mouse, finger or pen. Scroll outside the paper.</p><p role="status" aria-live="polite" className="text-xs text-muted-foreground">{notice}</p>
      <Dialog.Root open={clearOpen} onOpenChange={setClearOpen}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm" /><Dialog.Content className="fixed inset-x-3 top-1/2 z-[81] -translate-y-1/2 rounded-2xl border border-border bg-background p-5 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-[400px] sm:-translate-x-1/2">
        <Dialog.Title className="text-lg font-semibold">Clear this drawing?</Dialog.Title><Dialog.Description className="mt-2 text-sm text-muted-foreground">All marks on this paper will be removed. You can undo this while the note stays open.</Dialog.Description>
        <div className="mt-5 flex justify-end gap-2"><Dialog.Close asChild><Button type="button" variant="outline" className="min-h-11">Keep drawing</Button></Dialog.Close><Button type="button" variant="destructive" className="min-h-11" onClick={() => { publish(commitDrawing(current.current, [])); setClearOpen(false); }}>Clear drawing</Button></div>
      </Dialog.Content></Dialog.Portal></Dialog.Root>
    </>}
  </div>;
}
