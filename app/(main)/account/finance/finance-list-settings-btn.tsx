"use client";

import { useState, useTransition } from "react";
import { Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InferSelectModel } from "drizzle-orm";
import { financeTable } from "@/lib/db/schema";
import { removeListItem, updateListItem } from "@/lib/actions/finance.actions";
import { toast } from "sonner";

type FinanceRow = InferSelectModel<typeof financeTable>;

export default function FinanceListSettingsBtn({ data }: { data: FinanceRow }) {
  const [selectedField, setSelectedField] = useState("");
  const [inputValue, setInputValue] = useState("");

  const [isPending, startTransition] = useTransition();
  const [isPending2, startTransition2] = useTransition();

  // DELETE HANDLER
  function handleDelete({ id }: { id: string }) {
    startTransition(async () => {
      const res = await removeListItem(id);

      if (!res.success) {
        toast("Item deleted");
      } else {
        toast.error("Error delete row");
      }
    });
  }

  // UPDATE HANDLER
  function handleUpdate({
    id,
    category,
    value,
  }: {
    id: string;
    category: string;
    value: string;
  }) {
    startTransition2(async () => {
      const res = await updateListItem(id, category, value);
      if (res.success) {
        toast("Row updated");
        setInputValue("");
      } else {
        toast.error("Error update row");
      }
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full">
          <Settings />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-fit">
        {/* DELETE BUTTON */}
        <Button
          variant="destructive"
          onClick={() => handleDelete({ id: data.id })}
          className="mb-3 w-full"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="animate-spin h-4 w-4" />
          ) : (
            "Delete Line"
          )}
        </Button>

        {/* UPDATE SECTION */}
        <div className="grid gap-4">
          <h4 className="font-medium text-center">Change data</h4>

          <div className="grid gap-2 items-center">
            {/* FIELD SELECT */}
            <Select onValueChange={setSelectedField} value={selectedField}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="type">Type</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="subcategory">Sub</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="comment">Comment</SelectItem>
              </SelectContent>
            </Select>

            {/* INPUT */}
            {selectedField === "type" || selectedField === "date" ? (
              selectedField === "type" ? (
                <Select onValueChange={setInputValue} value={inputValue}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select income/outcome" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="+">Income</SelectItem>
                    <SelectItem value="-">Outcome</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                selectedField === "date" && (
                  <Input
                    placeholder="Date"
                    type="date"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    required
                  />
                )
              )
            ) : (
              <Input
                placeholder="New value"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                required
              />
            )}

            <Button
              disabled={isPending2}
              onClick={() =>
                handleUpdate({
                  id: data.id,
                  category: selectedField,
                  value: inputValue,
                })
              }
            >
              {isPending2 ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                "Apply"
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
