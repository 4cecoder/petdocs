"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, PawPrint, Send, X } from "lucide-react";
import { matchHelpAnswer, type HelpAnswer } from "@/lib/helpAnswers";

type ChatMessage = {
  id: number;
  role: "user" | "bot";
  text: string;
  answer?: HelpAnswer;
};

const GREETING: ChatMessage = {
  id: 0,
  role: "bot",
  text: "Hi, I am the PetDocs helper. Ask about pricing, sharing, reminders, and more.",
};

const QUICK_CHIPS: { label: string; query: string }[] = [
  { label: "Price", query: "How much does it cost?" },
  { label: "Apartment", query: "Can I show records to my landlord for my apartment?" },
  { label: "Share", query: "How do I share a passport QR code?" },
  { label: "Reminders", query: "When is the next vaccine due?" },
];

const SUPPORT_EMAIL = "support@petdocs.app";
let nextId = 1;

function botMessageFor(query: string): ChatMessage {
  const answer = matchHelpAnswer(query);
  return {
    id: nextId++,
    role: "bot",
    text: answer.body,
    answer,
  };
}

export function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const send = (raw: string) => {
    const query = raw.trim();
    if (!query || typing) return;
    const userMessage: ChatMessage = { id: nextId++, role: "user", text: query };
    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setTyping(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setMessages((prev) => [...prev, botMessageFor(query)]);
      setTyping(false);
      inputRef.current?.focus();
    }, 400);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Get help"
        aria-expanded={open}
        aria-controls="petdocs-help-panel"
        onClick={() => setOpen((v) => !v)}
        className="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {open ? (
          <X size={24} aria-hidden="true" />
        ) : (
          <MessageCircle size={24} aria-hidden="true" />
        )}
      </button>

      {open ? (
        <div
          id="petdocs-help-panel"
          role="dialog"
          aria-label="PetDocs help"
          className="fixed right-6 bottom-24 z-50 flex w-[360px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between bg-brand-600 px-4 py-3 text-white">
            <p className="font-display text-base font-bold">PetDocs help</p>
            <button
              type="button"
              aria-label="Close help"
              onClick={() => setOpen(false)}
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl hover:bg-white/10"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div
            role="log"
            aria-live="polite"
            className="flex max-h-[320px] min-h-[240px] flex-col gap-3 overflow-y-auto px-4 py-4"
          >
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-3 py-2 text-sm text-white">
                    {m.text}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"
                  >
                    <PawPrint size={16} aria-hidden="true" />
                  </span>
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-cream-dark px-3 py-2 text-sm text-ink">
                    <p className="font-semibold">{m.answer ? m.answer.title : "Helper"}</p>
                    <p className="mt-1">{m.text}</p>
                    {m.answer ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.answer.links.map((link) => (
                          <a
                            key={link.href + link.label}
                            href={link.href}
                            className="rounded-xl border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ),
            )}
            {typing ? (
              <div className="flex items-start gap-2" aria-label="Helper is typing">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"
                >
                  <PawPrint size={16} aria-hidden="true" />
                </span>
                <span className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-cream-dark px-3 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-soft" />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-soft"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-soft"
                    style={{ animationDelay: "300ms" }}
                  />
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-ink/10 px-4 pt-3">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => send(chip.query)}
                className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-dark"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <form
            className="flex items-center gap-2 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <label htmlFor="petdocs-help-input" className="sr-only">
              Ask a question
            </label>
            <input
              id="petdocs-help-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about pricing, sharing..."
              autoComplete="off"
              className="h-12 min-h-[48px] flex-1 rounded-xl border border-ink/15 px-3 text-sm focus-visible:outline-2 focus-visible:outline-brand-600"
            />
            <button
              type="submit"
              aria-label="Send"
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl bg-brand-600 px-3 text-white hover:bg-brand-700"
            >
              <Send size={18} aria-hidden="true" />
            </button>
          </form>

          <p className="border-t border-ink/10 px-4 py-2 text-center text-xs text-ink-soft">
            Still stuck?{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-semibold text-brand-700 underline"
            >
              Email us
            </a>
          </p>
        </div>
      ) : null}
    </>
  );
}

export default HelpWidget;
