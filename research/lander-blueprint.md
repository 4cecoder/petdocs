# Lander blueprint: from petlia.app teardown to a neater petdocs lander

Researched 2026-09-15 via live scrape of [petlia.app](https://petlia.app) (full-page capture) plus prior authenticated audits ([research/petlia.md](petlia.md), [research/petlita-lovable.md](petlita-lovable.md)). Companion to [research/compliance.md](compliance.md) — all lander copy below is pre-vetted against the "what NOT to claim" list there.

---

## Part 1 — Petlia lander teardown, section by section

Petlia's lander has grown since our last capture (2026-09-15, in-app audit): it now adds an AI "Ask Petlia" narrative, an email-the-vet PDF demo, a Pet Diary, a founder story, and an accelerator "Backed By" band. What follows is the live section order.

### S1. Hero
**Live copy:** badge chip "Rabies Vaccine — Up to date" floating over a pets illustration; H1 *"Your pet's health records, ready when it matters most."*; sub *"Everything your pet needs — vaccines, vet visits, and medical history — all in one secure, easy-to-access place."*; CTAs "Get Started Free" → `/auth` and "See How It Works" → `#how-it-works`; micro-trust row "First 50 pet parents get Petlia free for life · No credit card · Works on any device"; privacy strip "🔒 Private by default · Your data is never sold · You control what's shared" ([petlia.app](https://petlia.app)).

**What works:**
- The H1 is outcome-shaped and urgency-adjacent ("ready when it matters most") — same emergency-first gene as their closing CTA, consistent brand voice ([petlia.app](https://petlia.app); see also [petlia.md](petlia.md) watch-outs).
- The hero *product mockup is a status chip*, not a screenshot — shows the value ("rabies: up to date") instead of the UI. Smart abstraction.
- Triple-stacked objection handling (free-for-life / no card / any device) directly under CTAs.

**What feels cheap:**
- "First 50 pet parents get Petlia free for life" — still live while the waitlist counter says **1,240** ([petlia.app](https://petlia.app); [petlia.md](petlia.md)). A scarcity hook that's already 25× oversubscribed reads as fake and poisons every other claim on the page (FTC substantiation instincts apply to marketing claims broadly — see [compliance.md §5.3](compliance.md#53-ftc-health-adjacent-claims)).
- Privacy strip is text-only with a padlock emoji; no link to an actual security page. Assertion without evidence.
- Same illustration asset repeated twice in the hero (top and bottom of section) per the scrape ([petlia.app](https://petlia.app)).

### S2. "How it works" — 4 steps
**Live copy:** *"From a pile of paperwork to instant answers"* + 4 steps: Upload → **Auto-fill** ("Petlia reads each doc and fills in your pet's profile") → **Ask Petlia** (instant answers about history) → **Share** ("Send a vet-ready PDF to your provider in seconds"). Accompanied by a fake in-app storyboard: empty pet profiles (Luna 0/3, Milo 0/3, Kiwi 0/3), floating doc chips, and two scripted chat bubbles ("When is Luna's rabies vaccine due?", "Email Luna's records to Dr. Patel" → "Generating Luna's health PDF" → "Sending to drpatel@vetclinic.com" → "Awaiting confirmation") ([petlia.app](https://petlia.app)).

**What works:**
- "From a pile of paperwork to instant answers" is the best line on their page — transformation framing, not feature framing.
- The storyboard shows *state change* (0/3 records filling up), which sells progress.

**What feels cheap:**
- Steps 2–3 describe capabilities our authenticated session proved **do not exist**: records are raw uploads with no auto-fill, and there was no AI or PDF-email anywhere in-app ([petlia.md](petlia.md) — "no structured vault, no document types, no verification"; [petlita-lovable.md §3](petlita-lovable.md)). Marketing ahead of product is a churn (and claim-substantiation) landmine.
- "Awaiting confirmation" as a visible state in the hero demo — showing an unresolved async state is demosplaining, not selling.
- Fictional recipient "drpatel@vetclinic.com" implies vet-side email integration that has no UI ([petlia.md](petlia.md): "No API, no vet access, no sharing links anywhere in the UI").

### S3. Features grid — "Everyone caring for your pet, always on the same page"
Six cards: Health Records, Instant Sharing, Smart Reminders, Multiple Pets, Made for Every Moment (Emergency · Travel · Boarding), Pet Diary ([petlia.app](https://petlia.app)).

**What works:**
- Section headline names the *audience* ("everyone caring for your pet") — sitters/boarders/family are explicitly in scope. Good widening of the buyer.
- "Made for Every Moment" bundles three concrete jobs-to-be-done (emergency, travel, boarding) instead of abstract benefits.

**What feels cheap:**
- Six feature cards of ~1 sentence each with no visuals, no product proof, no differentiation — this is the "checklist parity" section every competitor ships; nothing is falsifiable or specific (no mention of expiry dates, revocation, who can see what).
- "Smart Reminders … timely alerts" — the in-app reminders page is an empty state ([petlia.md](petlia.md)); same over-claim pattern as S2.

### S4. Testimonials — "What pet parents are saying"
Three quotes (Sarah Chen/Luna the Golden, Marcus Johnson/Whiskers the cat, Emma Rodriguez/Kiwi the parrot), each with 5 star emojis, initial-avatar, pet name+breed ([petlia.app](https://petlia.app)).

**What works:**
- Species spread (dog/cat/**parrot**) quietly answers their own FAQ "is this dogs-only?" ([petlita-lovable.md §1](petlita-lovable.md) — rabbits/parrots positioning).
- Quotes map to the three feature pillars: records access, meds organization, sitter sharing.

**What feels cheap:**
- All three testimonials on a **waitlist-stage product** are self-evidently invented — no faces, no last-initial-only, star emojis instead of a rating badge. Fake social proof before launch is the single worst trust signal a records product can send (we're selling *integrity*).
- Star emojis are unstructured text; they render inconsistently and read as decoration, not rating.

### S5. Waitlist band
"Join 1,240 pet parents already on the waitlist" — text band mid-page, no input field visible in the scrape ([petlia.app](https://petlia.app); count unchanged since [petlia.md](petlia.md)).

**What works:** a concrete number beats "hundreds of users."

**What feels cheap:** it's a dead-end statement mid-scroll (CTA is elsewhere); no embedded form, no reciprocity.

### S6. Brand story — "The Gap We Saw" / "The Pet Parent Edge" / "Three Core Commitments"
Manifesto: filing cabinet vs. assistant; sovereignty/accuracy/accessibility commitments; "Whether you're at a local clinic in Columbia or an emergency vet across the country" ([petlia.app](https://petlia.app)).

**What works:** "Sovereignty / Accuracy / Accessibility" is a genuinely good commitment triad for this category, and "filing cabinet vs. assistant" is a memorable category frame.

**What feels cheap:** "clinic in Columbia" (SC) is a oddly local example for a global-feeling product; commitments are unlinked to any mechanism (no policy link, no versioning, no roadmap).

### S7. "Backed By" band
Founder-grad-of "Launchpad Columbia" + Boyd Innovation Center logos, *"Built in Columbia, backed by the best."* ([petlia.app](https://petlia.app); the Boyd link: [boydinnovation.org](https://www.boydinnovation.org/blog/meet-launchpad-cola-spring-2026)).

**What works:** third-party institutional logos are real proof for a pre-launch startup; this is new since our last capture and it's their strongest trust addition.

**What feels cheap:** accelerator backing ≠ product security for a records vault — the band answers the wrong anxiety (who backs you vs. who can read my data).

### S8. Founder note
Photo of founder Angela Fang holding her cat; *"We built what we wished existed."* + panic-story quote ([petlia.app](https://petlia.app)).

**What works:** founder photo + specific scenario ("emergency, a cross-country move, or a new vet") humanizes the brand; the pet-in-photo detail is on-brand.

**What feels cheap:** quote restates the hero promise rather than adding new information.

### S9. FAQ — "Common Questions"
Seven collapsed items: security, cost, vet acceptance, "why not Google Drive/Notes," dogs-only, mobile app, team ([petlia.app](https://petlia.app)).

**What works:** "Why not just use Google Drive or my Notes app?" is the correct category-objection question to answer head-on ([petlita-lovable.md §1](petlita-lovable.md)).

**What feels cheap:** "Will vets accept it?" is on the page **unanswered by the product** (no vet surface at all — [petlia.md](petlia.md)); a FAQ that surfaces your roadmap gap invites doubt.

### S10. Closing CTA
*"The next emergency won't wait. Neither should your pet's health records."* + "Sign up free, it takes 10 seconds." + Sign Up button ([petlia.app](https://petlia.app)).

**What works:** best emotional close in the category; time-boxed ("10 seconds") reduces commitment friction.

**What feels cheap:** "10 seconds" overpromises for a product whose signup is Google-OAuth-gated (fast, but account + onboarding is longer).

### Teardown verdict
Petlia's lander is emotionally strong and structurally complete (hero → how → features → proof → story → backer → founder → FAQ → close). Its systematic weaknesses are: **(1) claims outrun a waitlist-stage product** (AI, sharing, reminders, vet-ready PDFs are marketed but unbuilt — [petlia.md](petlia.md)), **(2) invented testimonials**, **(3) assertions without evidence** (security text with no link, scarcity math that doesn't add up). Every one of these is a **petdocs opening**: we can be the lander that only claims what's live, proves each feature with real UI, and links every trust assertion to a real policy page ([compliance.md §8](compliance.md#8-compliance-checklist-what-petdocs-must-do-for-clinic-adoption) disclaimers).

---

## Part 2 — petdocs lander blueprint

### Positioning (from our actual strengths)
From the live product (main): magic-link auth for any inbox ([petlia.md gap table](petlia.md)), structured typed vault (vaccine/lab/prescription/insurance/microchip/travel — [petlita-lovable.md §4](petlita-lovable.md)), shareable expiring/revocable passports at `/p/[shareToken]`, reminders with real Resend delivery + crons ([petlia.md](petlia.md)), staff RBAC already scaffolded, Android app in repo. Tagline direction:

> **"Your pet's documents, organized, verified-by-source, and shareable in seconds."**
> Hero H1 candidate: **"Every vet doc. One vault. Shared in one tap."**
> Sub: "petdocs turns scattered vaccine certificates, lab results, and prescriptions into a structured vault — and a shareable pet passport your vet, boarder, or sitter can open in under 30 seconds. No app for them to install."

Copy angles by pillar (each maps to a live feature, satisfying our no-unbuilt-claims rule):
1. **Vault** — "Not a pile of PDFs: typed records with due dates." (structured doc types, timeline)
2. **Passport/Sharing** — "One link. Read-only. Expires and revokes when you say so." (shareToken design)
3. **Vets** — "No login wall at the clinic: the passport opens for anyone with the link." (30-second proof framing)
4. **Reminders** — "Rabies booster due? We email you before it lapses." (real cron+Resend delivery)
5. **Trust/privacy** — "Your data is never sold. Links expire. You hold the keys." + link to `/legal/privacy` ([compliance.md §5](compliance.md#5-privacy-landscape-for-pet-data)).

### Proposed section order (single-scroll lander, `/`)

| # | Section | Job | Copy angle |
|---|---|---|---|
| 1 | **Hero** | Outcome + proof-in-hero | H1 above; sub covers vault+passport+30s; primary CTA "Start free" → onboarding, secondary "See how it works" → `/how-it-works`; trust strip: "No passwords — magic-link email · Never sold data · Cancel anytime", each linking to real pages |
| 2 | **Hero mockup** | Show the real passport | A passport card mock (pet chip, "Rabies — valid thru 2027", QR) — like Petlia's status chip, but ours is the *actual* share UI, so the claim is literally true |
| 3 | **Social proof strip** | Early but honest | Skip fake counters; use "Built by pet parents in [city]. Launching with a veterinary pilot program." → mailto/waitlist link. Honesty is the differentiation ([teardown S4](#s4-testimonials--what-pet-parents-are-saying)) |
| 4 | **How it works (3 steps)** | Same as existing page | Keep our existing 3 steps (add pet / snap docs / share passport) from the current home page — they're already accurate ([`src/app/(marketing)/page.tsx`](../src/app/(marketing)/page.tsx)) |
| 5 | **Feature grid (4, not 6)** | Depth over parity | Structured vault · Passport links (expiry+revoke shown) · Reminders (real email proof) · Family/staff roles. Each card: one screenshot-grade detail that Petlia can't claim ([petlia.md](petlia.md)) |
| 6 | **"30 seconds at the clinic" moment band** | Emergency emotion, borrowed and improved | Their close is our mid-page proof moment: QR-at-desk scenario, 3-beat story. Better placed mid-page where it converts skeptics |
| 7 | **For vets strip** | Two-sided tease | "Clinics: get records that arrive organized." → `/how-it-works#vets` anchor + pilot email. Commitment-safe wording per [compliance.md §8](compliance.md#8-compliance-checklist-what-petdocs-must-do-for-clinic-adoption): "petdocs complements your practice records — it does not replace your medical records of care" |
| 8 | **FAQ (6 Qs)** | Kill category objections | security · why-not-Google-Drive · will-vets-accept · what-platforms (Android today, iOS soon) · privacy/data-never-sold → link · pricing. Answer "will vets accept" with the *owner-side* truth: any vet can open the link, no adoption needed |
| 9 | **Pricing teaser** | Already live | Three-tier cards exist on `/pricing`; mirror Free tier + link |
| 10 | **Closing CTA** | Borrow the best line, make it ours | "The next emergency won't wait. Your pet's documents should be ready." + "Start free — no password, no credit card." |

### Component mapping (existing `src/app/(marketing)/` + `src/components/`)

| Section | Existing asset | Reuse strategy |
|---|---|---|
| 1–2 Hero + mockup | [`(marketing)/page.tsx`](../src/app/(marketing)/page.tsx) hero (PawPrint + copy + CTAs) | Extend existing hero block; add a passport-card mock component (new, ~100 lines, static data, no client JS) |
| 4 How it works | [`(marketing)/how-it-works/page.tsx`](../src/app/(marketing)/how-it-works/page.tsx) step list | Reuse step data verbatim on home; keep `/how-it-works` as deep-link target |
| 5 Feature grid | Tailwind card pattern already used on home steps + pricing | Same card primitive, `md:grid-cols-2` (4 cards) |
| 6 Moment band | — | New section; reuse `art/PetArt.tsx` illustration tokens |
| 7 For vets | Footer/Header exist; [`(marketing)/layout.tsx`](../src/app/(marketing)/layout.tsx) | New thin band; anchor target for future `/how-it-works#vets` |
| 8 FAQ | none yet | New `<details>`-based accordion (native, no JS, accessible) |
| 9 Pricing teaser | [`(marketing)/pricing/page.tsx`](../src/app/(marketing)/pricing/page.tsx) tier array | Extract tier data to a shared module OR duplicate the 3-line Free card (simpler for one sprint) |
| 10 Closing CTA | home CTA block | Restyle existing CTA row |
| Shell | [`components/Header.tsx`](../src/components/Header.tsx), [`components/Footer.tsx`](../src/components/Footer.tsx) | Unchanged |

### Gaps to build (all small, no backend work)
1. `PassportPreviewCard` — static mock of the real `/p/[shareToken]` card (pet name, rabies status, QR placeholder, expiry date) for hero. *The one new visual.* 
2. `FaqAccordion` — native `<details>/<summary>` list, 6 items, ~40 lines.
3. `VetsBand` — 2-sentence strip + mailto link + compliance-safe disclaimer line.
4. `SocialProofStrip` — honest pre-launch line instead of counters.
5. Copy pass integrating the trust strip + not-to-claim language review ([compliance.md §8](compliance.md#8-compliance-checklist-what-petdocs-must-do-for-clinic-adoption)).

### Sprint plan (one frontend dev)
- **D1–2:** Extract shared marketing card/section primitives; build hero + PassportPreviewCard.
- **D3:** How-it-works reuse + feature grid (4 cards).
- **D4:** Moment band + VetsBand + SocialProofStrip.
- **D5:** FAQ + pricing teaser + closing CTA; wire ROUTES (typed routes only — never hardcode route strings; leak tests guard this per AGENTS.md).
- **D6:** Copy compliance pass, `bun run typecheck && bun run lint`, responsive QA at 375px/768px/1440px, accessibility pass (focus rings, aria on accordion).

Explicitly **out of scope** for the sprint: testimonials (until real users exist), waitlist counter, AI/auto-fill claims, vet-portal screenshots, .ics export.
