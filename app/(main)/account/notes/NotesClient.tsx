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
  const [eventsList, setEventsList] = useState(data);
  const [newEventBtn, setNewEventBtn] = useState(false);

  function handleAddNote(note: NoteItem) {
    setEventsList((prev) => [note, ...prev]);
  }

  return (
    <section className="p-6">
      {/* ADD CARD */}
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
          onClick={() => setNewEventBtn(true)}
        >
          <Plus className="w-8 h-8" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-5 items-start">
        {/* NOTES BOARD */}
        <NotesBoard data={eventsList} />
      </div>

      {/* MODAL */}
      <Modal
        open={newEventBtn}
        onClose={() => setNewEventBtn(false)}
        onSubmit={handleAddNote}
      />
    </section>
  );
}
