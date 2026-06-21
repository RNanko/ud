"use server";

import Groq from "groq-sdk";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import db from "../db/drizzle";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PROMPTS, AdvisorType } from "@/lib/actions/prompt";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export async function chatWithGroq(
  messages: Message[],
  advisor: AdvisorType
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user.id) {
    throw new Error("Unauthorized");
  }

  const dbUser = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
  });

  if (!dbUser?.groqKey) {
    throw new Error("Groq API key not found.");
  }

  const groq = new Groq({
    apiKey: dbUser.groqKey,
  });

  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role: "system",
        content: PROMPTS[advisor],
      },
      ...messages,
    ],
    temperature: advisor === "hard" ? 0.9 : 0.7,
  });

  return (
    completion.choices[0].message.content ??
    "I don't have a response right now."
  );
}