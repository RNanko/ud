"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import Modal from "./Modal"; // adjust path
import { NoteItem } from "@/types/types";

const NotesBoard = dynamic(() => import("./NotesBoard"), {
  ssr: false,
});

export default function NotesClient({ data }: { data: NoteItem[] }) {
  const [notesList, setNotesList] = useState(data);
  const [newNoteBtn, setNewNoteBtn] = useState(false);

  function handleAddNote(note: NoteItem) {
    setNotesList((prev) => [note, ...prev]);
  }

  return (
    <section className="p-6">
      {/* ADD NOTE */}
      <div
        className="
        fixed bottom-6 right-6 z-50
        h-20 w-20 rounded-full
        flex items-center justify-center
        border-2 transition-colors"
      >
        <Button
          variant="secondary"
          className="w-16 h-16 rounded-full hover:scale-105 active:scale-95 transition-transform"
          onClick={() => setNewNoteBtn(true)}
        >
          <Plus className="w-8 h-8" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-5 items-start">
        {/* NOTES BOARD */}
        <NotesBoard data={notesList} />
      </div>

      {/* MODAL */}
      <Modal
        open={newNoteBtn}
        onClose={() => setNewNoteBtn(false)}
        onSubmit={handleAddNote}
      />
    </section>
  );
}
