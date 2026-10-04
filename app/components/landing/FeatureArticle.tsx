import Link from "next/link";
import { CalendarDays, Compass, Dumbbell } from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { brand } from "@/lib/brand";
import { launchPolicy } from "@/lib/account/config";
import { helpArticles } from "@/lib/help/content";
import { publicPages } from "@/lib/seo/public-pages";
import type { FeatureArticle as Article } from "@/lib/seo/features";
import LandingProvider, { MainAction } from "./LandingProvider";
import LandingHeader from "./LandingHeader";
import LandingFooter from "./LandingFooter";
import PublicStructuredData from "./PublicStructuredData";
import PublicFeatureLinks from "./PublicFeatureLinks";
import FeaturePreview from "./FeaturePreview";
import QuestionAnswer from "../help/QuestionAnswer";

const icons = { gym: Dumbbell, events: CalendarDays, momentum: Compass };

export default function FeatureArticle({ article }: { article: Article }) {
  const { trialDays } = launchPolicy();
  const questions = helpArticles(trialDays).filter(question => article.questionIds.includes(question.id));
  const related = publicPages.find(page => page.path === article.related)!;
  const Icon = icons[article.module];
  return <LandingProvider trialDays={trialDays}><div className="mf-landing">
    <PublicStructuredData path={article.path} title={article.title} description={article.description} breadcrumbs={[{ name: brand.productName, path: "/" }, { name: article.label, path: article.path }]} />
    <LandingHeader home={false} />
    <main id="main-content" tabIndex={-1} className="mf-section mf-feature-page">
      <nav className="mf-breadcrumb" aria-label="Breadcrumb"><Link href="/" prefetch={false}>ManForth</Link><span aria-hidden="true">/</span><span aria-current="page">{article.label}</span></nav>
      <div className="mf-feature-intro"><div>
        <p className="mf-eyebrow"><Icon size={18} />{article.label}</p>
        <h1>{article.heading}</h1>
        <p>{article.intro}</p>
        <MainAction /><p className="mf-small">{trialDays}-day trial · No card required · Starts when you confirm in your account.</p>
      </div><Card className="mf-feature-snapshot"><FeaturePreview module={article.module} /><p className="mf-small">Read-only component preview · illustrative data, never saved to your account.</p></Card></div>
      <section aria-labelledby="feature-workflow-heading"><p className="mf-eyebrow">From plan to recorded action</p><h2 id="feature-workflow-heading">How it works in ManForth</h2>
        <ol className="mf-feature-steps">{article.steps.map((step, i) => <li key={step.title}><Card className="mf-workflow-card"><span className="mf-eyebrow">0{i + 1}</span><h3>{step.title}</h3><p>{step.body}</p></Card></li>)}</ol>
      </section>
      <section aria-labelledby="feature-example-heading" className="mf-feature-example-section"><p className="mf-eyebrow">Example data</p><h2 id="feature-example-heading">{article.exampleTitle}</h2><p>{article.example}</p>
        {article.module === "gym" && <div className="mf-results-table"><table><caption>Illustrative bench press: user-entered targets and actual results</caption><thead><tr><th scope="col">Set</th><th scope="col">Planned</th><th scope="col">Actual</th></tr></thead><tbody>{["60 kg × 10", "60 kg × 9", "55 kg × 10"].map((actual, i) => <tr key={i}><th scope="row">{i + 1}</th><td>60 kg × 10</td><td>{actual}</td></tr>)}</tbody></table></div>}
        {article.module === "events" && <div className="mf-example-week" aria-label="Illustrative weekly plan">{[{day:"Monday",name:"Chest / Triceps Day",detail:"Planned · Optional time"},{day:"Friday",name:"Meet-up",detail:"Planned · 18:30"},{day:"Task board",name:"Car inspection",detail:"To do · Move when ready"}].map(item=><Card className="mf-example-card" key={item.day}><p className="mf-eyebrow">{item.day}</p><h3>{item.name}</h3><p>{item.detail}</p></Card>)}</div>}
        {article.module === "momentum" && <Card className="mf-example-card"><div className="mf-goal-row"><span>Example weekly training goal<small>Confirmed sessions · Gym / linked Events</small></span><strong>3 / 3</strong></div><progress className="mf-progress" value={3} max={3} aria-label="Example: three confirmed sessions of a target of three" /><p>Weekly Review: What made training easier to start?</p></Card>}
      </section>
      <section className="mf-feature-limits" aria-labelledby="feature-limits-heading"><h2 id="feature-limits-heading">What the records mean</h2><ul>{article.limits.map(limit=><li key={limit}>{limit}</li>)}</ul></section>
      <section className="mf-qa-list" aria-labelledby="feature-questions-heading"><h2 id="feature-questions-heading">Helpful questions</h2>{questions.map(article=><QuestionAnswer key={article.id} article={article} />)}<Link className="mf-text-link" href="/help" prefetch={false}>Browse all Help & Q&A ↗</Link></section>
      <section className="mf-feature-next"><h2>Your next useful step</h2><p><Link className="mf-text-link" href={related.path} prefetch={false}>Explore {related.label.toLowerCase()} ↗</Link></p><PublicFeatureLinks current={article.path} /><MainAction /></section>
    </main><LandingFooter home={false} />
  </div></LandingProvider>;
}
