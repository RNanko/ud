"use client";
import { InferSelectModel } from "drizzle-orm";
import { financeTable } from "@/lib/db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, MessageCircle } from "lucide-react";
import { useState } from "react";
import FinanceListSettingsBtn from "./finance-list-settings-btn";

type FinanceRow = InferSelectModel<typeof financeTable>;

export default function FinanceList({
  data,
  listLenth,
}: {
  data: FinanceRow[];
  listLenth: string;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [direction, setDirection] = useState(-15);

  const pages = Math.ceil(data.length / +listLenth);
  const safePage = Math.min(currentPage, pages);
  function dataPage(data: FinanceRow[], page: number) {
    const start = (page - 1) * +listLenth;
    const end = start + +listLenth;
    return data.slice(start, end);
  }
  const currentPageData = dataPage(data, safePage);

  if (!data.length) {
    return <div className="text-center text-2xl">No data yet</div>;
  }

  return (
    <div className="flex flex-col justify-between">
      <div className="max-h-[500px] lg:max-h-[700px] ">
        <AnimatePresence>
          <div className="flex flex-col justify-center gap-4">
            {currentPageData.map((row) => (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, x: direction }}
                animate={{ opacity: 1, x: 0, y: 5 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5 }}
                layout
              >
                <Card className="p-4">
                  <CardContent className="grid grid-cols-7 items-center gap-4 p-0">
                    <CardTitle
                      className={`${
                        row.type === "-"
                          ? "text-primary-minus"
                          : "text-primary-plus"
                      } font-bold text-lg`}
                    >
                      {row.type === "-" ? "Out" : "In"}
                    </CardTitle>
                    <CardDescription>
                      {row.date?.toString().slice(0, 15)}
                    </CardDescription>

                    <CardTitle>{row.category ?? "—"}</CardTitle>
                    <CardDescription>{row.subcategory ?? "—"}</CardDescription>
                    <CardTitle
                      className={`${
                        row.type === "-"
                          ? "text-primary-minus"
                          : "text-primary-plus"
                      } font-bold`}
                    >
                      {row.amount}
                    </CardTitle>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" disabled={!row.comment}>
                          <MessageCircle />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent>{row.comment}</PopoverContent>
                    </Popover>
                    <FinanceListSettingsBtn data={row} />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      </div>

      {/* Pagination */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-4 flex items-center justify-center gap-4 py-4"
      >
        {/* Previous */}
        <Button
          variant="ghost"
          disabled={currentPage === 1}
          onClick={() => {
            setCurrentPage((prev) => Math.max(prev - 1, 1));
            setDirection(15);
          }}
          className="flex items-center gap-1"
        >
          <ArrowLeft /> Previous
        </Button>

        {/* Page Numbers */}
        <div className="flex items-center gap-2">
          {Array.from({ length: pages }).map((_, i) => {
            const page = i + 1;

            // Hide middle numbers and show ellipsis
            if (pages > 5) {
              if (
                page !== 1 &&
                page !== pages &&
                Math.abs(currentPage - page) > 1
              ) {
                if (page === 2 || page === pages - 1) {
                  return <span key={page}>…</span>; // dot
                }
                return null;
              }
            }

            return (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "ghost"}
                className={`w-8 h-8 p-0 ${
                  currentPage === page ? "rounded-xl" : ""
                }`}
                onClick={() => {
                  setCurrentPage(page);
                  setDirection(0);
                }}
              >
                {page}
              </Button>
            );
          })}
        </div>

        {/* Next */}
        <Button
          variant="ghost"
          disabled={currentPage === pages}
          onClick={() => {
            setCurrentPage((prev) => Math.min(prev + 1, pages));
            setDirection(-15);
          }}
          className="flex items-center gap-1"
        >
          Next <ArrowRight />
        </Button>
      </motion.div>
    </div>
  );
}
