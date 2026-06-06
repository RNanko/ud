"use client";

import { useEffect, useState } from "react";

export default function Chat({ repairInfo }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!repairInfo) return;

    setMessages([
      {
        role: "assistant",
        content: "Hi, describe problem.",
      },
    ]);
  }, [repairInfo]);

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!input.trim()) return;

    const userMessage = input;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      const prompt = `
        Context:

        Fault Description:
        ${userMessage}

        Engineering Change Notice must be done:
        ${repairInfo.ecn?.description || "N/A"}

        Common Checklist:
        ${
          repairInfo.model_info?.length
            ? repairInfo.model_info.map((x) => `- ${x}`).join("\n")
            : "N/A"
        }

        Previous Claims:
        ${
          repairInfo.claims?.length
            ? repairInfo.claims.map((c) => `- ${c.date}: ${c.fault}`).join("\n")
            : "None"
        }

        User Question:
        ${userMessage}
        `;

      const response = await fetch(
        "https://nankind-repair.hf.space/chat-groq",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fault_description: userMessage,
            ecn: repairInfo.ecn?.description || "",
            checklist: repairInfo.model_info || [],
            claims: repairInfo.claims || [],
            messages: [
              {
                role: "user",
                content: userMessage,
              },
            ],
          }),
        },
      );

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-2/3 border-r flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`max-w-xl rounded-lg border p-3 whitespace-pre-wrap ${
              message.role === "assistant"
                ? "bg-gray-700 border-gray-600"
                : "bg-gray-600 border-gray-500 ml-auto"
            }`}
          >
            {message.content}
          </div>
        ))}

        {loading && (
          <div className="max-w-xl rounded-lg border border-gray-600 bg-gray-700 p-3">
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-white animate-bounce"></span>
              <span
                className="h-2 w-2 rounded-full bg-white animate-bounce"
                style={{ animationDelay: "0.15s" }}
              ></span>
              <span
                className="h-2 w-2 rounded-full bg-white animate-bounce"
                style={{ animationDelay: "0.3s" }}
              ></span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <form onSubmit={sendMessage} className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe fault..."
            rows={1}
            className="flex-1 resize-none border rounded-lg px-4 py-3"
          />

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg
            hover:cursor-pointer hover:bg-blue-500
            "
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
