// NO "use client" here — this must be a server component
import Link from "next/link";

import LogButtons from "./log-button";

export default async function Header() {
  return (
    <header className="w-full flex-center py-2 md:py-5 p-2 md:p-5">
      <div className="w-full flex items-center justify-between gap-2">
        <Link href="/">
          <div
            className="
              bg-accent-text
              rounded-full
              text-center
              w-16 sm:w-20
              md:w-45
              shadow-lg
              hover:shadow-2xl
              hover:shadow-accent-foreground/80
              transition-all
              duration-300
              ease-out
            "
          >
            <h2 className="text-primary-foreground text-4xl font-bold p-1">UD</h2>
          </div>
        </Link>

        <div className="flex min-w-0 items-center gap-2 sm:gap-10">
          <LogButtons />
        </div>
      </div>
    </header>
  );
}
