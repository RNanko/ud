"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useMemo, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Plus, Search } from "lucide-react";
import Modal from "./Modal";
import { createQuote } from "@/lib/actions/quotes.actions";
import Link from "next/link";

type Quote = {
  id: string;
  author: string;
  quote: string;
  likesCount: number;
  likedByUser: boolean;
};

const PAGE_SIZE = 9;

export default function QuoteList({ quotes }: { quotes: Quote[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const query = searchParams.get("q") ?? "";
  const [value, setValue] = useState(query);
  const [newQuoteBtn, setNewQuoteBtn] = useState(false);

  const pageParam = searchParams.get("page");
  const page = Math.max(1, Number(pageParam) || 1);

  useEffect(() => {
    setValue(query);
  }, [query]);

  const filteredQuotes = useMemo(() => {
    const q = query.toLowerCase();
    return quotes.filter(
      (item) =>
        item.quote.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q),
    );
  }, [query, quotes]);

  const totalPages = Math.ceil(filteredQuotes.length / PAGE_SIZE);

  const paginatedQuotes = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredQuotes.slice(start, start + PAGE_SIZE);
  }, [filteredQuotes, page]);

  const onSearch = () => {
    if (!value.trim()) {
      router.push("?");
      return;
    }
    router.push(`?q=${encodeURIComponent(value)}`);
  };

  async function handleAddQuote(data: { quote: string; author: string }) {
    await createQuote(data);
    router.refresh();
  }

  return (
    <section className="flex flex-col items-center gap-6">
      {/* SEARCH */}
      <div className="w-fit">
        <Field orientation="horizontal">
          <Input
            type="search"
            placeholder="Search..."
            value={value}
            onChange={(e) => {
              const next = e.target.value;
              setValue(next);

              const params = new URLSearchParams();
              if (next.trim()) params.set("q", next);
              params.set("page", "1");

              router.replace(`?${params.toString()}`);
            }}
          />

          <Button onClick={onSearch}>
            <Search />
          </Button>
        </Field>
      </div>

      {/* QUOTES */}
      <div className="min-h-[500px] w-full mt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-10"
          >
            {paginatedQuotes.map((item) => (
              <Link key={item.id} href={`/account/quotes/${item.id}`}> 
                <Card
                  className="relative p-4 hover:shadow-2xl
              hover:shadow-accent-foreground/90 transition-all
              duration-400
              ease-out"
                >
                  <CardContent className="italic">“{item.quote}”</CardContent>
                  <CardFooter className="justify-end text-sm text-muted-foreground">
                    — {item.author}
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination */}
      <div className="h-[50px] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex items-center justify-center gap-4 py-4"
        >
          {/* Previous Btn*/}
          <Button
            variant="ghost"
            disabled={page === 1}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("page", String(Math.max(page - 1, 1)));
              router.replace(`?${params.toString()}`);
            }}
            className="flex items-center gap-1"
          >
            <ArrowLeft /> Previous
          </Button>

          {/* Page Numbers */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;

              // Ellipsis logic
              if (totalPages > 5) {
                if (p !== 1 && p !== totalPages && Math.abs(page - p) > 1) {
                  if (p === 2 || p === totalPages - 1) {
                    return (
                      <span key={p} className="px-1 text-muted-foreground">
                        …
                      </span>
                    );
                  }
                  return null;
                }
              }

              return (
                <Button
                  key={p}
                  variant={page === p ? "default" : "ghost"}
                  className={`w-8 h-8 p-0 ${page === p ? "rounded-xl" : ""}`}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("page", String(p));
                    router.replace(`?${params.toString()}`);
                  }}
                >
                  {p}
                </Button>
              );
            })}
          </div>

          {/* Next Btn */}
          <Button
            variant="ghost"
            disabled={page === totalPages}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("page", String(Math.min(page + 1, totalPages)));
              router.replace(`?${params.toString()}`);
            }}
            className="flex items-center gap-1"
          >
            Next <ArrowRight />
          </Button>
        </motion.div>
      </div>

      {/* ADD QUOTES */}
      <div
        className="
        fixed bottom-6 right-6 z-50
        h-20 w-20 rounded-full
        flex items-center justify-center
        border-2 transition-colors"
      >
        <Button
          variant="secondary"
          className="w-16 h-16 rounded-full hover:scale-105 active:scale-95 transition-transform"
          onClick={() => setNewQuoteBtn(true)}
        >
          <Plus className="w-8 h-8" />
        </Button>
      </div>

      <Modal
        open={newQuoteBtn}
        onClose={() => setNewQuoteBtn(false)}
        onSubmit={handleAddQuote}
      />
    </section>
  );
}
