// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: {
    default: "UD — Modern Web Platform",
    template: "%s | UD",
  },
  description: "Your Daily tools to optimize your life.",
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
      <html lang="en" suppressHydrationWarning>
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
          <Toaster position="bottom-right" />
        </body>
      </html>
    </>
  );
}
