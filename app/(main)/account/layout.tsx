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
  return <div>{children}</div>;
}
