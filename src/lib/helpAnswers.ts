import { ROUTES } from "./routes";

export interface HelpAnswer {
  id: string;
  keywords: string[];
  title: string;
  body: string;
  links: { label: string; href: string }[];
  chips?: string[];
}

export const ANSWERS: HelpAnswer[] = [
  {
    id: "price",
    keywords: [
      "price",
      "pricing",
      "cost",
      "plan",
      "free",
      "plus",
      "family",
      "much",
      "pay",
      "subscription",
      "tier",
    ],
    title: "Plans and pricing",
    body: "PetDocs has Free, Plus, and Family plans. See the pricing page for current limits and details.",
    links: [
      { label: "See pricing", href: ROUTES.pricing },
      { label: "How it works", href: ROUTES.howItWorks },
    ],
    chips: ["Is there a free plan?", "Can I cancel anytime?", "How do I share with my landlord?"],
  },
  {
    id: "apartment",
    keywords: ["apartment", "rental", "rent", "landlord", "lease", "housing", "move"],
    title: "Renting with pets",
    body: "Share a read only passport link with your landlord to prove vaccines and records. You control the link and can revoke it anytime.",
    links: [
      { label: "Share a passport", href: ROUTES.dashboard.share },
      { label: "How it works", href: ROUTES.howItWorks },
    ],
    chips: ["How do I share a passport?", "What does the landlord see?", "How much does it cost?"],
  },
  {
    id: "vet",
    keywords: [
      "vet",
      "record",
      "transfer",
      "history",
      "upload",
      "document",
      "veterinarian",
      "clinic",
    ],
    title: "Vet records and transfers",
    body: "Upload vet PDFs and photos under Docs for each pet. Bring the passport link to a new clinic to transfer history fast.",
    links: [
      { label: "Open Docs", href: ROUTES.dashboard.docs },
      { label: "Open Pets", href: ROUTES.dashboard.pets },
    ],
    chips: ["How do I upload a document?", "How do I share with a new vet?", "When is the next vaccine due?"],
  },
  {
    id: "share",
    keywords: ["share", "passport", "qr", "link", "sitter", "public"],
    title: "Sharing and passport QR",
    body: "Create a share link from the Share tab to give read only access. Anyone with the link sees the live passport with QR.",
    links: [
      { label: "Open Share", href: ROUTES.dashboard.share },
      { label: "How it works", href: ROUTES.howItWorks },
    ],
    chips: ["Can I revoke a link?", "What does the landlord see?", "How do I sign in?"],
  },
  {
    id: "reminders",
    keywords: [
      "remind",
      "vaccine",
      "vaccination",
      "due",
      "shot",
      "booster",
      "schedule",
      "appointment",
      "alert",
    ],
    title: "Vaccine reminders",
    body: "Add due dates under Reminders to get nudges before vaccines expire. Keep each pet profile current so alerts stay accurate.",
    links: [
      { label: "Open Reminders", href: ROUTES.dashboard.reminders },
      { label: "Open Pets", href: ROUTES.dashboard.pets },
    ],
    chips: ["When is the next vaccine due?", "How do I upload a document?", "How do I share a passport?"],
  },
  {
    id: "insurance",
    keywords: ["insurance", "insure", "claim", "coverage", "policy", "provider"],
    title: "Pet insurance claims",
    body: "Download or share records from Docs when filing a claim. Most insurers accept vet PDFs and vaccine history.",
    links: [
      { label: "Open Docs", href: ROUTES.dashboard.docs },
      { label: "Open Share", href: ROUTES.dashboard.share },
    ],
    chips: ["How do I upload a document?", "How do I share a passport?", "When is the next vaccine due?"],
  },
  {
    id: "travel",
    keywords: ["travel", "flight", "fly", "airline", "trip", "abroad", "certificate", "hotel"],
    title: "Travel and flights",
    body: "Many airlines and hotels ask for vaccine proof. Share the passport link or show Docs at check in.",
    links: [
      { label: "Open Share", href: ROUTES.dashboard.share },
      { label: "Open Docs", href: ROUTES.dashboard.docs },
    ],
    chips: ["How do I share a passport?", "When is the next vaccine due?", "How do I file a claim?"],
  },
  {
    id: "groomer",
    keywords: ["groom", "board", "sitter", "daycare", "kennel", "trainer"],
    title: "Groomers and boarding",
    body: "Share the passport link so groomers and boarders see vaccines and notes. Revoke the link after the stay if you like.",
    links: [
      { label: "Open Share", href: ROUTES.dashboard.share },
      { label: "Open Pets", href: ROUTES.dashboard.pets },
    ],
    chips: ["How do I share a passport?", "When is the next vaccine due?", "How much does it cost?"],
  },
  {
    id: "cancel",
    keywords: ["cancel", "refund", "money back", "stop subscription", "delete", "close account"],
    title: "Cancel and refunds",
    body: "You can cancel from Settings in a few clicks. Refund rules are listed on the refunds page.",
    links: [
      { label: "Refund policy", href: ROUTES.legal.refunds },
      { label: "Open Settings", href: ROUTES.dashboard.settings },
    ],
    chips: ["How much does it cost?", "How do I contact support?", "How do I sign in?"],
  },
  {
    id: "signin",
    keywords: [
      "sign in",
      "signin",
      "sign-in",
      "log in",
      "login",
      "magic link",
      "magic",
      "password",
      "one-time code",
      "onboarding",
      "access",
    ],
    title: "Sign in with magic link",
    body: "Enter your email on the sign in page and we send a one time link. Click it on the same device to finish signing in.",
    links: [
      { label: "Go to sign in", href: ROUTES.signIn },
      { label: "Get started", href: ROUTES.onboarding },
    ],
    chips: ["Is my data private?", "How much does it cost?", "How do I contact support?"],
  },
  {
    id: "security",
    keywords: ["secur", "privacy", "private", "safe", "protect", "data", "encrypt", "terms"],
    title: "Security and privacy",
    body: "Your data stays private and share links are read only. Read the privacy and terms pages for details.",
    links: [
      { label: "Privacy policy", href: ROUTES.legal.privacy },
      { label: "Terms of service", href: ROUTES.legal.terms },
    ],
    chips: ["How do I share a passport?", "How do I sign in?", "How do I contact support?"],
  },
  {
    id: "contact",
    keywords: ["contact", "human", "support", "email", "talk", "person", "phone"],
    title: "Contact a human",
    body: "We are happy to help by email. Write to support@petdocs.app and we reply within one business day.",
    links: [
      { label: "Get started", href: ROUTES.onboarding },
      { label: "Back to home", href: ROUTES.home },
    ],
    chips: ["How much does it cost?", "How do I sign in?", "How do I share a passport?"],
  },
];

const FALLBACK_ID = "contact";

function getFallback(): HelpAnswer {
  return ANSWERS.find((a) => a.id === FALLBACK_ID) ?? ANSWERS[ANSWERS.length - 1];
}

export function matchHelpAnswer(input: string): HelpAnswer {
  const fallback = getFallback();
  if (!input || !input.trim()) return fallback;
  const lower = input.toLowerCase();
  let best: HelpAnswer = fallback;
  let bestScore = 0;
  for (const answer of ANSWERS) {
    let score = 0;
    for (const keyword of answer.keywords) {
      if (keyword && lower.includes(keyword.toLowerCase())) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = answer;
    }
  }
  return bestScore === 0 ? fallback : best;
}
