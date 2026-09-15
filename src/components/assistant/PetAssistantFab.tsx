"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Folder,
  PawPrint,
  Send,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface AssistantMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  quickLinks?: Array<{ label: string; href: string }>;
  checklist?: string[];
}

const COMMON_QUESTIONS = [
  {
    id: "vax",
    question: "What vaccines does my pet need?",
    answer:
      "Core vaccines are essential for all pets. For dogs: Rabies (annual or 3-yr) and DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza). For cats: Rabies and FVRCP (Rhinotracheitis, Calicivirus, Panleukopenia). Non-core vaccines depend on lifestyle (Bordetella for kennels, Leptospirosis, Lyme, or FeLV).",
    quickLinks: [
      { label: "View Pet Vaccines", href: ROUTES.dashboard.pets },
      { label: "Check Reminders", href: ROUTES.dashboard.reminders },
    ],
  },
  {
    id: "export",
    question: "How to export records?",
    answer:
      "You can export or share your pet's complete medical history in seconds using PetDocs Passports. Go to the Share tab to generate a secure, cryptographic share link or QR code with expiration and view limits, perfect for emergency clinics, boarding, or landlords.",
    quickLinks: [
      { label: "Generate Share Link", href: ROUTES.dashboard.share },
      { label: "Open Vault", href: ROUTES.dashboard.docs },
    ],
  },
  {
    id: "emergency",
    question: "Emergency clinic checklist",
    answer:
      "If heading to an emergency vet, have these ready immediately. You can pull all of these up on PetDocs from your phone:",
    checklist: [
      "Pet Microchip ID & registration number",
      "Rabies certificate & current vaccine status",
      "Active medications & recent dosage times",
      "Known allergies or preexisting conditions",
      "Toxin info (if ingested, bring package/photo)",
      "ASPCA Animal Poison Control: (888) 426-4435",
    ],
    quickLinks: [
      { label: "Quick Emergency Passport", href: ROUTES.dashboard.share },
    ],
  },
  {
    id: "preventive",
    question: "Annual wellness & preventive care",
    answer:
      "Veterinarians recommend an annual physical exam for adult pets (twice a year for seniors 7+). Core preventive care includes annual bloodwork, heartworm antigen test, fecal exam, dental assessment, and year-round parasite prevention.",
    quickLinks: [
      { label: "Add Checkup Reminder", href: ROUTES.dashboard.reminders },
    ],
  },
];

export function PetAssistantFab() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "intro",
      sender: "bot",
      text: "Hi there! I'm Pawla, your PetDocs Health Assistant. Ask me about vaccine protocols, travel passports, emergency prep, or preventive care.",
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function handleSelectQuestion(q: (typeof COMMON_QUESTIONS)[number]) {
    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: q.question,
    };
    const botMsg: AssistantMessage = {
      id: `bot-${Date.now() + 1}`,
      sender: "bot",
      text: q.answer,
      quickLinks: q.quickLinks,
      checklist: q.checklist,
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
  }

  function handleSendText(textToSend?: string) {
    const query = (textToSend ?? inputQuery).trim();
    if (!query) return;

    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
    };

    const lower = query.toLowerCase();
    let botResponse: AssistantMessage;

    if (lower.includes("vaccin") || lower.includes("shot") || lower.includes("rabies") || lower.includes("dhpp")) {
      const q = COMMON_QUESTIONS[0];
      botResponse = {
        id: `bot-${Date.now() + 1}`,
        sender: "bot",
        text: q.answer,
        quickLinks: q.quickLinks,
      };
    } else if (lower.includes("export") || lower.includes("share") || lower.includes("pdf") || lower.includes("qr") || lower.includes("download")) {
      const q = COMMON_QUESTIONS[1];
      botResponse = {
        id: `bot-${Date.now() + 1}`,
        sender: "bot",
        text: q.answer,
        quickLinks: q.quickLinks,
      };
    } else if (lower.includes("emerg") || lower.includes("urgent") || lower.includes("poison") || lower.includes("toxic") || lower.includes("hospital")) {
      const q = COMMON_QUESTIONS[2];
      botResponse = {
        id: `bot-${Date.now() + 1}`,
        sender: "bot",
        text: q.answer,
        checklist: q.checklist,
        quickLinks: q.quickLinks,
      };
    } else if (lower.includes("checkup") || lower.includes("wellness") || lower.includes("dental") || lower.includes("flea") || lower.includes("heartworm")) {
      const q = COMMON_QUESTIONS[3];
      botResponse = {
        id: `bot-${Date.now() + 1}`,
        sender: "bot",
        text: q.answer,
        quickLinks: q.quickLinks,
      };
    } else {
      botResponse = {
        id: `bot-${Date.now() + 1}`,
        sender: "bot",
        text: `Thanks for asking about "${query}". For specific medical conditions or emergencies, always consult your licensed veterinarian. You can log symptoms in Vet Visits or create a reminder so you don't miss upcoming medication or follow-ups.`,
        quickLinks: [
          { label: "Open Reminders", href: ROUTES.dashboard.reminders },
          { label: "My Pets", href: ROUTES.dashboard.pets },
        ],
      };
    }

    setMessages((prev) => [...prev, userMsg, botResponse]);
    setInputQuery("");
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        aria-label="Open pet health assistant"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 md:bottom-8 right-6 z-40 rounded-full bg-brand-600 text-white p-3.5 shadow-lg hover:bg-brand-700 transition-all hover:scale-105 flex items-center justify-center group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <div className="relative">
          <PawPrint size={24} className="stroke-[2.2]" />
          <Sparkles
            size={12}
            className="absolute -top-1 -right-1 text-amber-300 animate-pulse"
          />
        </div>
      </button>

      {/* Slide-over Drawer & Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-ink/30 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="assistant-title"
              className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-ink/10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-ink/10 bg-cream/70">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-xs">
                    <PawPrint size={20} />
                  </div>
                  <div>
                    <h2 id="assistant-title" className="font-display font-bold text-base text-ink flex items-center gap-1.5">
                      Pawla <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 font-semibold">Pet Health Guide</span>
                    </h2>
                    <p className="text-xs text-ink-soft">Instant pet care tips & direct actions</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close assistant"
                  className="rounded-xl p-2 text-ink-soft hover:bg-ink/5 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Quick Action Shortcuts Bar */}
              <div className="px-4 py-3 bg-cream-dark/50 border-b border-ink/5">
                <p className="text-[11px] font-semibold text-ink-soft uppercase tracking-wider mb-2">
                  Quick Actions
                </p>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  <Link
                    href={ROUTES.dashboard.pets}
                    onClick={() => setIsOpen(false)}
                    className="flex flex-col items-center p-2 rounded-xl bg-white border border-ink/10 hover:border-brand-500 hover:shadow-xs transition"
                  >
                    <PawPrint size={16} className="text-brand-600 mb-1" />
                    <span className="text-[11px] font-medium text-ink truncate w-full">Pets</span>
                  </Link>
                  <Link
                    href={ROUTES.dashboard.docs}
                    onClick={() => setIsOpen(false)}
                    className="flex flex-col items-center p-2 rounded-xl bg-white border border-ink/10 hover:border-brand-500 hover:shadow-xs transition"
                  >
                    <Folder size={16} className="text-brand-600 mb-1" />
                    <span className="text-[11px] font-medium text-ink truncate w-full">Records</span>
                  </Link>
                  <Link
                    href={ROUTES.dashboard.reminders}
                    onClick={() => setIsOpen(false)}
                    className="flex flex-col items-center p-2 rounded-xl bg-white border border-ink/10 hover:border-brand-500 hover:shadow-xs transition"
                  >
                    <Bell size={16} className="text-brand-600 mb-1" />
                    <span className="text-[11px] font-medium text-ink truncate w-full">Reminders</span>
                  </Link>
                  <Link
                    href={ROUTES.dashboard.share}
                    onClick={() => setIsOpen(false)}
                    className="flex flex-col items-center p-2 rounded-xl bg-white border border-ink/10 hover:border-brand-500 hover:shadow-xs transition"
                  >
                    <Share2 size={16} className="text-brand-600 mb-1" />
                    <span className="text-[11px] font-medium text-ink truncate w-full">Passport</span>
                  </Link>
                </div>
              </div>

              {/* Chat Log Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[88%]",
                      msg.sender === "user" ? "ml-auto items-end" : "items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm",
                        msg.sender === "user"
                          ? "bg-brand-600 text-white rounded-br-xs"
                          : "bg-cream-dark text-ink rounded-bl-xs border border-ink/5",
                      )}
                    >
                      <p className="leading-relaxed">{msg.text}</p>

                      {msg.checklist && (
                        <ul className="mt-3 space-y-1.5 border-t border-ink/10 pt-2 text-xs">
                          {msg.checklist.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-ink">
                              <CheckCircle2 size={14} className="text-teal-600 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {msg.quickLinks && msg.quickLinks.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-ink/10">
                          {msg.quickLinks.map((link, idx) => (
                            <Link
                              key={idx}
                              href={link.href}
                              onClick={() => setIsOpen(false)}
                              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 border border-brand-200 hover:bg-brand-50 transition"
                            >
                              <span>{link.label}</span>
                              <span>→</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Common Care Questions Chips */}
              <div className="px-4 py-2 border-t border-ink/10 bg-cream/40">
                <p className="text-[11px] font-semibold text-ink-soft uppercase tracking-wider mb-2">
                  Common Questions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_QUESTIONS.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleSelectQuestion(q)}
                      className="text-left text-xs bg-white hover:bg-cream-dark border border-ink/10 rounded-xl px-3 py-1.5 text-ink transition hover:border-brand-400"
                    >
                      {q.question}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendText();
                }}
                className="p-3 border-t border-ink/10 bg-white flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask a pet health question..."
                  className="flex-1 rounded-xl border border-ink/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                <button
                  type="submit"
                  disabled={!inputQuery.trim()}
                  aria-label="Send query"
                  className="rounded-xl bg-brand-600 px-3.5 py-2.5 text-white disabled:opacity-40 hover:bg-brand-700 transition"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
