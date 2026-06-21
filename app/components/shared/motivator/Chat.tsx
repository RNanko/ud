"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { AdvisorType } from "@/lib/actions/prompt";
import { chatWithGroq } from "@/lib/actions/motivator.actions";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  advisor: AdvisorType;
};

export default function Chat({ advisor }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Motivation? Build discipline!",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const text = input.trim();

    const nextMessages = [
      ...messages,
      {
        role: "user" as const,
        content: text,
      },
    ];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const reply = await chatWithGroq(nextMessages, advisor);

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: reply,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-[700px] max-w-3xl flex-col">
      <div
        ref={scrollRef}
        className="
        chat-scroll
        flex-1 overflow-y-auto
        px-4 py-6
        scroll-smooth
        scrollbar-thin
        scrollbar-track-transparent
        scrollbar-thumb-border
        dark:scrollbar-thumb-zinc-green
      "
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-muted px-4 py-3">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            disabled={loading}
            placeholder="Type your question..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSend();
              }
            }}
          />

          <Button onClick={handleSend} disabled={loading} className="cursor-pointer">
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
