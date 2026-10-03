import type { Metadata } from "next";
import { brand, publicOrigin } from "@/lib/brand";
import { launchPolicy } from "@/lib/account/config";
import LandingProvider, {
  MainAction,
} from "@/app/components/landing/LandingProvider";
import LandingHeader from "@/app/components/landing/LandingHeader";
import HeroCarousel from "@/app/components/landing/HeroCarousel";
import AppPreview from "@/app/components/landing/AppPreview";
import FeatureOverview from "@/app/components/landing/FeatureOverview";
import AnnualMembership from "@/app/components/landing/AnnualMembership";
import LandingFAQ from "@/app/components/landing/LandingFAQ";
import LandingFooter from "@/app/components/landing/LandingFooter";
import "./landing.css";
export const metadata: Metadata = {
  title: { absolute: brand.title },
  description: brand.description,
  alternates: { canonical: `${publicOrigin()}/` },
  openGraph: {
    title: brand.title,
    description: brand.description,
    url: `${publicOrigin()}/`,
    siteName: brand.productName,
    type: "website",
    images: [
      {
        url: "/manforth/finance-1672.webp",
        width: 1672,
        height: 941,
        alt: "ManForth — Plan. Train. Make progress.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: brand.title,
    description: brand.description,
    images: ["/manforth/finance-1672.webp"],
  },
};
export default function Home() {
  const { trialDays } = launchPolicy();
  return (
    <LandingProvider trialDays={trialDays}>
      <div className="mf-landing">
        <LandingHeader />
        <main id="main-content">
          <HeroCarousel />
          <AppPreview>
            <FeatureOverview />
          </AppPreview>
          <AnnualMembership />
          <section
            id="faq"
            className="mf-section mf-faq"
            aria-labelledby="faq-heading"
          >
            <div>
              <p className="mf-eyebrow">Clear before you start</p>
              <h2 id="faq-heading">
                Good questions.
                <br />
                <span>Straight answers.</span>
              </h2>
            </div>
            <LandingFAQ />
          </section>
          <section className="mf-section mf-final">
            <p className="mf-eyebrow">One useful step at a time</p>
            <h2>
              Your next step
              <br />
              <span>starts here.</span>
            </h2>
            <p>Make room for the things you choose to build.</p>
            <MainAction />
            <p className="mf-small">{trialDays}-day trial. No card required.</p>
          </section>
        </main>
        <LandingFooter />
      </div>
    </LandingProvider>
  );
}
