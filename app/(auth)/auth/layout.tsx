// app/layout.tsx
import Header from "@/app/components/shared/layouts/header";
import LightRays from "@/app/components/ui/LightRays";
import Link from "next/link";
export const metadata = { title: "Account access", robots: { index: false, follow: false } };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  

  return (
    <div className="relative min-h-screen flex flex-col">
      <LightRays className="inset-0 z-0" />
      <Header />
      <main className="relative z-10 ">{children}</main>
      <nav aria-label="Legal documents" className="relative z-10 flex justify-center gap-6 p-6 text-sm"><Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms</Link><Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</Link><Link href="/help" className="underline">Help</Link></nav>
    </div>
  );
}
