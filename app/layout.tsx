// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/app/components/theme-provider";
import { Toaster } from "sonner";
import { brand, publicOrigin, indexPublicSite } from "@/lib/brand";

export const metadata: Metadata = {
  title: {
    default: brand.title,
    template: `%s | ${brand.productName}`,
  },
  description: brand.description,
  metadataBase: new URL(publicOrigin()),
  robots: { index: indexPublicSite(), follow: indexPublicSite() },
  icons: { icon: "/manforth/mark.svg", apple: "/manforth/mark.svg" },
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
