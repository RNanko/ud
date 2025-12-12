"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import {
  CalendarDays,
  CalendarRange,
  NotebookPen,
  SquareUser,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

// Icons mapped to routes
const items = [
  { name: "Profile", icon: SquareUser, path: "" },
  { name: "Finance", icon: Wallet, path: "finance" },
  { name: "Events", icon: CalendarRange, path: "events" },
  { name: "Daily", icon: NotebookPen, path: "daily" },
  { name: "Calendar", icon: CalendarDays, path: "calendar" },
];

export default function AccSidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="
        flex gap-4 
        lg:flex-col md:gap-5 p-5
      "
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === `/account/${item.path}` ||
          (pathname === "/account" && item.path === "");

        return (
          <Link key={item.path} href={`/account/${item.path}`}>
            <motion.div
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 1.05 }}
              className="flex flex-wrap justify-center items-center gap-2 cursor-pointer group"
            >
              {/* Icon */}
              <div
                className={`
                  p-2 rounded-xl transition-all
                  ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }
                `}
              >
                <Icon size={28} />
              </div>

              {/* Badge with text on larger screens */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: active ? 1 : 0.8, x: active ? 0 : 0 }}
                className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Badge
                  variant={active ? "default" : "secondary"}
                  className="text-sm py-1 px-3 w-30 hover:bg-accent-foreground hover:text-primary-foreground"
                >
                  {item.name}
                </Badge>
              </motion.div>
            </motion.div>
          </Link>
        );
      })}
    </nav>
  );
}
