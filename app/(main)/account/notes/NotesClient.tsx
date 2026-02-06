"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import Modal from "./Modal"; // adjust path
import { NoteItem } from "@/types/types";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

const NotesBoard = dynamic(() => import("./NotesBoard"), {
  ssr: false,
});

export default function NotesClient({ data }: { data: NoteItem[] }) {
  const router = useRouter();

  const [notesList, setNotesList] = useState(data);
  const [newNoteBtn, setNewNoteBtn] = useState(false);

  function handleAddNote(note: NoteItem) {
    setNotesList((prev) => [note, ...prev]);
    router.replace("/account/notes");
  }

  const params = useSearchParams();
  useEffect(() => {
    setNewNoteBtn(params.get("new") === "1");
  }, [params]);

  return (
    <section className="p-5">
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
        onClose={() => {
          setNewNoteBtn(false);
          router.replace("/account/notes");
        }}
        onSubmit={handleAddNote}
      />
    </section>
  );
}
