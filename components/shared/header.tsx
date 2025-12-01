import Link from "next/link";
import { ModeToggle } from "./mode-toggle";

import Locker from "../locker";
import { Button } from "../ui/button";

export default function Header() {
  return (
    <header className="w-full flex-center py-5">
      <div className="w-full max-w-6xl flex items-center justify-between px-5">
        <Link href="/">
          <h2 className="text-accent-text">UD</h2>
        </Link>

        <nav className="flex items-center gap-10">
          <Link href="/test" className="hover:text-accent-text">
            <Locker>Test</Locker>
          </Link>
          <Button asChild>
            <Link href="/login" className="hover:text-accent-text">
              Login
            </Link>
          </Button>

          <ModeToggle />
        </nav>
      </div>
    </header>
  );
}
