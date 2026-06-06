"use client";
import Chat from "./chat";
import SnInfo from "./sn_info";
import { useState } from "react";



export default function Page() {
  const [repairInfo, setRepairInfo] = useState(null);

  return (
    <section className="flex h-full">
      <Chat repairInfo={repairInfo} />
      <SnInfo setRepairInfo={setRepairInfo} />
    </section>
  );
}
