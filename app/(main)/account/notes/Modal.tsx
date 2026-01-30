"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NoteItem } from "@/types/types";


type ModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (note: NoteItem) => void;
};

export default function Modal({ open, onClose, onSubmit }: ModalProps) {
  // 🔒 lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // escape key support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="p-4">
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);

                  onSubmit({
                    id: crypto.randomUUID().slice(0, 8),
                    event: formData.get("event") as string,
                    date: (formData.get("date") as string) || undefined,
                    description:
                      (formData.get("description") as string) || undefined,
                    createdAt: Date.now(),
                  });

                  onClose();
                }}
              >
                <Input
                  name="event"
                  placeholder="Event name"
                  required
                  autoFocus
                />

                <Input name="date" type="date" />

                <Textarea
                  name="description"
                  placeholder="Notes…"
                  className="h-40 resize-none overflow-y-auto"
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit">
                    Add
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
