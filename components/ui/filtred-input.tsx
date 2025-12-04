"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "./input";

export function FiltredInput({ list }: { list: string[] }) {
  const [filter, setFilter] = useState("");

  const filteredList = list.filter((item) =>
    item.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Select>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select" />
      </SelectTrigger>

      <SelectContent className="w-full p-0">
        {/* Input always visible */}
        <div className="p-2 border-b bg-background sticky top-0 z-10">
          <Input
            placeholder="Filter..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8"
          />
        </div>

        {/* Scrollable list */}
        <div className="max-h-60 overflow-y-auto">
          <SelectGroup>
            {filteredList.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">
                No results
              </div>
            )}

            {filteredList.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectGroup>
        </div>
      </SelectContent>
    </Select>
  );
}
