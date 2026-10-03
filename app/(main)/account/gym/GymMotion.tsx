"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

/** Entry motion only: keep form state and focus intact, and leave drag transforms to dnd-kit. */
export function GymReveal({
  active = true,
  delay = 0,
  distance = 10,
  ...props
}: HTMLMotionProps<"div"> & { active?: boolean; delay?: number; distance?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      {...props}
      data-gym-reveal=""
      initial={reduced ? false : { opacity: 0, y: distance }}
      animate={{ opacity: active ? 1 : 0, y: reduced || active ? 0 : distance }}
      transition={{ duration: reduced ? 0 : 0.22, delay: reduced ? 0 : Math.min(delay, 0.18), ease: "easeOut" }}
    />
  );
}
