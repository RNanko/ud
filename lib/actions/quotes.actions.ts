"use server";

import db from "@/lib/db/drizzle";
import { quoteLikes, quotes } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

export type CreateQuoteInput = {
  quote: string;
  author: string;
};

export async function createQuote(input: CreateQuoteInput) {
  if (!input.quote.trim() || !input.author.trim()) {
    throw new Error("Quote and author are required");
  }

  const newQuote = {
    id: randomUUID(),
    quote: input.quote,
    author: input.author,
    likesCount: 0,
  };

  await db.insert(quotes).values(newQuote);

  return newQuote;
}

export async function getQuotes(userId?: string) {
  "use cache";
  cacheTag("quotes-data");
  // stale: How long the client can use cached data without checking the server
  cacheLife({
    expire: 3600,
    revalidate: 900,
    stale: 300,
  });

  const quotesData = await db.query.quotes.findMany({
    with: {
      likes: {
        where: userId ? eq(quoteLikes.userId, userId) : undefined,
        columns: {
          id: true,
        },
      },
    },
  });

  return quotesData.map((quote) => ({
    id: quote.id,
    author: quote.author,
    quote: quote.quote,
    createdAt: quote.createdAt,
    likesCount: quote.likesCount,
    likedByUser: quote.likes.length > 0,
  }));
}

export async function getQuote(quoteId: string) {
  const quote = await db.query.quotes.findFirst({
    where: eq(quotes.id, quoteId),
  });
  return quote;
}
