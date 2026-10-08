"use client";

import { Checkbox } from "@/app/components/ui/checkbox";
import type { NoteBlock } from "@/lib/notes";
import NoteDrawing from "./NoteDrawing";

export type NoteContentProps = { blocks: NoteBlock[]; onToggle?: (blockId: string, itemId: string) => void; disabled?: boolean };

export default function NoteContent({ blocks, onToggle, disabled = false }: NoteContentProps) {
  return <div className="min-w-0 space-y-3 text-sm leading-relaxed">
    {blocks.map(block => {
      if (block.type === "text") return <p key={block.id} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{block.text}</p>;
      if (block.type === "drawing") return <NoteDrawing key={block.id} strokes={block.strokes} readOnly label="Note drawing" />;
      if (block.type === "checklist") return <ul key={block.id} className="space-y-1">{block.items.map((item, index) => <li key={item.id} className="flex min-w-0 items-start gap-2">
        <span className="flex min-h-9 shrink-0 items-center" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}><Checkbox checked={item.checked} disabled={disabled || !onToggle} onCheckedChange={() => onToggle?.(block.id, item.id)} aria-label={`${item.checked ? "Uncheck" : "Complete"} ${item.text || `checklist item ${index + 1}`}`} className="size-5" /></span>
        <span className={`min-w-0 pt-1.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${item.checked ? "text-muted-foreground line-through" : ""}`}>{item.text}</span>
      </li>)}</ul>;
      const ListTag = block.type === "numbered" ? "ol" : "ul";
      return <ListTag key={block.id} className={`space-y-1 pl-5 ${block.type === "numbered" ? "list-decimal" : "list-disc"}`}>{block.items.map(item => <li key={item.id} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.text}</li>)}</ListTag>;
    })}
  </div>;
}
