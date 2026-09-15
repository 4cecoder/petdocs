"use client";

import { useState, type FormEvent } from "react";
import { Check, Send } from "lucide-react";
import { ConvexHttpError, api } from "@/lib/api";
import { PetArt } from "@/components/art/PetArt";

type Status = "idle" | "submitting" | "success" | "error";

const MESSAGE_MAX = 5000;

/**
 * Public contact form (no auth — marketing surface). Talks to the backend
 * via the shared HTTP wrapper, so it works on pages without a Convex
 * react provider. Success/failure states are human and honest: the honest
 * failure copy offers a direct email fallback instead of promising a send
 * that did not happen.
 */
export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot: never shown
  const [status, setStatus] = useState<Status>("idle");
  const [errorCopy, setErrorCopy] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorCopy(null);
    try {
      const result = await api.contact.submit({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        ...(website ? { website } : {}),
      });
      if (result.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorCopy(
          "You've sent a few messages already today. Please try again tomorrow.",
        );
      }
    } catch (err) {
      setStatus("error");
      if (err instanceof ConvexHttpError) {
        setErrorCopy(
          "We couldn't send your message just now, our service seems briefly unavailable. Please try again in a few minutes.",
        );
      } else if (err instanceof Error && err.message.includes("valid email")) {
        setErrorCopy("Please enter a valid email address.");
      } else {
        setErrorCopy(
          "Something went wrong sending your message. Please try again, or email hello@seridian.dev if it keeps failing.",
        );
      }
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-4 rounded-2xl border border-brand-200 bg-brand-50/60 p-8 text-center"
      >
        <PetArt name="mail" size={120} />
        <p className="flex items-center gap-2 font-display text-xl font-bold text-ink">
          <Check size={20} aria-hidden="true" className="text-brand-600" />
          Message sent!
        </p>
        <p className="max-w-sm text-sm text-ink-soft">
          Thanks for reaching out — we&apos;ve got your note and will reply to{" "}
          <span className="font-medium text-ink">{email.trim()}</span> as soon
          as we can.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Honeypot: hidden from humans, irresistible to bots. */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 font-medium">
        Your name
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={100}
          disabled={status === "submitting"}
          className="min-h-[48px] rounded-xl border border-ink/15 bg-white px-4 disabled:opacity-60"
        />
      </label>

      <label className="flex flex-col gap-1 font-medium">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={status === "submitting"}
          className="min-h-[48px] rounded-xl border border-ink/15 bg-white px-4 disabled:opacity-60"
        />
      </label>

      <label className="flex flex-col gap-1 font-medium">
        Message
        <textarea
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MESSAGE_MAX}
          disabled={status === "submitting"}
          className="rounded-xl border border-ink/15 bg-white px-4 py-3 disabled:opacity-60"
        />
        <span className="text-xs font-normal text-ink-soft">
          {message.length}/{MESSAGE_MAX}
        </span>
      </label>

      {errorCopy && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {errorCopy}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
      >
        {status === "submitting" ? (
          "Sending…"
        ) : (
          <>
            <Send size={16} aria-hidden="true" /> Send message
          </>
        )}
      </button>
    </form>
  );
}
