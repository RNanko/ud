import { Button } from "@/app/components/ui/button";
import Brand from "@/app/components/shared/Brand";
import { ArrowRight, Compass, House, LifeBuoy } from "lucide-react";
import Link from "next/link";
import styles from "./not-found.module.css";

const NotFound = () => {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" aria-label="ManForth home" className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary-plus">
          <Brand compact />
        </Link>
      </header>
      <main className={styles.main}>
        <section className={styles.card} aria-labelledby="not-found-title">
          <div className={styles.code} aria-hidden="true">
            <span>4</span>
            <span className={styles.orbit}><Compass strokeWidth={1.25} /></span>
            <span>4</span>
          </div>
          <p className={styles.eyebrow}>404 · Page not found</p>
          <h1 id="not-found-title" className={styles.title}>Let’s get you back on track.</h1>
          <p className={styles.description}>This link may have moved, or the address may be incorrect. Your next step is just a click away.</p>
          <nav aria-label="Return to ManForth" className={styles.actions}>
            <Button asChild className="min-h-12 rounded-2xl bg-primary-plus px-6 text-background hover:bg-primary-plus/90">
              <Link href="/account/momentum" prefetch={false}>Go to app<ArrowRight aria-hidden="true" /></Link>
            </Button>
            <Button asChild variant="outline" className="min-h-12 rounded-2xl px-6">
              <Link href="/"><House aria-hidden="true" />Back to home</Link>
            </Button>
          </nav>
        </section>
      </main>
      <footer className={styles.footer}>
        <span>Need a hand?</span>
        <Link href="/help" className={styles.help}><LifeBuoy size={16} aria-hidden="true" />Help & Q&A<ArrowRight size={14} aria-hidden="true" /></Link>
      </footer>
    </div>
  );
};

export default NotFound;
