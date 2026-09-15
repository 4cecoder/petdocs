# Integration research: microchip registries + free-boost APIs

Researched 2026-09-15 for **#38**. Scope: what can petdocs integrate *today*, for free, that compounds growth. Every claim is source-linked. Verification level noted per provider: ✅ = read directly from provider docs/pages this session; ⚠ = secondary source only.

---

## 0. TL;DR — the verdict

| Question | Answer |
|---|---|
| Is Peeva's "Public API" self-serve? | **No.** It is registry-to-registry partnership outreach. No developer docs, no signup, no pricing, no published approval process. ✅ |
| Does ChipnDoodle have a real developer API? | **Yes.** Self-serve token, 3 endpoints, 100 searches/5 min, free (no pricing published anywhere). **But: ~0 major US registries in its network.** ✅ |
| Do US registries (PetLink, HomeAgain, AKC Reunite, Found Animals, 24Pet) expose APIs? | **No public APIs.** All do B2B/PIMS partner integrations only. ✅ |
| AAHA Universal Lookup API? | **No.** Web tool only; coalition explicitly encourages *linking* to it, not calling it. ✅ |
| Hidden gem found | **VetVerifi Partner API** — verified-vaccine verification API, free sandbox, REST + webhooks. Strategic fit with our "structured, verified vault" positioning. ⚠✅ |
| **Do first** | **ChipnDoodle chip-lookup** (free, self-serve, real API, onboarding + lost-pet hook) — sketch in §7. VetVerifi = fast-follow. Peeva = BD email, not engineering. |

---

## 1. Peeva (peeva.co) — microchip ↔ medical records pairing

**What they claim.** Peeva pairs "millions of pet microchip identification numbers with their corresponding medical records" via a permissions-based product (Peeva Fetch) that integrates with major PIMS. ✅ Source: <https://peeva.co/api-calls/>

**The "Public API" is not a developer API.** Their `/api-calls` page says they "extend the opportunity for other legitimate **registries** to establish live connections with our public API" — i.e., it is a registry↔registry data-sharing program, not an app-facing API. There are no developer docs, no key signup, no rate-limit table, no sandbox anywhere on the site. ✅ Source: <https://peeva.co/api-calls/>

**Access / approval.** No published process. The only doors in are business-development channels: <https://peeva.co/business-development/> ("Join our network of veterinary partners… microchips, equipment, and access to our centralized pet registry") and <https://peeva.co/peeva-for-veterinarians/>. Expect a partnership negotiation (data-sharing agreement), not an API key. ✅

**Pricing (consumer side, tells you their model).** $249 one-time lifetime or $54.95/year. ✅ Sources: <https://peeva.co/api-calls/>, <https://peeva.co/>

**Terms / limits that matter.**
- ToS (updated 2025-12-11): "Paid subscription is required for a pet's microchip to be registered, discoverable, and resolvable in the Peeva database." Lapsed subscription → chip is *deactivated and non-resolvable* (30-day grace). ✅ <https://peeva.co/terms-of-service/>
- Free tier is only the Lost & Found listing database — no chip registration, no records access. ✅ <https://peeva.co/terms-of-service/>
- NY governing law, binding arbitration, all payments final. ✅ <https://peeva.co/terms-of-service/>

**What data they'd expose (if a deal happened).** Paired microchip-ID ↔ medical record history for enrolled pets; resolution on scan for registered chips. Marketing on records aggregation: <https://peeva.co/api-calls/>; veterinary positioning: <https://peeva.co/peeva-for-veterinarians/> ⚠ (marketing claims, no data audit available).

**Partnership angle for petdocs.** Weak near-term. We are not a registry, and the public-API program is registry-only by their own wording. **Play:** send one BD email (they actively court pet-tech partnerships per LinkedIn positioning: "world's first centralized pet microchip registry and medical records database" — <https://www.linkedin.com/company/peeva> ⚠) and move on. Cost of asking: 20 minutes.

---

## 2. ChipnDoodle (chipndoodle.com) — Universal Microchip Search

**Status: the only real, self-serve, free microchip-search API found.** Docs: <https://chipndoodle.com/docs> ✅

**Access requirements.** Register a user → register an app (name/description/logo) → copy app token. Self-serve, no review gate documented. ✅ <https://chipndoodle.com/docs> · Auth methods: `?token=` query (GET), `token` body field (POST), or `chipndoodle-token` header. Token verification endpoint `GET /me`. ✅ <https://chipndoodle.com/docs/tokens>

**Cost.** No pricing page exists; docs mention no fees. Treat as "free today, no SLA, pricing can appear" — risk noted in §6.

### 2a. Pet Search API — `POST https://api.chipndoodle.com/searches` ✅ <https://chipndoodle.com/docs/searches>
- Input: `token` + `uid` (FDX-A 10-char or FDX-B 15-char chip number); optional `useragent`, `remoteip` (lets owners see roughly *where* a search came from).
- Behavior: server-side fan-out across all partner databases. **Latency 9–15 s** (their sample took 15.1 s). Design async.
- Rate limit: **100 searches / 5 minutes per app token**; Cloudflare + possible CAPTCHA on abuse.
- Response: `count` (providers queried, e.g. 48), `remote` (45), `found` (3), per-provider `responses[]` — each with registry name/slug, phone, email, website, plus whatever owner/pet fields that registry exposes (`name`, `email`, `tel`, `cel`, `dob`, `breed`, `species`, `flagged`, preview image).
- ⚠️ **Privacy note:** some providers leak owner contact fields through this API. petdocs must treat responses as PII (see §7 sketch).

### 2b. Providers API — `GET https://api.chipndoodle.com/providers` ✅ <https://chipndoodle.com/docs/providers>
- Filters: `continent` / `country` (ISO-2). Max 100 results. Returns registry directory (name, logo, contact, service area). Useful for a static "registries by country" content page with zero per-search calls.

### 2c. Animal Image API — `POST https://api.chipndoodle.com/uploads` ✅ <https://chipndoodle.com/docs/uploads>
- multipart image (≤40 MB, jpeg/jpg/png/gif) → animals detected with species (`dog`/`cat`/…), **top-5 breed predictions with probability (307 dog breeds, 88 cat breeds)**, sex, age in days, cropped images. A free fallback if breed-ID ever becomes a feature; overlapping scope with breed DBs in §4.

### 2d. Coverage — the dealbreaker to understand ✅ <https://chipndoodle.com/providers>
Provider list (~35 registries) is dominated by **UK (Petlog, PETtrac, Identibase, SmartTrace, AnimalTracker, Chipworks…), South Africa (Identipet, GetMeHome, Five Star ID, Backhome, KUSA…), Australia (Australasian Animal Registry, Central Animal Records, Global Micro, HomeSafeID, Petsafe) and EU**. **None of the major US registries — PetLink, HomeAgain, AKC Reunite, 24Petwatch, Found Animals, Peeva — are listed.** (A 24PetWatch object appears in an old docs sample, but it is not on the current provider page.)
- Consequence: for a US-first product, ChipnDoodle's "found" rate on American chips will be poor. Its realistic value for petdocs is (a) international users, (b) the "check where your chip is registered" onboarding flow with an honest link-out to AAHA's tool for US chips, (c) a lost-pet finder flow. This materially shaped the §6 recommendation.

---

## 3. The US registry landscape (and why none of them give us an API)

| Registry | Public/partner API? | What exists instead | Sources |
|---|---|---|---|
| **AAHA Universal Pet Microchip Lookup** | ❌ No API. Web tool at aaha.org / petmicrochiplookup.org. Coalition (AAHA, AVMA, ASPCA, HSUS, NFHS, SAWA, AHA, ASVMAE) **encourages sites to link/bookmark it**, not integrate. Returns *which registries to contact*, in recency order — never owner data. Only searches registries that opt in. | Link-out from our chip-lookup results ("Look this US chip up in AAHA's tool"). | ✅ <https://www.aaha.org/for-veterinary-professionals/microchip-registry-lookup-tool-aaha-find-your-pets-microchip-registry/> |
| **PetLink** (Datamars) | ❌ No public API. PIMS integrations only (IDEXX Neo, ezyVet, Digitail); "microchip registration integrations with many of these preferred software partners… email petlink@petlink.net". Their own search tool embeds AAHA's lookup. | BD contact for a future outbound/post-visit registration integration (pairs with our enterprise inbound-API direction). | ✅ <https://www.petlink.net/account/register-animal-professional/> · <https://idexxneosupport.zendesk.com/hc/en-us/articles/27466480613143-FAQs-PetLink-Microchip-Registration-integration-with-Neo> · <https://docs.ezyvet.com/en/see-all-integrations/veterinary-care/petlink/about-the-petlink-integration> · <https://www.petlink.net/microchip-search/> |
| **HomeAgain** (Merck Animal Health) | ❌ No public API. "Auto Chip Registration" via practice-management software; signup form for professionals. | Same PIMS-partner play. | ✅ <https://professional.homeagain.com/integration-homeagain> · <https://www.merck-animal-health-usa.com/c/homeagain-free-chip-program/> |
| **AKC Reunite** | ❌ No public API. "Automatic uploads from your organization's software" (800-252-7894); HUB portal for pet professionals. | Enrollment-automation partnership only. | ✅ <https://www.akcreunite.org/upload-instructions/> · <https://www.akcreunite.org/hubpinfaq/> |
| **Michelson Found Animals** | ❌ No public API. First *free* US registry; registration portal now operated with/under 24Petwatch. | Useful as the *recommendation target* when we tell users "your chip isn't registered — register free" (free, any-brand). | ⚠ <https://www.michelsonphilanthropies.org/news/where-to-register-your-pets-microchip-for-free/> · ⚠ <https://www.foundanimals.org/> · ⚠ <https://www.24pet.com/products/registry> |
| **24Petwatch** | ❌ No public API. Free registry enrollment via shelter/vet channels. | Same. | ⚠ <https://www.24pet.com/products/registry> |

**Pattern:** US registries monetize recovery services and treat owner data as their moat; every integration they offer is B2B/PIMS, gated by a contract. **No consumer-app-facing chip-owner lookup exists in the US** except AAHA's link-out tool (registry names only) and ChipnDoodle (international coverage).

---

## 4. Free-boost integrations beyond chips

### 4a. Breed databases ✅
| Service | License / cost | Data | Fit |
|---|---|---|---|
| **dogapi.dog** (github.com/kinduff/dogapi.dog) | **Free, no key, MIT-licensed, open PRs** | 283–340+ breeds, 9–20 groups, 483 facts | Best-in-class licensing; ideal for breed autocomplete + temperament copy at onboarding. ✅ <https://dogapi.dog/> · <https://github.com/kinduff/dogapi.dog> |
| **TheDogAPI / TheCatAPI** | Free tier **10,000 req/month** with API key; health tips / dietary risks / image labeling are **paid** add-ons | Breed info + images | Bigger image corpus; richer health content is paywalled. ⚠✅ <https://docs.thedogapi.com/docs/intro> · <https://thecatapi.com/> · <https://publicapis.io/the-cat-api> |
| **Dog CEO Dog API** | Open-source, free | 20k+ images by breed | Images only. ✅ <https://dog.ceo/dog-api/> |
| **API Ninjas Dogs API** | Free key, low daily quota | 200+ breeds, qualitative data | Redundant with dogapi.dog. ⚠ <https://api-ninjas.com/api/dogs> |

**Debunk:** *"aKartel/kinfolk"* — **no such pet/breed data API exists.** Searches return nothing remotely matching; likely a garbled name. Do not chase. (Verified negative via search 2026-09-15.)

### 4b. Vaccine verification — the hidden gem ✅⚠
**VetVerifi Partner API** (<https://vetverifi.com/api-use-cases>): partner API that verifies a pet's vaccine status against its clinic network — `POST /v1/verifications` with pet name + owner email/phone + vet name → per-vaccine `{status, expires}` + `verified_by` clinic; webhooks for status changes; docs at <https://dev.partner-api.vetverifi.com/docs> ⚠; "**Get API access — free**" sandbox, no credit card ✅ <https://vetverifi.com/api-use-cases>. Claims SOC 2 Type II, 99.97% uptime ⚠ (self-reported). Tiers exist (Starter → Growth → Scale → Platform) but **production pricing is not published** — must be confirmed before committing.
- **Why it matters:** a "✓ verified by [clinic]" badge on our public passport pages is *exactly* the structured/verified-vault moat vs. Petlia's file dumps (see research/petlia.md). This is the strategic fast-follow.
- **Risk:** early-stage vendor (site built on base44) ⚠; sandbox-first, keep the client behind one Convex action so swapping vendors is cheap.

### 4c. Rabies / vaccine data standards
- **NASPHV Form 51** is the national model **Rabies Vaccination Certificate** (vet-completed, CDC/USDA-endorsed): the canonical field set (vaccine product, serial, date, duration/expiration, tag number, microchip, vet license). ✅ <https://stacks.cdc.gov/view/cdc/156106> · <https://nasphv.org/> · ⚠ <https://www.mainevetmed.org/assets/Rabies%20Vaccination%20Certificate.pdf> — **Action:** model petdocs' structured rabies record on Form 51 fields. Zero integration; pure schema alignment that vets will recognize.
- **GlobalVetLink** does digital rabies certificates for 11,000+ clinics — paid B2B for vets, not us. Future clinic-side partner, not an integration target now. ⚠ <https://www.globalvetlink.com/rabies>

### 4d. Pet laws / licensing ✅
- **MSU Animal Legal & Historical Center** (animallaw.info): 1,400+ US statutes, 1,200+ cases, topic tables and per-state compilations (e.g., licensing mandates, anti-cruelty, dangerous-dog laws). **No API** — but stable, linkable pages; a curated per-state "pet law quick reference" in help content is a free SEO/authority boost. ✅ <https://www.animallaw.info/> · <https://www.animallaw.info/statutes/us/michigan>
- Municipal codes live in Municode / eCode360 / American Legal Publishing portals — no open APIs; cite links only. (Surfaced across searches; treat as link-farm territory.)
- **Pet licensing vendors (DocuPet, PetData)** power municipal dog licensing (San Diego County, Maricopa, Boulder, Long Beach; PetData has processed 34M+ licenses). B2B only — long-term partnership targets for license-status sync, not integrations now. ✅ <https://sddac.docupet.com/en_US/licensing> · <https://www.maricopa.gov/226/Dog-License> · <https://petdata.com/>

### 4e. Vet directories
**No open vet-directory API exists.** AAHA's accredited-hospital finder and vetlocal.us are web directories without APIs; USDA VSPS vet search is a legacy government form app. ✅ <https://www.aaha.org/for-pet-parents/find-an-aaha-accredited-animal-hospital-near-me/> · <https://www.vetlocal.us/find-a-vet/> · <https://vsapps.aphis.usda.gov/vsps/public/VetSearch.do> — Practical option remains Google Places API (paid, with free monthly credit) if a "find a vet" feature is ever wanted. Not a free win; skip.

---

## 5. Recommendation matrix

Value/effort: S/M/L relative to petdocs. "Compliance risk" = data-protection / ToS / dependency risk.

| # | Integration | Value to petdocs | Cost | Effort | Compliance risk | Verdict |
|---|---|---|---|---|---|---|
| 1 | **ChipnDoodle Pet Search + Providers API** | Onboarding hook ("check your chip"), lost-pet finder flow, international coverage | $0 (today) | **S–M** (1 action + cache table + async UI) | Med: owner-PII fields in responses → don't persist them; no SLA/ToS | **🥇 FIRST PICK** — see §6 |
| 2 | **VetVerifi Partner API** | "Verified by clinic" badge on passport = core moat | Sandbox free; production pricing unpublished | M (action + webhook route + badge UI) | Med: startup vendor; keep behind one action | **🥈 Fast-follow** after sandbox validation + pricing call |
| 3 | **dogapi.dog / TheDogAPI breed data** | Breed autocomplete + breed-care content at onboarding | $0 (MIT / 10k req-mo) | **S** (days) | Low | Cheap polish; bundle with #1's sprint |
| 4 | **NASPHV Form 51 schema alignment** | Credible rabies records vets recognize | $0 | S (schema work in app code — separate issue) | None | Do in product, not as an "integration" |
| 5 | **AAHA lookup link-out** | Correct US answer for "where's my chip registered" | $0 | **S** (one deep link) | None (coalition invites links) | Ship alongside #1 |
| 6 | **MSU animallaw.info curated links** | State pet-law help content, SEO | $0 | S (editorial) | Low | Content backlog, not engineering |
| 7 | **Peeva** | Chip↔records network (would be huge) | Unknown (partnership) | L (contract, unknown API) | High until papers signed | **BD email only; revisit in 6 mo** |
| 8 | **PetLink / HomeAgain / AKC Reunite / Found Animals** | Post-visit auto-registration (clinic side) | Unknown (B2B) | L | Contractual | Defer until enterprise inbound-API direction matures |
| 9 | **DocuPet / PetData license sync** | License-status in vault | Unknown (B2B) | L | Contractual | Defer; partnership targets |
| 10 | **Google Places vet finder** | "Find a vet" utility | Paid (free credit) | M | Low | Skip — not free, not differentiated |

---

## 6. First pick: ChipnDoodle — rationale

Owner constraint: **a FREE integration that gives a growth boost.**

1. **Only free, self-serve, real API in the core chip domain.** Token in minutes, documented limits (100/5 min), documented response shapes (§2). Peeva needs a contract; US registries need B2B deals; AAHA has no API.
2. **Growth mechanism:** chip lookup is a *viral onboarding wedge* — "enter your pet's chip number → see which registries have it (and which don't)" converts curiosity into a petdocs account, then the natural next step is "not registered anywhere? register free (Found Animals) + start your vault here." The same API powers a public "found a pet?" flow on passport pages — every lost-pet lookup is a shareable event that markets petdocs.
3. **Cost of being wrong is low.** US "found" rates will be modest (§2d) — mitigate by pairing every US result with an AAHA link-out and the Providers-API-derived registry directory. If ChipnDoodle dies or starts charging, we lose one action + one cached table; nothing else depends on it.
4. **VetVerifi is deliberately second**, not first: higher strategic value but unpublished production pricing and vendor risk — sandbox it in parallel, integrate after a pricing answer. Breed data (dogapi.dog, MIT, no key) ships as a same-week bonus since it's trivial.

---

## 7. Convex integration sketch — ChipnDoodle (docs-only, for the implementing PR)

> Shape follows repo conventions: action for the external call, key in **Convex env** (not Netlify), cache table, no hardcodes of `(marketing)` routes.

**Env / key storage**
- `bunx convex env set CHIPNDOODLE_TOKEN <token>` on dev + prod deployments (Convex env ≠ Netlify env; AGENTS.md). Read in the action as `process.env.CHIPNDOODLE_TOKEN`. Never ship to the client.

**Schema — `convex/schema.ts` addition**
```
chipLookups: {
  chipNumber: string            // validated 10/15-char, stored uppercase, no owner PII
  requestedBy: id<"users">      // authenticated requester
  petId?: id<"pets">
  status: "pending" | "complete" | "failed"
  foundCount: number            // from response.found
  queriedCount: number          // from response.count
  registries: array<{           // ONLY registry metadata persisted
    name, slug, phone?, email?, website?, country?
  }>
  rawExpiresAt?: number         // if raw PII response is ever kept: TTL ≤ 24h, else never store
  createdAt / updatedAt: number
}
// indexes: by_chip_number (chipNumber, createdAt desc), by_requester (requestedBy)
```

**Functions — `convex/chipSearch.ts`**
- `mutation requestChipLookup({ chipNumber, petId? })` → validate format (FDX-B: 15 hex digits; FDX-A: 10 alnum), enforce per-user rate limit with **@convex-dev/rate-limiter** (e.g., 5 lookups/user/day — well under the shared 100/5-min app budget), dedupe: return existing complete lookup when `by_chip_number` hit is < 7 days old (**cache = quota protection**), else insert `pending` and schedule the action.
- `action runChipLookup({ lookupId })` (internal) → `POST https://api.chipndoodle.com/searches` with `token` + `uid`; tolerate **9–15 s latency** and set an action timeout above it; on success, map `responses[]` → `registries[]` (registry metadata **only** — strip `name/email/tel/cel` owner fields before persisting); write `complete` + counts. On error/timeout → `failed`, surfaced as "try again".
- `query getChipLookup({ lookupId })` + `listMyChipLookups()` → feed UI; public passports may at most show `{ foundCount }`-style counters, never registry PII.
- Optional `query listRegistries({ country })` → wraps `GET /providers` (cached daily in a `chipRegistries` table) for a "registries by country" content surface.

**UI touchpoints**
1. **Onboarding / add-a-pet:** optional "Have a chip number? Check where it's registered" → pending spinner (expect ~15 s) → result card listing found registries with phone/website + CTAs: "Register it free (Found Animals)" · "Add your pet's vault on petdocs".
2. **Pet profile:** persistent "Chip registration" card + re-run button (rate-limited), history of past lookups.
3. **Lost-pet flow / public passport:** "Found this pet?" → chip-number entry by an anonymous visitor → result shows registry contacts to call (this is the AAHA-blessed norm: route the finder to the registry; we never expose owner PII ourselves). Pair every US result with an **AAHA lookup link** (§3) and prefix guidance: chips starting `9851…` (Datamars/US), `98102…`, `956…` etc. can be routed by a small static prefix table — maintain conservatively, link-out is the fallback.
4. **Marketing:** "Universal chip check — free" on the landing page; the Providers API powers a shareable "chip registries around the world" page.

**Compliance guardrails**
- Never persist owner PII from `responses[]` (email/tel/cel); persist registry metadata only. If a future feature needs raw payloads, keep them ≤24 h with `rawExpiresAt` + a cron purge.
- Rate-limit per user; CAPTCHA-equivalent protection comes from auth (lookups require a signed-in user except the single public found-pet flow, which gets the strictest limiter).
- ToS risk: ChipnDoodle publishes no API terms — pin docs, keep the client swappable, and note the dependency in `docs/`.

---

## 8. Source index (primary reads this session)

Peeva: /api-calls, /terms-of-service, /business-development, /peeva-for-veterinarians (all peeva.co) · LinkedIn /company/peeva
ChipnDoodle: chipndoodle.com/docs, /docs/tokens, /docs/searches, /docs/providers, /docs/uploads, /providers; api.chipndoodle.com
AAHA: Microchip Registry Lookup page + FAQ (aaha.org); petmicrochiplookup.org (referenced by coalition FAQ)
PetLink: petlink.net /account/register-animal-professional, /microchip-search, /frequently-asked-questions; IDEXX Neo FAQ; ezyVet docs; Digitail help
HomeAgain: professional.homeagain.com/integration-homeagain; merck-animal-health-usa.com free-chip program
AKC Reunite: akcreunite.org /upload-instructions, /hubpinfaq
Found Animals / 24Pet: foundanimals.org; michelsonphilanthropies.org free-registration article; 24pet.com/products/registry
Breeds: dogapi.dog; github.com/kinduff/dogapi.dog; docs.thedogapi.com/docs/intro; thecatapi.com; dog.ceo/dog-api; api-ninjas.com/api/dogs; publicapis.io/the-cat-api
Vaccine: vetverifi.com/api-use-cases (+ dev.partner-api.vetverifi.com docs link); nasphv.org; stacks.cdc.gov/view/cdc/156106; globalvetlink.com/rabies
Laws/licensing: animallaw.info (+ Michigan statutes page); sddac.docupet.com; maricopa.gov/226/Dog-License; petdata.com; longbeach.gov press release
Directories: aaha.org find-accredited-hospital; vetlocal.us; vsapps.aphis.usda.gov (VSPS)
