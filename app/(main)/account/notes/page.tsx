"use client";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useState } from "react";

const events: EventItem[] = [
  {
    id: 1,
    event: "Monday",
    date: "01.01.2023",
    description: "Lorem ipsum dolor sit amet",
    createdAt: 123,
    status: "Active",
  },
  {
    id: 2,
    event: "Work",
    createdAt: 123,
    status: "Active",
  },
  {
    id: 3,
    event: "Home",
    createdAt: 123,
    status: "Active",
  },
  {
    id: 4,
    event: "Ward",
    createdAt: 123,
    status: "Done",
  },
  {
    id: 5,
    event: "Drink Wodka Fuck Pilotka",
    createdAt: 123,
    status: "Canceled",
  },
];

export default function Page() {
  return <Notes events={events} />;
}

type EventItem = {
  id: number | string;
  event: string;
  description?: string;
  date?: string;
  createdAt: number;
  status: string;
};

function Notes({ events }: { events: EventItem[] }) {
  const [eventsList, setEventsList] = useState(events);
  const [newEventBtn, setNewEventBtn] = useState(false);

  return (
    <section className="max-h-screen">
      <div
        className="
      grid
      grid-cols-[repeat(auto-fit,minmax(300px,1fr))]
      auto-rows-[200px]
      gap-5
      justify-items-center
    "
      >
        {/* ADD CARD */}
        <Card className="w-[300px] p-3">
          <div className="flex h-full items-center justify-center">
            <Button
              variant="secondary"
              className="w-16 h-16 p-0 flex items-center justify-center"
              onClick={() => setNewEventBtn(true)}
            >
              <Plus className="w-8 h-8" />
            </Button>
          </div>

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
                  className="w-[320px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <form
                    className="p-4 flex flex-col gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const newEvent: EventItem = {
                        id: crypto.randomUUID().slice(0, 8),
                        event: formData.get("event") as string,
                        date: (formData.get("date") as string) || undefined,
                        description:
                          (formData.get("description") as string) || undefined,
                        createdAt: Date.now(),
                        status: "Active",
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
          .filter((e) => e.status === "Active")
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((e) => (
            <Card
              key={e.id}
              className="flex flex-col w-full max-w-[300px] border p-2 
              overflow-hidden
              "
            >
              <CardTitle className="flex justify-between items-baseline p-2 shrink-0">
                <span>{e.event}</span>
                {e.date && <span>{e.date}</span>}
              </CardTitle>

              {e.description && (
                <>
                  <CardContent className="overflow-y-auto">
                    {e.description}
                  </CardContent>
                </>
              )}
            </Card>
          ))}
      </div>
    </section>
  );
}
