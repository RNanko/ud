"use client";

import CardM from "@/app/components/shared/motivator/CardM";
import Link from "next/link";

export default function Cards() {
  return (
    <div className="flex gap-10 px-10">
      <Link href="/motivation/go-hard" className="w-1/2 flex">
        <CardM videoSource="/motivation/David G.mp4" text="Go Hard" />
      </Link>

      <Link href="/motivation/go-with-wisdom" className="w-1/2">
        <CardM
          videoSource="/motivation/Marcus Aurelius.mp4"
          text="Go with Wisdom"
        />
      </Link>
    </div>
  );
}
