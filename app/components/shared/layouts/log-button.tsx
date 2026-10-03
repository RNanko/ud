"use client";

import { Button } from "@/app/components/ui/button";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { User } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LogButtons() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  // Wait until auth is resolved
  if (isPending) {
    return <div role="status" aria-label="Loading account" className="flex items-center gap-2 sm:gap-4">
      <span aria-hidden="true" className="h-11 w-16 rounded-xl bg-muted motion-safe:animate-pulse sm:w-20" />
      <span aria-hidden="true" className="h-11 w-16 rounded-xl bg-muted motion-safe:animate-pulse sm:w-20" />
    </div>;
  }

  // Not logged in
  if (!session) {
    return (
      <Button asChild>
        <Link href="/account">Login</Link>
      </Button>
    );
  }
  // Logged in
  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-4">
      <Button asChild className="h-11">
        <Link href="/account" aria-label={`Profile: ${session.user.name}`} className="flex items-center gap-2">
          <span className="hidden max-w-32 truncate sm:block">{session.user.name.toUpperCase()}</span>
          <User size={18} />
        </Link>
      </Button>

      <Button
        variant="secondary"
        className="h-11 cursor-pointer"
        onClick={() => {
          authClient.signOut();
          router.push("/");
        }}
      >
        Logout
      </Button>
    </div>
  );
}
