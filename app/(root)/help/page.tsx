import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { publicMetadata } from "@/lib/seo/metadata";
import PublicStructuredData from "@/app/components/landing/PublicStructuredData";
import PublicFeatureLinks from "@/app/components/landing/PublicFeatureLinks";
import { launchPolicy } from "@/lib/account/config";
import LandingProvider from "@/app/components/landing/LandingProvider";
import LandingHeader from "@/app/components/landing/LandingHeader";
import LandingFooter from "@/app/components/landing/LandingFooter";
import HelpQuestions from "@/app/components/help/HelpQuestions";
import "../landing.css";

const title = "ManForth Help & Q&A — Planning, Training & Membership | B1-Way";
const description = "Find answers about ManForth, your trial and membership, money, training, Momentum, privacy and support.";
export const metadata = publicMetadata("/help", title, description);
export default function HelpPage() {
  return <LandingProvider trialDays={launchPolicy().trialDays}><div className="mf-landing">
    <PublicStructuredData path="/help" title={title} description={description} breadcrumbs={[{name:"ManForth",path:"/"},{name:"Help & Q&A",path:"/help"}]} />
    <LandingHeader home={false} />
    <main id="main-content" tabIndex={-1} className="mf-section mf-help">
      <nav className="mf-breadcrumb" aria-label="Breadcrumb"><Link href="/" prefetch={false}>ManForth</Link><span aria-hidden="true">/</span><span aria-current="page">Help & Q&A</span></nav>
      <p className="mf-eyebrow"><CircleHelp size={17} />Help & Q&A</p>
      <h1>Good questions.<br /><span>Straight answers.</span></h1>
      <p className="mf-help-intro">Find your next step. Browse answers or search for what you need.</p>
      <HelpQuestions />
      <PublicFeatureLinks />
    </main>
    <LandingFooter home={false} />
  </div></LandingProvider>;
}
