"use client";

import { Loader2Icon, SendIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function AdvisorChat() {
  const trpcContext = trpc.useContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: question,
    };
    const assistantId = `a-${Date.now()}`;

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const stream = await trpcContext.client.skillIntelligence.askAdvisor.mutate(
        { question },
      );

      if (
        stream &&
        typeof stream === "object" &&
        Symbol.asyncIterator in stream
      ) {
        for await (const chunk of stream as AsyncIterable<string>) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ?
                { ...m, content: m.content + chunk }
              : m,
            ),
          );
          scrollToBottom();
        }
      } else if (typeof stream === "string") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: stream } : m,
          ),
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Advisor request failed";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ?
            { ...m, content: `Sorry — ${message}` }
          : m,
        ),
      );
    } finally {
      setStreaming(false);
      scrollToBottom();
    }
  };

  return (
    <section className="flex min-h-[420px] flex-col rounded-2xl border border-zinc-800/90 bg-zinc-900/30">
      <header className="border-b border-zinc-800/80 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
          AI career advisor
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Grounded in your skill gap and India AI job market data.
        </p>
      </header>

      <div
        ref={listRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Ask which skills to prioritize, how salary bands compare, or what to
            learn next for your target role.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "max-w-[92%] rounded-xl px-3 py-2.5 text-sm",
                msg.role === "user" ?
                  "ml-auto bg-indigo-600/90 text-white"
                : "border border-zinc-800/80 bg-zinc-950/60 text-zinc-200",
              )}
            >
              {msg.role === "user" ?
                <p className="whitespace-pre-wrap">{msg.content}</p>
              : msg.content ?
                <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2 prose-li:my-0.5 prose-strong:text-zinc-100">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              : <span className="inline-flex items-center gap-2 text-zinc-500">
                  <Loader2Icon className="size-4 animate-spin" />
                  Thinking…
                </span>
              }
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="border-t border-zinc-800/80 p-4 sm:p-5"
      >
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Which 3 skills should I learn first for Bangalore AI engineer roles?"
            rows={2}
            disabled={streaming}
            className="min-h-[72px] resize-none border-zinc-800 bg-zinc-950/80 text-zinc-100 placeholder:text-zinc-600"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={streaming || !input.trim()}
            className="h-auto shrink-0 self-end bg-indigo-600 text-white hover:bg-indigo-500"
            aria-label="Send"
          >
            {streaming ?
              <Loader2Icon className="size-4 animate-spin" />
            : <SendIcon className="size-4" />}
          </Button>
        </div>
      </form>
    </section>
  );
}


