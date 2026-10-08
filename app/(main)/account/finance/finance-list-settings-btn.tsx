"use client";

import { useState, useTransition } from "react";
import { Settings, Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { InferSelectModel } from "drizzle-orm";
import { financeTable } from "@/lib/db/schema";
import { removeListItem, updateListItem } from "@/lib/actions/finance.actions";

type FinanceRow = InferSelectModel<typeof financeTable>;

export default function FinanceListSettingsBtn({ data }: { data: FinanceRow }) {
  const [selectedField, setSelectedField] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  const [isPending, startTransition] = useTransition();
  const [isPending2, startTransition2] = useTransition();

  // DELETE HANDLER
  function handleDelete({ id }: { id: string }) {
    startTransition(async () => {
      setError("");
      try {
        const res = await removeListItem(id);
        if (!res.success) setError(res.message);
      } catch { setError("Could not delete this item. Please retry."); }
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
      setError("");
      try {
        const res = await updateListItem(id, category, value);
        if (res.success) {
          setInputValue("");
        } else {
          setError(res.message);
        }
      } catch { setError("Could not update this item. Please retry."); }
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
        {error && <p role="alert" className="mb-3 text-sm text-orange-300">{error}</p>}
        {/* DELETE BUTTON */}
        <Button
          variant="destructive"
          onClick={() => handleDelete({ id: data.id })}
          className="w-full"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="animate-spin h-4 w-4" />
          ) : (
            "Delete Line"
          )}
        </Button>

        {/* UPDATE SECTION */}
        <div className="grid gap-4 m-2">
          <h4 className="font-medium text-center">Change data</h4>

          <div className="grid gap-2 items-center ">
            {/* FIELD SELECT */}
            <Select onValueChange={setSelectedField} value={selectedField} required >
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
              disabled={isPending2 || !selectedField}
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
