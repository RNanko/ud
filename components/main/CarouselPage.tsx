"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarRange, CopyCheck, NotebookPen, Wallet } from "lucide-react";
import Image from "next/image";

const items = [
  {
    title: "Notes",
    image: "/main/notes.png",
    Icon: NotebookPen,
    description: "Create Notes",
  },
  {
    title: "Task",
    image: "/main/todo.png",
    Icon: CopyCheck,
    description: "Create Task",
  },
  {
    title: "Event",
    image: "/main/events.png",
    Icon: CalendarRange,
    description: "Create Event",
  },
  {
    title: "Finanse",
    image: "/main/expenses.png",
    Icon: Wallet,
    description: "Create Event",
  },
];

const AUTO_SLIDE_INTERVAL = 7000;

export default function CarouselPage() {
  const [current, setCurrent] = useState(0);
  const visibleIndex = current % items.length;

  const nextSlide = () => setCurrent((p) => p + 1);
  // const prevSlide = () => setCurrent((p) => p + items.length - 1);

  const goToSlide = (index: number) => {
    setCurrent((prev) => {
      const visible = prev % items.length;
      const step = (index - visible + items.length) % items.length;
      return prev + step;
    });
  };

  useEffect(() => {
    const interval = setInterval(nextSlide, AUTO_SLIDE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full min-h-[70vh] flex items-center justify-center text-white px-6">
      {/* GRID */}
      <div className="grid md:grid-cols-2 gap-50 md:gap-12 items-center w-1/2 md:w-3/4 xl:w-full max-w-6xl">
        {/* LEFT IMAGE */}
        <div className="relative w-full h-[380px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={visibleIndex}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0"
            >
              <Image
                src={items[visibleIndex].image}
                alt={items[visibleIndex].title}
                fill
                className="object-contain"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* RIGHT STACK */}
        <div className="relative mt-5 md:mt-0">
          <AnimatePresence initial={false}>
            {items.map((item, index) => {
              const position =
                (index - visibleIndex + items.length) % items.length;

              if (position > 2) return null;

              return (
                <motion.div
                  key={index}
                  onClick={() => goToSlide(index)}
                  initial={{ opacity: 0, x: 80 }}
                  animate={{
                    y: position * -90,
                    x: -position * -60,
                    scale: 1 - position * 0.05,
                    opacity: 1 - position * 0.2,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  className="absolute w-full cursor-pointer"
                  style={{ zIndex: 10 - position }}
                >
                  <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-6 py-5 rounded-2xl shadow-xl">
                    <item.Icon size={28} />
                    <div>
                      <h3 className="font-semibold text-xl">{item.title}</h3>
                      <p className="text-sm text-gray-300">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Icons */}
          <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
            {" "}
            {items.map((_, i) => {
              const active = i === visibleIndex;

              return (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className={`rounded-full transition-all duration-300
                    ${active ? "w-6 h-3 bg-white" : "w-3 h-3 bg-white/40"}
                  `}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
