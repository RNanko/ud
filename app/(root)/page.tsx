import { brand } from "@/lib/brand";
import { publicMetadata } from "@/lib/seo/metadata";
import PublicStructuredData from "@/app/components/landing/PublicStructuredData";
import { launchPolicy } from "@/lib/account/config";
import LandingProvider, {
  MainAction,
} from "@/app/components/landing/LandingProvider";
import LandingHeader from "@/app/components/landing/LandingHeader";
import HeroCarousel from "@/app/components/landing/HeroCarousel";
import DeferredAppPreview from "@/app/components/landing/DeferredAppPreview";
import StaticAppPreview, { StaticMomentumPreview } from "@/app/components/landing/StaticAppPreview";
import FeatureOverview from "@/app/components/landing/FeatureOverview";
import AnnualMembership from "@/app/components/landing/AnnualMembership";
import LandingFAQ from "@/app/components/landing/LandingFAQ";
import LandingFooter from "@/app/components/landing/LandingFooter";
import "./landing.css";
export const metadata = publicMetadata("/", brand.title, brand.description);
export default function Home() {
  const { trialDays } = launchPolicy();
  return (
    <LandingProvider trialDays={trialDays}>
      <div className="mf-landing">
        <PublicStructuredData path="/" title={brand.title} description={brand.description} />
        <LandingHeader />
        <main id="main-content" tabIndex={-1}>
          <HeroCarousel />
          <DeferredAppPreview preview={<StaticAppPreview />} momentum={<StaticMomentumPreview />}>
            <FeatureOverview />
          </DeferredAppPreview>
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
