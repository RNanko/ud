"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import {
  CalendarRange,
  NotebookPen,
  SquareUser,
  Wallet,
  CopyCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

// Icons mapped to routes
const items = [
  { name: "Profile", icon: SquareUser, path: "" },
  { name: "Finance", icon: Wallet, path: "finance" },
  { name: "To-Do", icon: CopyCheck, path: "to-do" },
  { name: "Events", icon: CalendarRange, path: "events" },
  { name: "Notes", icon: NotebookPen, path: "notes" },
];

export default function AccSidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="
        flex gap-4
        justify-between
        mx-5
        lg:flex-col md:gap-5
        md:justify-center lg:justify-start
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
                  p-2 rounded-xl transition-all shadow-lg group-hover:bg-accent-foreground

                  ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent-foreground"
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
                  className="text-sm py-1 px-3 w-25 hover:bg-accent-foreground hover:text-primary-foreground 
                  shadow-lg
                  group-hover:shadow-6xl
                  group-hover:shadow-accent-foreground/50
                  transition-all
                  duration-300
                  ease-out
                  group-hover:bg-accent-foreground"
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
