"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { User } from "lucide-react";
import Loader from "../loader";
import { useRouter } from "next/navigation";

export default function LogButtons() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  // Wait until auth is resolved
  if (isPending) {
    return <Loader />;
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
    <div className="flex items-center gap-4">
      <Button asChild>
        <Link href="/account" className="flex items-center gap-2">
          <span>{session.user.name.toUpperCase()}</span>
          <User size={18} />
        </Link>
      </Button>

      <Button
        variant="secondary"
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
