"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { helpArticles, landingQuestionIds } from "@/lib/help/content";
import QuestionAnswer from "../help/QuestionAnswer";
import { useLanding } from "./LandingProvider";

export default function LandingFAQ() {
  const { currency, trialDays } = useLanding();
  const articles = helpArticles(trialDays, currency);
  return <div>
    {landingQuestionIds.map(id => <QuestionAnswer key={id} article={articles.find(article => article.id === id)!} />)}
    <Button asChild variant="outline" className="mf-all-questions">
      <Link href="/help" prefetch={false}>View all questions<ArrowUpRight size={17} /></Link>
    </Button>
  </div>;
}
