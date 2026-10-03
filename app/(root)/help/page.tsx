import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, CircleHelp } from "lucide-react";
import { brand, publicOrigin } from "@/lib/brand";
import { launchPolicy } from "@/lib/account/config";
import LandingProvider from "@/app/components/landing/LandingProvider";
import LandingHeader from "@/app/components/landing/LandingHeader";
import LandingFooter from "@/app/components/landing/LandingFooter";
import HelpQuestions from "@/app/components/help/HelpQuestions";
import "../landing.css";

export const metadata: Metadata = {
  title: { absolute: `Help & Q&A | ${brand.productName} ${brand.brandLine}` },
  description: "Find answers about ManForth, your trial and membership, money, training, Momentum, privacy and support.",
  alternates: { canonical: `${publicOrigin()}/help` },
};
export default function HelpPage() {
  return <LandingProvider trialDays={launchPolicy().trialDays}><div className="mf-landing">
    <LandingHeader home={false} />
    <main id="main-content" className="mf-section mf-help">
      <Link href="/" prefetch={false} className="mf-help-back"><ArrowLeft size={17} />Back to ManForth</Link>
      <p className="mf-eyebrow"><CircleHelp size={17} />Help & Q&A</p>
      <h1>Good questions.<br /><span>Straight answers.</span></h1>
      <p className="mf-help-intro">Find your next step. Browse answers or search for what you need.</p>
      <HelpQuestions />
    </main>
    <LandingFooter home={false} />
  </div></LandingProvider>;
}
