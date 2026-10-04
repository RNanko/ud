// NO "use client" here — this must be a server component
import Link from "next/link";
import Brand from "../Brand";

import LogButtons from "./log-button";

export default async function Header({inbox=false}:{inbox?:boolean}) {
  return (
    <header className="w-full flex-center py-2 md:py-5 p-2 md:p-5">
      <div className="w-full flex items-center justify-between gap-2">
        <Link href="/" className="shrink-0 rounded-xl p-2 outline-none focus-visible:ring-2 focus-visible:ring-primary-plus"><Brand compact /></Link>

        <div className="flex min-w-0 items-center gap-2 sm:gap-10">
          <LogButtons inbox={inbox} />
        </div>
      </div>
    </header>
  );
}
