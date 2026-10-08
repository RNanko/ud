// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/app/components/theme-provider";
import SessionProvider from "@/app/components/shared/account/SessionProvider";
import { brand, publicOrigin, indexPublicSite } from "@/lib/brand";

export const metadata: Metadata = {
  title: {
    default: brand.title,
    template: `%s | ${brand.productName}`,
  },
  description: brand.description,
  metadataBase: new URL(publicOrigin()),
  robots: { index: indexPublicSite(), follow: indexPublicSite() },
  icons: { icon: "/manforth/mark.svg", apple: "/manforth/apple-touch-icon.png" },
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
            <SessionProvider>{children}</SessionProvider>
          </ThemeProvider>
        </body>
      </html>
    </>
  );
}
