"use client";

import { annualAmount, monthlyEquivalent } from "@/lib/landing/offer";
import { useLanding } from "../LandingProvider";
import styles from "./journey.module.css";

export default function JourneyPrice() {
  const { currency } = useLanding();

  return (
    <p className={styles.priceDisplay}>
        <strong>About {monthlyEquivalent(currency)} / month</strong>
        <small>{annualAmount(currency)} billed annually</small>
    </p>
  );
}
