"use client";

import { useEffect } from "react";
import journey from "./journey/journey.module.css";

/** Progressive enhancement: server content stays readable before hydration. */
export default function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-landing-motion]");
    if (!root || !("IntersectionObserver" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const targets = new Set<HTMLElement>();
    const groups = [
      { selector: `.${journey.copyBadge}`, kind: "rise", delay: 0 },
      { selector: `.${journey.copyTitle} h1`, kind: "rise", delay: 70 },
      { selector: `.${journey.copyDescription}`, kind: "rise", delay: 140 },
      { selector: `.${journey.copyActions}`, kind: "rise", delay: 210 },
      { selector: `.${journey.priceDisplay}`, kind: "rise", delay: 280 },
      { selector: `.${journey.featureNav} a`, kind: "slide", delay: 320 },
      { selector: "#how-it-works > p, #how-it-works > h2", kind: "rise", delay: 0 },
      { selector: "#how-it-works li", kind: "slide", delay: 0 },
      { selector: ".mf-membership-copy > *", kind: "rise", delay: 0 },
      { selector: ".mf-price-card", kind: "settle", delay: 80 },
      { selector: "#faq > div:first-child > *", kind: "rise", delay: 0 },
      { selector: "#faq details", kind: "slide", delay: 0 },
      { selector: ".mf-final > *", kind: "rise", delay: 0 },
    ];
    const reveal = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.motionEntered = "true";
        reveal.unobserve(entry.target);
      }
    }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });

    for (const group of groups) {
      root.querySelectorAll<HTMLElement>(group.selector).forEach((target, index) => {
        target.dataset.motionKind = group.kind;
        target.style.setProperty("--motion-delay", `${Math.min(group.delay + index * 65, 580)}ms`);
        targets.add(target);
      });
    }
    const scene = root.querySelector<HTMLElement>(`.${journey.liveHero}`);
    const ambient = new IntersectionObserver(entries => {
      for (const entry of entries) {
        (entry.target as HTMLElement).dataset.motionInView = String(entry.isIntersecting);
      }
    });
    if (scene) {
      scene.dataset.motionScene = "true";
      ambient.observe(scene);
    }
    const visibility = () => { root.dataset.motionSuspended = String(document.hidden); };
    const configure = () => {
      reveal.disconnect();
      for (const target of targets) {
        if (preference.matches) target.dataset.motionEntered = "static";
        else if (!target.dataset.motionEntered) reveal.observe(target);
      }
    };
    visibility();
    configure();
    preference.addEventListener("change", configure);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      reveal.disconnect();
      ambient.disconnect();
      preference.removeEventListener("change", configure);
      document.removeEventListener("visibilitychange", visibility);
      delete root.dataset.motionSuspended;
      if (scene) {
        delete scene.dataset.motionScene;
        delete scene.dataset.motionInView;
      }
      for (const target of targets) {
        delete target.dataset.motionKind;
        delete target.dataset.motionEntered;
        target.style.removeProperty("--motion-delay");
      }
    };
  }, []);
  return null;
}
