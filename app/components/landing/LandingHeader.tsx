import Link from "next/link";
import { Menu } from "lucide-react";
import Brand from "@/app/components/shared/Brand";
import { MainAction, LandingAuthLink } from "./LandingProvider";
const sections = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#membership", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];
export default function LandingHeader({ home = true }: { home?: boolean }) {
  return (
    <header className="mf-header">
      <a href="#main-content" className="mf-skip">
        Skip to content
      </a>
      <Link prefetch={false} href="/" className="mf-brand">
        <Brand />
      </Link>
      <nav className="mf-desktop-nav" aria-label="Main navigation">
        {sections.map((item) => (
          <a href={`${home ? "" : "/"}${item.href}`} key={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="mf-header-action">
        <MainAction compact />
      </div>
      <details className="mf-mobile-menu">
        <summary aria-label="Open navigation">
          <Menu size={22} />
        </summary>
        <nav aria-label="Mobile navigation">
          {sections.map((item) => (
            <a href={`${home ? "" : "/"}${item.href}`} key={item.href}>
              {item.label}
            </a>
          ))}
          <MainAction compact />
        </nav>
      </details>
    </header>
  );
}
