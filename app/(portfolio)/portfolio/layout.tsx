// app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio",

  description: "Roman Naumenko Portfolio",
  authors: [{ name: "Roman Naumenko" }],
  creator: "Roman Naumenko",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
        {children}
    </>
  );
}
