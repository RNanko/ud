// NO "use client" here — this must be a server component
import Link from "next/link";
import { ModeToggle } from "./mode-toggle";
import Locker from "../../locker";
import LogButton from "./log-button";


export default async function Header() {


  return (
    <header className="w-full flex-center py-5">
      <div className="w-full max-w-6xl flex items-center justify-between px-5">
        <Link href="/">
          <h2 className="text-accent-text">UD</h2>
        </Link>

        <nav className="flex items-center gap-10">


          <LogButton />
          <ModeToggle />

        </nav>
      </div>
    </header>
  );
}
