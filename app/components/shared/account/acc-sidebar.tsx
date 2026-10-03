"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import {
  CalendarRange,
  SquareUser,
  Wallet,
  CopyCheck,
  TrendingUp,
  Dumbbell,
  Compass,
} from "lucide-react";

import { Badge } from "@/app/components/ui/badge";

// Icons mapped to routes
const items = [
  { name: "Settings", icon: SquareUser, path: "" },
  { name: "Finance", icon: Wallet, path: "finance" },
  { name: "Investments", icon: TrendingUp, path: "investments" },
  { name: "To-Do", icon: CopyCheck, path: "to-do" },
  { name: "Events", icon: CalendarRange, path: "events" },
  { name: "Gym", icon: Dumbbell, path: "gym" },
  { name: "Momentum", icon: Compass, path: "momentum" },
];

export default function AccSidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="

        account-navigation flex gap-2 sm:gap-4  scroll-px-4
        flex-wrap sm:flex-nowrap
        justify-start sm:justify-between lg:overflow-visible
        [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
        md:mx-5
        lg:flex-col md:gap-6
        lg:justify-start

      "
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === `/account/${item.path}` ||
          (pathname === "/account" && item.path === "");

        return (
          <Link
            className="relative shrink-0 scroll-mx-4 rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4
            "
            aria-label={item.name}
            key={item.path}
            href={`/account/${item.path}`}
          >
            <motion.div
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 1.05 }}
              className="flex flex-wrap justify-center items-center gap-2 cursor-pointer group"
            >
              {/* Icon */}
              <div
                className={`
                  p-2.5 rounded-xl transition-all shadow-lg group-hover:bg-accent-foreground

                  ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent-foreground"
                  }
                `}
              >
                <Icon size={24} className="md:hidden" />
                <Icon size={28} className="hidden md:block" />
              </div>
              {/* Badge with text on larger screens */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: active ? 1 : 0.8, x: active ? 0 : 0 }}
                className="hidden xl:block opacity-0 group-hover:opacity-100 transition-opacity"
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
