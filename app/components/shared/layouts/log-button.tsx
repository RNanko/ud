"use client";

import { Button } from "@/app/components/ui/button";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { User } from "lucide-react";
import { useRouter } from "next/navigation";
import NotificationBell from "@/app/components/notifications/NotificationBell";
import { useRef, useState } from "react";

export default function LogButtons({inbox=false}:{inbox?:boolean}) {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
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
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-4">
      {inbox&&<NotificationBell/>}
      <Button asChild className="h-11">
        <Link href="/account" aria-label={`Profile: ${session.user.name}`} className="flex items-center gap-2">
          <span className="hidden max-w-32 truncate sm:block">{session.user.name.toUpperCase()}</span>
          <User size={18} />
        </Link>
      </Button>

      <Button
        variant="secondary"
        className="h-11 cursor-pointer"
        disabled={busy}
        onClick={async () => {
          if (submitting.current) return;
          submitting.current = true; setBusy(true); setError("");
          try {
            const result = await authClient.signOut();
            if (result.error) { setError("Couldn't sign out. Please try again."); return; }
            router.push("/");
          } catch { setError("Couldn't sign out. Please try again."); }
          finally { submitting.current = false; setBusy(false); }
        }}
      >
        {busy ? "Signing out…" : "Logout"}
      </Button>
      {error && <span role="alert" className="w-full text-right text-sm text-muted-foreground">{error}</span>}
    </div>
  );
}
