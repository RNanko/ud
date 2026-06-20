"use client";

import { useRef } from "react";

export default function CardM({
  videoSource,
  text,
}: {
  videoSource: string;
  text: string;
}) {
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
      className="group relative flex-1 h-160 overflow-hidden rounded-xl border-2 border-gray-500"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* VIDEO BACKGROUND */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        className="
    absolute inset-0 w-full h-full object-cover
    transition-all duration-300
    group-hover:grayscale
    group-hover:brightness-50
  "
      >
        <source src={videoSource} type="video/mp4" />
      </video>

      {/* DARK OVERLAY */}
      <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* CENTER TEXT */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 text-white text-6xl cursor-pointer transition">
          {text}
        </div>
      </div>
    </div>
  );
}
