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
      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="w-full mx-auto py-5 grow">
          <div
            className="
        flex flex-col gap-6 mx-5
        
      lg:grid lg:grid-cols-[250px_1fr] lg:gap-10
      "
          >
            <AccSidebar />
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
