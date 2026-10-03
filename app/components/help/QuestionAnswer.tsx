import type { HelpArticle } from "@/lib/help/content";

export default function QuestionAnswer({ article, related = [], open, onOpen }: {
  article: HelpArticle;
  related?: HelpArticle[];
  open?: boolean;
  onOpen?: (open: boolean) => void;
}) {
  return <details id={article.id} open={open} onToggle={onOpen ? event => onOpen(event.currentTarget.open) : undefined}>
    <summary>{article.question}<span aria-hidden="true">+</span></summary>
    <p>{article.answer}</p>
    {related.length > 0 && <nav className="mf-related-questions" aria-label={`Related to ${article.question}`}>
      <span>Related questions</span>
      {related.map(item => <a key={item.id} href={`/help#${item.id}`}>{item.question}</a>)}
    </nav>}
  </details>;
}
