"use client";
import Link from "next/link";
import { Check, ArrowUpRight, CalendarDays, Sparkles } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { annualAmount, monthlyEquivalent, actionDestinations } from "@/lib/landing/offer";
import { useLanding } from "./LandingProvider";

export default function AnnualMembership() {
  const { currency, paid, action, trialDays, availability } = useLanding();
  const annual = annualAmount(currency);
  const available = availability[currency] !== false;
  const purchaseHref = action === "signup"
    ? "/auth/registration?intent=membership"
    : action === "verify" ? actionDestinations.verify : "/account?section=membership";
  const purchaseLabel = action === "verify" ? "Continue verification"
    : paid ? "Manage membership"
    : action === "open" ? "View membership" : "Get annual membership";
  const trialLabel = action === "open" ? "Open your app"
    : action === "membership" ? "Review your access"
    : action === "verify" ? "Continue verification" : `Try it free for ${trialDays} days`;

  return (
    <section id="membership" className="mf-section mf-membership" aria-labelledby="membership-heading">
      <div className="mf-membership-copy">
        <p className="mf-eyebrow">Make room for better days</p>
        <h2 id="membership-heading">Your whole system.<br />One small <span>price.</span></h2>
        <p>Plan your week. Track your training. Keep your money and goals in view. All in one membership.</p>
        <div className="mf-year-value">
          <CalendarDays size={24} aria-hidden="true" />
          <div><strong>A full year of access</strong><span>One simple annual payment.</span></div>
        </div>
        <p className="mf-small">Start with a {trialDays}-day free trial. No card required.<br />Choose membership when you&apos;re ready to keep going.</p>
      </div>

      <div className="mf-price-card">
        <div className="mf-price-card-heading">
          <p className="mf-eyebrow">ManForth Annual Membership</p>
          <span className="mf-value-badge"><Sparkles size={14} aria-hidden="true" />All tools included</span>
        </div>
        <p className="mf-monthly-label">Only about</p>
        <div className="mf-price"><strong>{monthlyEquivalent(currency)}</strong><span>/ month</span></div>
        <p className="mf-annual-charge"><strong>{annual}</strong><span>{currency} billed annually</span></p>
        <p className="mf-small mf-price-explanation">Monthly equivalent, rounded. One yearly payment; no monthly billing. Applicable tax included.</p>

        <ul className="mf-inclusions">
          {["Finance & Investments", "To-Do & weekly Events", "Gym planner & training log", "Momentum goals & Journeys"].map(text => <li key={text}><Check size={17} aria-hidden="true" />{text}</li>)}
        </ul>
        <Button asChild className="mf-primary mf-membership-buy"><Link prefetch={false} href={available ? purchaseHref : actionDestinations[action]}>{available ? purchaseLabel : trialLabel}<ArrowUpRight size={18} aria-hidden="true" /></Link></Button>
        <p className="mf-purchase-reassurance">Review the full annual price before payment.</p>
        {available && <Link prefetch={false} className="mf-trial-link" href={actionDestinations[action]}>{trialLabel}<ArrowUpRight size={15} aria-hidden="true" /></Link>}
        <p className="mf-renewal-note">Renews annually unless canceled. Buying during a trial charges now and starts your paid year.</p>
        <p className="mf-price-location">{paid ? "Shown in your subscription's recorded currency." : "Currency selected for your region. Checkout charges the currency shown."}</p>
        <p className="mf-availability" role="status">{availability[currency] === false ? `Annual purchase in ${currency} is currently unavailable. The no-card trial does not need billing configuration.` : "Confirmation and secure checkout are in Account & Settings."}</p>
      </div>
    </section>
  );
}
