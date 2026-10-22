import { brand, publicOrigin } from "../brand";
import type { PublicPath } from "./public-pages";

export type PublicBreadcrumb = { name: string; path: PublicPath };
export function publicGraph(path: PublicPath, title: string, description: string, breadcrumbs: PublicBreadcrumb[] = []) {
  const origin = publicOrigin(), url = origin + path;
  const graph: Record<string, unknown>[] = [{
    "@type": "WebPage", "@id": `${url}#webpage`, url, name: title, description,
    inLanguage: "en", isPartOf: { "@id": `${origin}/#website` },
    ...(path === "/" ? { mainEntity: { "@id": `${origin}/#application` } } : {}),
    ...(breadcrumbs.length ? { breadcrumb: { "@id": `${url}#breadcrumb` } } : {}),
  }];
  if (path === "/") graph.push(
    { "@type": "WebSite", "@id": `${origin}/#website`, url: `${origin}/`, name: brand.productName, alternateName: `${brand.productName} ${brand.brandLine}`, inLanguage: "en" },
    { "@type": "WebApplication", "@id": `${origin}/#application`, name: brand.productName, url: `${origin}/`, description: brand.description, applicationCategory: "LifestyleApplication", browserRequirements: "Requires a modern web browser", featureList: ["Notes with text, checklists, freehand drawing and pinned cards", "Money tracker for expenses, income, categories, charts and transaction history", "Calendar and weekly event planner with optional times and completion tracking", "To-do lists and a Kanban task board", "Gym and activity tracker with workout plans, strength sets and cardio logs", "Stock, ETF and crypto portfolio tracking in USD with saved position history", "Momentum goals, Journeys and Weekly Review"] },
  );
  // Published checkout availability and qualifying review evidence are not established.
  // No offers, ratings, publisher identity, private Event records or native download claims.
  if (breadcrumbs.length) graph.push({ "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`, itemListElement: breadcrumbs.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: origin + item.path })) });
  return { "@context": "https://schema.org", "@graph": graph };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
