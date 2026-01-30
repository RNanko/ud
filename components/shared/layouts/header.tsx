// NO "use client" here — this must be a server component
import Link from "next/link";
import { ModeToggle } from "./mode-toggle";

import LogButtons from "./log-button";

export default async function Header() {
  return (
    <header className="w-full flex-center py-5 p-5">
      <div className="w-full flex items-center justify-between">
        <Link href="/">
          <div
            className="
              bg-accent-text
              rounded-full
              text-center
              w-[130px]
              shadow-lg
              hover:shadow-2xl
              hover:shadow-accent-foreground/90
              transition-all
              duration-300
              ease-out
            "
          >
            <h2 className="text-white text-4xl font-bold p-1">UD</h2>
          </div>
        </Link>

        <div className="flex items-center gap-10">
          <LogButtons />
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
