"use client";

import CardM from "@/app/components/shared/motivator/CardM";
import Link from "next/link";

export default function Cards() {
  return (
    <section>
      <h2 className="text-center mb-10">Choose Your Path</h2>
      <div className="flex flex-col md:flex-row gap-10 px-10">
        <Link href="/account/motivator/go-hard" className="w-full md:w-1/2">
          <CardM videoSource="/motivation/David G.mp4" text="Go Hard" />
        </Link>

        <Link
          href="/account/motivator/go-with-wisdom"
          className="w-full md:w-1/2"
        >
          <CardM
            videoSource="/motivation/Marcus Aurelius.mp4"
            text="Go with Wisdom"
          />
        </Link>
      </div>
    </section>
  );
}
