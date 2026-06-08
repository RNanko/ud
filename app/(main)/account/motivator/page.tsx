"use client";

import { useRef } from "react";
import { Pause } from "lucide-react";

export default function Cards() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.7;
    }
  };

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 1;
    }
  };

  return (
    <div
      className="group relative w-1/3 h-160 overflow-hidden rounded-xl border-2 border-gray-500"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        className="
          absolute inset-0 h-full w-full object-cover
          transition-all duration-300
          group-hover:grayscale
          group-hover:brightness-50
        "
      >
        <source src="/motivation/David%20G.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <Pause className="h-12 w-12 text-white" />
      </div>
    </div>
  );
}