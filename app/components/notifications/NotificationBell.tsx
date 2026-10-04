"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useInbox } from "./InboxProvider";

export default function NotificationBell() {
  const inbox = useInbox();

  if (!inbox.owner) return null;

  const count = inbox.page?.unreadCount ?? null;

  return (
    <Button
      asChild
      variant="outline"
      className="relative size-11 shrink-0 rounded-2xl border-border text-primary-plus"
    >
      <Link
        href="/account/notifications"
        aria-label={
          count === null
            ? "Notifications — unread count unavailable"
            : `Notifications — ${count} unread`
        }
      >
        <Bell size={20} />

        {count !== null && count > 0 && (
          <span
            aria-hidden="true"
            className="
              absolute -right-1 -top-1
              flex size-5 items-center justify-center
              rounded-full
              bg-[#fb923c]
              text-[11px] font-bold
              text-white
            "
          >
            !
          </span>
        )}
      </Link>
    </Button>
  );
}