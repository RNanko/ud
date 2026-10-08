// app/layout.tsx

import AccSidebar from "@/app/components/shared/account/acc-sidebar";

import Header from "@/app/components/shared/layouts/header";
import InboxProvider from "@/app/components/notifications/InboxProvider";
import type { Metadata } from "next";
import { Suspense } from "react";
import Loader from "@/app/components/shared/loader";
import PrivateIdentityBoundary from "@/app/components/shared/account/PrivateIdentityBoundary";
import { requireUserId } from "@/lib/session";

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
  return <Suspense fallback={<Loader />}><PrivateWorkspace>{children}</PrivateWorkspace></Suspense>;
}

async function PrivateWorkspace({ children }: { children: React.ReactNode }) {
  const owner = await requireUserId();
  return (
    <PrivateIdentityBoundary key={owner} owner={owner}>
    <InboxProvider>
      <div className="min-h-screen flex flex-col gap-5 max-w-7xl mx-auto">
        <Header inbox />
        <div className="flex flex-col gap-5 lg:flex-row mx-5 ">
          <AccSidebar />

          <main className="w-full min-w-0">{children}</main>
        </div>
      </div>
    </InboxProvider>
    </PrivateIdentityBoundary>
  );
}
