// app/layout.tsx

import Footer from "@/components/shared/layouts/footer";
import Header from "@/components/shared/layouts/header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My App",
  description: "Next.js Theme Toggle Example",
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
        <main className="w-full mx-auto px-5 py-5 grow">{children}</main>
        <Footer />
      </div>
    </>
  );
}
