// app/layout.tsx

import AccSidebar from "@/app/components/shared/account/acc-sidebar";

import Header from "@/app/components/shared/layouts/header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your workspace",
  description: "Plan, train and follow your goals in ManForth.",
  robots: { index: false, follow: false },
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

          <main className="w-full min-w-0">{children}</main>
        </div>
      </div>
    </>
  );
}
