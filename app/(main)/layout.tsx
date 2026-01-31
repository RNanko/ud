// app/layout.tsx

import AccSidebar from "@/components/shared/account/acc-sidebar";

import Header from "@/components/shared/layouts/header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UD",
  description: "You Daily",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="min-h-screen flex flex-col gap-5 max-w-800 mx-auto">
        <Header />
        <div className="flex flex-col gap-5 lg:flex-row mx-5">
          <AccSidebar />

          <main className="w-full">{children}</main>
        </div>
      </div>
    </>
  );
}
