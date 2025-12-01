import { Lock } from "lucide-react";
import React from "react";

export default function Locker({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-row gap-2">
      <Lock />
      {children}
    </div>
  );
}
