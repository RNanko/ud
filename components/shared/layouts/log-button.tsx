"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";
import { User } from "lucide-react";

export default function LogButton() {
  const { data: session } = authClient.useSession();

  if (!session) {
    return (
      <Button asChild>
        <Link href="/auth/login">Login</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Button asChild>
        <Link href="/account" className="hover:ring-2">
          <span>{session.user.name.toUpperCase()} </span>
          <User />
        </Link>
      </Button>

      <Button type="submit" variant="secondary" asChild>
        <Link
          href="/"
          className="hover:ring-2 hover:ring-primary/40"
          onClick={() => {
            authClient.signOut();
          }}
        >
          Logout
        </Link>
      </Button>
    </div>
  );
}
