"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarRange, CopyCheck, NotebookPen } from "lucide-react";

const items = [
  {
    title: "Notes",
    image: "/main/bg-1.jpg",
    Icon: NotebookPen,
    description: "Create Notes",
  },
  {
    title: "Task",
    image: "/main/bg-2.jpg",
    Icon: CopyCheck,
    description: "Create Task",
  },
  {
    title: "Event",
    image: "/main/bg-3.jpg",
    Icon: CalendarRange,
    description: "Create Event",
  },
  {
    title: "Event2",
    image: "/main/bg-3.jpg",
    Icon: CalendarRange,
    description: "Create Event",
  },
];

const AUTO_SLIDE_INTERVAL = 5000;

export default function CarouselPage() {
  // virtual index (never decreases)
  const [current, setCurrent] = useState(0);

  const visibleIndex = current % items.length;

  const nextSlide = () => {
    setCurrent((prev) => prev + 1);
  };

  // prev still moves LEFT visually
  const prevSlide = () => {
    setCurrent((prev) => prev + items.length - 1);
  };

  const goToSlide = (index: number) => {
    setCurrent((prev) => {
      const visible = prev % items.length;
      const step = (index - visible + items.length) % items.length;
      return prev + step;
    });
  };

  const prevVisibleRef = useRef(visibleIndex);

  useEffect(() => {
    prevVisibleRef.current = visibleIndex;
  }, [visibleIndex]);

  useEffect(() => {
    const interval = setInterval(nextSlide, AUTO_SLIDE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-[70vh] w-full overflow-hidden text-white">
      {/* Background */}
      <div
        className="flex h-full transition-transform duration-1000 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {[...items, ...items].map((item, i) => (
          <div
            key={i}
            className="min-w-full h-full bg-cover bg-center brightness-75"
            style={{ backgroundImage: `url(${item.image})` }}
          />
        ))}
      </div>

      <div className="absolute inset-0 bg-black/40" />

      <div className="absolute inset-0 flex flex-col-reverse items-center justify-start px-20 z-10">
        <div className="relative w-80 h-60">
          <AnimatePresence>
            {items.map((item, index) => {
              const position =
                (index - visibleIndex + items.length) % items.length;

              if (position > 2) return null;

              return (
                <motion.div
                  key={index}
                  onClick={() => goToSlide(index)}
                  animate={{
                    y: position * -90,
                    x: position * 60,
                    scale: 1 - position * 0.05,
                    opacity: 1 - position * 0.2,
                    filter: `blur(${position}px)`,
                  }}
                  transition={{
                    duration: 1,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  exit={{
                    opacity: 0,
                    y: -40,
                    scale: 0.9,
                  }}
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
        </div>

        <div className="absolute bottom-10 left-20 flex gap-4">
          <button
            onClick={prevSlide}
            className="px-5 py-2 bg-white text-black rounded-lg"
          >
            Prev
          </button>
          <button
            onClick={nextSlide}
            className="px-5 py-2 bg-white text-black rounded-lg"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
