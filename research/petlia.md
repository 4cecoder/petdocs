# Competitor study: Petlia (petlia.app)

Studied 2026-09-15 via live session (authenticated as itsmedjt account). Status: **pre-launch / waitlist stage**.

## Positioning
- Tagline: "The Health Passport for the Modern Pet Parent"
- Hero: "Your pet's health records, ready when it matters most." / "From a pile of paperwork to instant answers"
- Emergency-first framing: closing CTA "The next emergency won't wait. Neither should your pet's health records."
- Social proof: "Join 1,240 pet parents already on the waitlist" — waitlist, not live customers
- Footer: "By Pet Parents, For Pet Parents" — consumer-trust voice, no vet/clinic positioning

## Product surface (verified in-app, account with 1 pet)
- Nav: Home · Records · Reminders · Profile
- Dashboard: family view ("itsmedjt Family"), pet cards (name, breed: "Test" / French Bulldog), +Add a pet
- Records: per-pet **file uploads only** ("Upload record", "0 files", "No records yet") — no structured vault, no document types, no verification
- Reminders: single upcoming-events list ("vaccinations, medications, or appointments are due") — currently empty-state only
- **/profile is a 404** — nav link is broken in production
- Welcome flow: onboarding + "Stay in the loop" waitlist prompt

## Tech / auth
- Built on Lovable; auth is **Google OAuth only** (oauth.lovable.app callback) — no email signup, no magic link
- Behind Cloudflare; marketing lander separate from app shell (SPA)
- No API, no vet access, no sharing/sharing-links anywhere in the UI

## Marketing pages
- /about, /contact, /privacy, /terms; FAQ covers: security, cost, vet acceptance, "why not Google Drive/Notes", dogs-only?, mobile app?, team
- FAQ signals roadmap anxieties (vet acceptance + mobile app questions) — both unanswered by the product today

## Gap analysis — where petdocs wins today
| Dimension | Petlia (pre-launch) | petdocs (live on main) |
|---|---|---|
| Auth | Google-only via Lovable | Magic-link email (any inbox), works without Google |
| Records | Raw file uploads | Structured vault: vaccinations, medications, vet visits, documents w/ Convex storage |
| Sharing | None | Public passport links (/p/[shareToken]) |
| Vets / staff | None | Staff RBAC + company mail inbox already scaffolded |
| Reminders | Empty-state promise | reminders.ts + crons + Resend email delivery |
| Inbound | None | /resend/inbound webhook (mail ingestion) |
| Multi-actor | Single owner | Family/staff roles, transfers (by_code) |

## Watch-outs
- Their emergency-first copy and "instant answers" framing are strong — worth testing in our lander copy
- 1,240-strong waitlist means demand exists for the category
- If they add vet verification first, that's their moat attempt — our staff/RBAC + enterprise API direction counters it
