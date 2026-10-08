import Header from "@/app/components/shared/layouts/header";
import LightRays from "@/app/components/ui/LightRays";
import Link from "next/link";
import SignedOutBoundary from "@/app/components/shared/account/SignedOutBoundary";
import "./auth.css";
export const metadata = { title: "Account access", robots: { index: false, follow: false } };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell">
      <div className="auth-ambient" aria-hidden="true"><LightRays className="inset-0" /></div>
      <Header />
      <main className="auth-main"><SignedOutBoundary>{children}</SignedOutBoundary></main>
      <nav aria-label="Legal documents" className="auth-legal-nav"><Link href="/terms" target="_blank" rel="noopener noreferrer" className="auth-link">Terms</Link><Link href="/privacy" target="_blank" rel="noopener noreferrer" className="auth-link">Privacy Policy</Link><Link href="/help" className="auth-link">Help</Link></nav>
    </div>
  );
}
