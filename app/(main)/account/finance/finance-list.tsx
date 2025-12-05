"use client";
import { InferSelectModel } from "drizzle-orm";
import { financeTable } from "@/lib/db/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { ArrowLeft, ArrowRight, MessageCircle, Settings } from "lucide-react";
import { useState } from "react";

type FinanceRow = InferSelectModel<typeof financeTable>;

export default function FinanceList({ data }: { data: FinanceRow[] }) {
  const [currentPage, setCurrentPage] = useState(1);

  const perPage = 5;
  const pages = Math.ceil(data.length / perPage);
  function dataPage(data: FinanceRow[], page: number) {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return data.slice(start, end);
  }
  const currentPageData = dataPage(data, currentPage);

  if (!data.length) {
    return <div>Empty list</div>;
  }

  return (
    <div className="h-[61vh] flex flex-col justify-between">
      <div className="max-h-[500px] overflow-hidden">
        <AnimatePresence>
          <ScrollArea className="rounded-md border p-3 h-full">
            <div className="flex flex-col justify-center  gap-4">
              {currentPageData.map((row) => (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
                  exit={{ opacity: 0, x: -20 }}
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
                        {row.date?.toString().slice(0, 10)}
                      </CardDescription>

                      <CardTitle>{row.category ?? "—"}</CardTitle>
                      <CardDescription>
                        {row.subcategory ?? "—"}
                      </CardDescription>
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
                      {/* FIXME  */}
                      <Button className="hover:ring-2 " variant={"secondary"}>
                        <Settings />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
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
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
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
                onClick={() => setCurrentPage(page)}
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
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, pages))}
          className="flex items-center gap-1"
        >
          Next <ArrowRight />
        </Button>
      </motion.div>
    </div>
  );
}
