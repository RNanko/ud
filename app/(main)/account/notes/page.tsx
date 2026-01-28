"use client";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useState } from "react";

const events: NoteItem[] = [
  {
    id: 1,
    event: "Monday",
    date: "01.01.2023",
    description: "Lorem ipsum dolor sit amet afdadadada afdadadada afdadadada ",
    createdAt: 123,
  },
  {
    id: 2,
    event: "Work",
    createdAt: 123,
  },
  {
    id: 3,
    event: "Home",
    createdAt: 123,
  },
  {
    id: 4,
    event: "Ward",
    createdAt: 123,
  },
  {
    id: 5,
    event: "Drink Wodka Fuck Pilotka",
    createdAt: 123,
  },
];

export default function Page() {
  return <Notes events={events} />;
}

type NoteItem = {
  id: number | string;
  event: string;
  description?: string;
  date?: string;
  createdAt: number;
};

function Notes({ events }: { events: NoteItem[] }) {
  const [eventsList, setEventsList] = useState(events);
  const [newEventBtn, setNewEventBtn] = useState(false);

  return (
    <section className="min-h-screen p-6">
      <div
        className="
      grid
      grid-cols-[repeat(auto-fit,minmax(280px,1fr))]
      auto-rows-[220px]
      gap-6
      place-items-start
    "
      >
        {/* ADD CARD */}
        <Card className="w-full max-w-[300px] h-full flex items-center justify-center border-dashed hover:border-primary transition-colors">
          <Button
            variant="secondary"
            className="
      w-16 h-16 p-0 rounded-full
      hover:scale-105 active:scale-95
      transition-transform
    "
            onClick={() => setNewEventBtn(true)}
          >
            <Plus className="w-8 h-8" />
          </Button>
        </Card>

        {/* MODAL */}
        <AnimatePresence>
          {newEventBtn && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNewEventBtn(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-sm"
              >
                <Card
                  className="w-[320px] "
                  onClick={(e) => e.stopPropagation()}
                >
                  <form
                    className="p-4 flex flex-col gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const newEvent: NoteItem = {
                        id: crypto.randomUUID().slice(0, 8),
                        event: formData.get("event") as string,
                        date: (formData.get("date") as string) || undefined,
                        description:
                          (formData.get("description") as string) || undefined,
                        createdAt: Date.now(),
                      };
                      setEventsList((prev) => [...prev, newEvent]);
                      setNewEventBtn(false);
                    }}
                  >
                    <Input name="event" required placeholder="Event name" />
                    <Input name="date" type="date" />
                    <Textarea
                      name="description"
                      className="h-48 resize-none overflow-y-auto"
                    />

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => setNewEventBtn(false)}
                      >
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

        {eventsList
          .slice()
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((e) => (
            <Card
              key={e.id}
              className="
                w-full max-w-[300px] h-full
                xl:max-w-[600px]
                flex flex-col
                rounded-xl
                bg-background
                shadow-sm
                hover:shadow-md
                transition-shadow
                border
              "
            >
              {/* HEADER */}
              <CardTitle className="px-4 py-1 flex flex-col gap-1 shrink-0">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-xl leading-tight">
                    {e.event}
                  </span>

                  {e.date && (
                    <span className="text-xl text-muted-foreground whitespace-nowrap">
                      {e.date}
                    </span>
                  )}
                </div>
              </CardTitle>

              {/* CONTENT */}
              {e.description && (
                <CardContent
                  className="
                    px-4 py-2
                    text-lg
                    text-white/80
                    leading-relaxed

                    overflow-y-auto
                    wrap-break-word
                    whitespace-pre-wrap

                    max-h-[120px]
                    scrollbar-thin
                  "
                >
                  {e.description}
                </CardContent>
              )}
            </Card>
          ))}
      </div>
    </section>
  );
}
