"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, ArrowUpRight } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { helpArticles, helpCategories, searchHelp, type HelpCategory } from "@/lib/help/content";
import { brand } from "@/lib/brand";
import { useLanding } from "../landing/LandingProvider";
import QuestionAnswer from "./QuestionAnswer";

export default function HelpQuestions() {
  const { currency, trialDays } = useLanding();
  const articles = useMemo(() => helpArticles(trialDays, currency), [trialDays, currency]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategory | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const matches = searchHelp(articles, query, category);

  useEffect(() => {
    const readHash = () => {
      const id = window.location.hash.slice(1);
      if (articles.some(article => article.id === id)) {
        setQuery(""); setCategory("all"); setOpenId(id);
      }
    };
    readHash(); window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, [articles]);
  useEffect(() => {
    if (openId && window.location.hash === `#${openId}`) document.getElementById(openId)?.scrollIntoView({ block: "start" });
  }, [openId, query, category]);

  return <>
    <div className="mf-help-search">
      <label htmlFor="help-search">Search questions</label>
      <div><Search size={20} aria-hidden="true" /><input id="help-search" type="search" placeholder="Try trial, workout, currency…" value={query} onChange={event => setQuery(event.target.value)} aria-controls="help-answers" autoComplete="off" />
        {query && <Button variant="ghost" size="icon" aria-label="Clear question search" onClick={() => setQuery("")}><X size={18} /></Button>}
      </div>
    </div>
    <div className="mf-help-layout">
      <aside aria-label="Question topics">
        <p className="mf-eyebrow">Browse by topic</p>
        <div className="mf-help-topics" role="group" aria-label="Filter questions by topic">
          {[{ id: "all", label: "All questions" }, ...helpCategories].map(topic => <button key={topic.id} aria-pressed={category === topic.id} onClick={() => { setCategory(topic.id as HelpCategory | "all"); setOpenId(null); }}>{topic.label}</button>)}
        </div>
      </aside>
      <div id="help-answers" className="mf-qa-list">
        <p className="mf-help-count" role="status">{matches.length} {matches.length === 1 ? "answer" : "answers"}{category !== "all" ? ` in ${helpCategories.find(topic => topic.id === category)?.label}` : ""}</p>
        {matches.map(article => <QuestionAnswer key={article.id} article={article} related={article.relatedIds.map(id => articles.find(item => item.id === id)!)} open={openId === article.id} onOpen={isOpen => setOpenId(current => isOpen ? article.id : current === article.id ? null : current)} />)}
        {matches.length === 0 && <div className="mf-help-empty"><h2>No matching questions</h2><p>Try another word or browse all topics. You can also contact support below.</p><Button variant="outline" onClick={() => { setQuery(""); setCategory("all"); }}>Show all questions</Button></div>}
      </div>
    </div>
    <nav aria-label="Privacy and legal help" className="flex flex-wrap gap-5 py-6 text-sm"><Link className="underline" href="/terms">Terms & Conditions</Link><Link className="underline" href="/privacy">Privacy Policy</Link><Link className="underline" href="/account?section=privacy">My documents, export & deletion</Link></nav><section className="mf-help-support" aria-labelledby="help-support-heading">
      <div><h2 id="help-support-heading">Still have a question?</h2><p>Contact support, including if you can&apos;t access your account.</p></div>
      <Button asChild variant="outline"><a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}<ArrowUpRight size={17} /></a></Button>
    </section>
  </>;
}
