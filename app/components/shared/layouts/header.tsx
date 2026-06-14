// NO "use client" here — this must be a server component
import Link from "next/link";
import { ModeToggle } from "./mode-toggle";

import LogButtons from "./log-button";

export default async function Header() {
  return (
    <header className="w-full flex-center py-2 md:py-5 p-2 md:p-5">
      <div className="w-full flex items-center justify-between">
        <Link href="/">
          <div
            className="
              bg-accent-text
              rounded-full
              text-center
              w-20
              md:w-45
              shadow-lg
              hover:shadow-2xl
              hover:shadow-accent-foreground/80
              transition-all
              duration-300
              ease-out
            "
          >
            <h2 className="text-white text-4xl font-bold p-1">UD</h2>
          </div>
        </Link>

        <div className="flex items-center gap-5 sm:gap-10">
          <LogButtons />
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
