"use client";
/* Artwork has no controls or private account state. All copy remains visible when loading fails. */
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Wallet,
  TrendingUp,
  ListTodo,
  CalendarDays,
  Dumbbell,
} from "lucide-react";
import { heroScenes, sceneSource } from "@/lib/landing/scenes";
import { annualAmount, monthlyEquivalent } from "@/lib/landing/offer";
import { MainAction, useLanding } from "./LandingProvider";
const icons = [Wallet, TrendingUp, ListTodo, CalendarDays, Dumbbell];
export default function HeroCarousel() {
  const { trialDays, currency } = useLanding();
  const [index, setIndex] = useState(0),
    [previous, setPrevious] = useState<number | null>(null),
    [playing, setPlaying] = useState(false),
    [ready, setReady] = useState(false),
    [hover, setHover] = useState(false),
    [visible, setVisible] = useState(true),
    [inView, setInView] = useState(true),
    [reduced, setReduced] = useState(true),
    [failed, setFailed] = useState(false),
    [pending, setPending] = useState(false);
  const stage = useRef<HTMLElement>(null),
    request = useRef(0),
    failedImages = useRef(new Set<number>()),
    touch = useRef<{ x: number; y: number } | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const control = request;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)"),
      coarse = window.matchMedia("(pointer: coarse)");
    const update = () => {
      setReduced(motion.matches);
      setPlaying(!motion.matches && !coarse.matches);
    };
    update();
    motion.addEventListener("change", update);
    coarse.addEventListener("change", update);
    const onVisibility = () => setVisible(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 },
    );
    if (stage.current) observer.observe(stage.current);
    return () => {
      ++control.current;
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", update);
      coarse.removeEventListener("change", update);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  async function select(target: number, automatic = false) {
    if (!automatic) setPlaying(false);
    const version = ++request.current;
    setPending(true);
    // Load/decode the appropriate crop before committing; a failed candidate leaves the current scene intact.
    let candidate = (target + heroScenes.length) % heroScenes.length;
    for (let tries = 0; tries < heroScenes.length; tries++) {
      if (!automatic || !failedImages.current.has(candidate)) {
        try {
          const image = new window.Image();
          image.src = sceneSource(
            candidate,
            window.matchMedia("(max-width: 700px)").matches,
            window.innerWidth > 1400,
          );
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(Error("Artwork unavailable")),
              10000,
            );
            image.onload = () => {
              clearTimeout(timeout);
              resolve();
            };
            image.onerror = () => {
              clearTimeout(timeout);
              reject(Error("Artwork unavailable"));
            };
            if (image.complete && image.naturalWidth) {
              clearTimeout(timeout);
              resolve();
            }
          });
          await image.decode();
          if (version !== request.current) return;
          setPrevious(reduced ? null : index);
          setIndex(candidate);
          setFailed(false);
          setReady(true);
          setPending(false);
          return;
        } catch {
          failedImages.current.add(candidate);
        }
      }
      if (!automatic) break;
      candidate = (candidate + 1) % heroScenes.length;
    }
    if (version === request.current) {
      setPending(false);
      if (automatic) setPlaying(false);
    }
  }
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (
      playing &&
      !reduced &&
      ready &&
      visible &&
      inView &&
      !hover &&
      !pending
    ) {
      timer.current = setTimeout(() => {
        void select(index + 1, true);
      }, 6000);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // select uses only state setters/refs and the target, so no changing closure dependency is required.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, playing, reduced, ready, visible, inView, hover, pending]);
  useEffect(() => {
    if (previous === null) return;
    const timeout = setTimeout(() => setPrevious(null), 650);
    return () => clearTimeout(timeout);
  }, [index, previous]);
  const scene = heroScenes[index];
  return (
    <section
      ref={stage}
      className="mf-hero"
      aria-label="ManForth product stories"
      aria-roledescription="carousel"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setPlaying(false)}
    >
      <div
        className="mf-hero-controls"
        role="group"
        aria-label="Story navigation"
      >
        <button
          className="mf-icon-button"
          aria-label={playing ? "Pause story rotation" : "Play story rotation"}
          aria-pressed={playing}
          onClick={() => setPlaying((value) => !value)}
          disabled={reduced}
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button
          className="mf-icon-button"
          aria-label="Previous story"
          onClick={() => void select(index - 1)}
        >
          <ChevronLeft size={20} />
        </button>
        <span className="mf-scene-counter" aria-hidden="true">
          0{index + 1} / 05
        </span>
        <button
          className="mf-icon-button"
          aria-label="Next story"
          onClick={() => void select(index + 1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="mf-hero-copy">
        <p className="mf-eyebrow">A direction. A plan. Your next step.</p>
        <h1>
          Build the man
          <br />
          you choose
          <br />
          to <span>be.</span>
        </h1>
        <p className="mf-descriptor">Plan. Train. Make progress.</p>
        <p className="mf-hero-body">
          A personal-development planner for your training, tasks, money, and goals.
        </p>
        <div className="mf-hero-actions">
          <MainAction />
          <a className="mf-text-link" href="#explore">
            Explore the app <ChevronRight size={16} />
          </a>
        </div>
        <p className="mf-small">
          {trialDays} days. No card required. Starts automatically after you
          verify your email and create your account.
        </p>
        <a className="mf-hero-value-link" href="#membership">
          <span><strong>About {monthlyEquivalent(currency)} / month</strong><small>{annualAmount(currency)} {currency} billed annually</small></span>
          <ChevronRight size={20} aria-hidden="true" />
        </a>
      </div>
      <div
        className="mf-art"
        data-failed={failed}
        onTouchStart={(e) => {
          touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          if (start) {
            const dx = e.changedTouches[0].clientX - start.x,
              dy = e.changedTouches[0].clientY - start.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5)
              void select(index + (dx < 0 ? 1 : -1));
          }
          touch.current = null;
        }}
      >
        {previous !== null && previous !== index && (
          <picture className="mf-art-picture">
            <source
              media="(max-width: 700px)"
              srcSet={`/manforth/${heroScenes[previous].id}-mobile.webp`}
            />
            <source
              media="(min-width: 1401px)"
              srcSet={`/manforth/${heroScenes[previous].id}-1672.webp`}
            />
            <img
              src={`/manforth/${heroScenes[previous].id}-1100.webp`}
              width={1672}
              height={941}
              alt=""
            />
          </picture>
        )}
        <picture
          key={scene.id}
          className="mf-art-picture"
          data-entering={previous !== null && previous !== index}
        >
          <source
            media="(max-width: 700px)"
            srcSet={`/manforth/${scene.id}-mobile.webp`}
          />
          <source
            media="(min-width: 1401px)"
            srcSet={`/manforth/${scene.id}-1672.webp`}
          />
          <img
            src={`/manforth/${scene.id}-1100.webp`}
            width={1672}
            height={941}
            alt=""
            fetchPriority={index === 0 ? "high" : "auto"}
            loading="eager"
            onLoad={() => setReady(true)}
            onError={() => {
              failedImages.current.add(index);
              setFailed(true);
              setReady(true);
            }}
          />
        </picture>
        <div className="mf-art-overlay" aria-hidden="true" />
        <div className="mf-art-example">
          <span className="mf-dot" />
          <div>
            <strong>{scene.example}</strong>
            {scene.facts.map((fact) => (
              <small key={fact}>{fact}</small>
            ))}
            <small>Example data</small>
          </div>
        </div>
      </div>
      <div className="mf-story-caption" aria-live={playing ? "off" : "polite"}>
        {heroScenes.map((item, i) => (
          <div
            key={item.id}
            className="mf-story-copy"
            data-active={i === index}
            aria-hidden={i !== index}
          >
            <strong>{item.caption}</strong>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
      <div
        className="mf-scene-selector"
        role="group"
        aria-label="Choose a story"
      >
        {heroScenes.map((item, i) => {
          const Icon = icons[i];
          return (
            <button
              key={item.id}
              aria-pressed={i === index}
              className="mf-scene-button"
              onClick={() => void select(i)}
            >
              <Icon size={17} />
              {item.name}
            </button>
          );
        })}
      </div>
      <span className="sr-only" role="status">
        {pending
          ? "Loading selected story; current story remains visible."
          : reduced
            ? "Automatic rotation disabled by reduced motion preference."
            : failed
              ? "Illustration unavailable; story and navigation remain usable."
              : ""}
      </span>
    </section>
  );
}
