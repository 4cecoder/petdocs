# Compliance & vet-friendliness: petdocs in the USA

Researched 2026-09-15. Scope: what it takes for petdocs (consumer pet-document vault + shareable passports + planned vet/clinic surface) to be adoptable by US veterinary clinics and defensible in its marketing claims.

> **Disclaimer:** This is competitive/product research compiled from public sources, not legal advice. Statutes and board rules change; verify primary sources (linked throughout) before making legal commitments, and have counsel review the Terms/Privacy/claiming language before vet-pilot launch.

---

## 1. Veterinary record-keeping norms (AAHA)

The American Animal Hospital Association (AAHA) accredits practices against **900+ standards** covering all aspects of practice, with medical records among the hardest groups to satisfy ([Instinct.vet, "10 Common Questions About Veterinary Medical Recordkeeping Standards"](https://instinct.vet/blog/10-common-questions-about-veterinary-medical-recordkeeping-standards/); [AAHA Standards of Accreditation](https://www.aaha.org/resources/aaha-standards/)). AAHA also publishes clinical guidelines separately ([AAHA Guidelines hub](https://www.aaha.org/for-veterinary-professionals/aaha-guidelines/)).

Standards most relevant to a product like petdocs (MR = medical-records standard IDs, quoted via [Instinct.vet](https://instinct.vet/blog/10-common-questions-about-veterinary-medical-recordkeeping-standards/)):

| AAHA standard | What it requires | Implication for petdocs |
|---|---|---|
| MR 03 | Records retained "for the length of time necessary to serve as resources for patient care, legal requirements, research, education" | Vaults must be durable; deletion policies must respect that clinics treat the record as long-lived |
| MR 48.1 | EMR notations auto-close ≤24h; later changes are amendments with an **audit trail** | Audit trail on every document mutation is table stakes for vet trust (petdocs Convex mutations can log actor + timestamp) |
| MR 44 | EMR must "prevent unauthorized viewing or editing" | Auth + RBAC (already scaffolded in `convex/staff.ts`) and no anonymous write paths |
| MR 50.1 | PIMS uses **role-based security** | Our staff/vet roles must map to distinct permission levels, not one shared login |
| MR 28 | Written protocol: who writes, confidentiality, who may access | Clinics will ask for our data-handling one-pager to attach to that protocol |
| MR 29 | Written protocol for **releasing records to the client** (who approves, format, circumstances) | petdocs share links are exactly this surface — the clinic must be able to document our share flow in their MR 29 protocol |
| MR 22/23/24.1 | Complete history: meds, immunization history, diets, client observations, outside-practice care | Our structured vault fields (vaccination, medication, visit, document types) mirror this list — a selling point vs. raw file dumps |
| MR 21t/21t.1, MR 32 | Signed consent forms + informed-consent components retained in the record | Owner-entered "manually signed" docs (below) must preserve signer, date, witness/attribution fields |

Note AAHA is **voluntary accreditation**, not law — but it defines what "well-kept records" means to the clinics most likely to pilot new tooling ([AAHA Standards FAQ via Instinct](https://instinct.vet/blog/10-common-questions-about-veterinary-medical-recordkeeping-standards/)).

## 2. VCPR and what it means for owners holding vet-issued records

The veterinarian-client-patient relationship (VCPR) requires that the owner has chosen the vet, the vet has recently examined the animal hands-on, and the owner agrees to follow the vet's instructions; it must exist **before** diagnosis, prescribing, or treatment ([AVMA, "The veterinarian-client-patient relationship (VCPR)"](https://www.avma.org/resources-tools/pet-owners/yourvet/veterinarian-client-patient-relationship-vcpr)). Many states adopt the AVMA definition or something close in their practice acts ([AVMA, "Telehealth and the VCPR"](https://www.avma.org/resources-tools/animal-health-and-welfare/telehealth-telemedicine-veterinary-practice/telehealth-and-vcpr)).

Under the AVMA framing, one of the vet's VCPR duties is to "keep a complete, up-to-date record" of care ([AVMA VCPR page](https://www.avma.org/resources-tools/pet-owners/yourvet/veterinarian-client-patient-relationship-vcpr)).

Consequences for petdocs:

1. **The vet's record is the record of record; the owner holds a copy.** In most US jurisdictions the practice owns the (physical or digital) record, while the client has the right to request and receive a copy ([CoVet, "Veterinary medical records laws by US region and state"](https://co.vet/post/veterinary-medical-records-laws/)). Florida states this expressly: the "records owner" is the veterinarian who generated the record ([Fla. Stat. §474.2165](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&Search_String=&URL=0400-0499/0474/Sections/0474.2165.html)); California obligates the vet to provide the client "a summary of the patient record" under Business & Professions Code §4855 ([California Veterinary Medical Board FAQ](https://vmb.ca.gov/consumers/faqs.shtml)).
2. **petdocs is a holder of owner-supplied copies, not a practice EMR.** Owner uploads of vet-issued documents are copies the client was entitled to receive. We must never present vault contents as the authoritative clinical record — positioning language and product labels ("my pet's documents," not "medical record of care") keep us out of the EMR regulatory conversation.
3. **VCPR gates what we could ever do clinically.** If a future feature smells like diagnosis/triage/prescription guidance without a VCPR, it crosses into veterinary practice regulation. Sharing, storing, reminding: fine. Interpreting health data and advising: VCPR territory ([AVMA telehealth & VCPR](https://www.avma.org/resources-tools/animal-health-and-welfare/telehealth-telemedicine-veterinary-practice/telehealth-and-vcpr)).
4. **Background:** the VCPR doctrine and its ethical roots are catalogued by the Michigan State Animal Legal & Historical Center ([Overview of Veterinary Client Issues](https://www.animallaw.info/article/overview-veterinary-client-issues)).

## 3. State veterinary board rules (broad survey; strict states to watch)

There is **no federal baseline** for veterinary records — each state's veterinary practice act, administered by its board, sets retention, confidentiality, and release rules ([CoVet state survey](https://co.vet/post/veterinary-medical-records-laws/); board directory: [AVMA list of state veterinary board websites](https://www.avma.org/advocacy/state-and-local-advocacy/veterinary-state-board-websites)).

Survey highlights (citations on each):

| State | Rule | Source |
|---|---|---|
| **California** | Retain **3 years from last visit**; vets owe clients a summary of the patient record (B&PC §4855); board FAQ is explicit | [CA VMB FAQ](https://vmb.ca.gov/consumers/faqs.shtml); [CoVet survey](https://co.vet/post/veterinary-medical-records-laws/) |
| **Florida** | Records owned by the generating vet (§474.2165); 3-year retention (§474.214) | [Fla. Stat. §474.2165](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&Search_String=&URL=0400-0499/0474/Sections/0474.2165.html); [CoVet survey](https://co.vet/post/veterinary-medical-records-laws/) |
| **Texas** | **5-year retention** (22 TAC pt. 24) | [CoVet survey](https://co.vet/post/veterinary-medical-records-laws/) |
| **New York** | 3-year retention cited in practice summaries; NY also has its own e-signature statute (see §4) | [CoVet survey](https://co.vet/post/veterinary-medical-records-laws/); [Adobe US e-signature law summary](https://helpx.adobe.com/legal/esignatures/regulations/united-states.html) |
| **Indiana** | Prohibits release of an animal's veterinary records/condition without client consent unless an exception applies | [JAVMA: Maintaining medical record confidentiality](https://avmajournals.avma.org/view/journals/javma/255/3/javma.255.3.282.xml) |
| **Ohio (example of silence)** | No specific statute; AVMA recommends ≥5 years by convention | [CoVet survey](https://co.vet/post/veterinary-medical-records-laws/) |

Patterns that matter to petdocs:

- **Release requires client consent** in most states; permitted disclosures are consent, subpoena/court order, regulator request, or another vet involved in care ([CoVet survey](https://co.vet/post/veterinary-medical-records-laws/)). Indiana is an explicit consent-statute example ([JAVMA](https://avmajournals.avma.org/view/journals/javma/255/3/javma.255.3.282.xml)).
- **Strict states to call out in pilot planning:**
  - **California** — board actively polices records via complaints; the §4855 summary duty makes record-release workflows scrutinized ([CA VMB FAQ](https://vmb.ca.gov/consumers/faqs.shtml)).
  - **Florida** — statutory records-ownership language and its own records section of the practice act ([§474.2165](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&Search_String=&URL=0400-0499/0474/Sections/0474.2165.html)).
  - **Indiana-type consent states** — confidentiality is statutory, so a leaky share link is a legal problem, not just a PR one ([JAVMA](https://avmajournals.avma.org/view/journals/javma/255/3/javma.255.3.282.xml)).
- Retention windows range roughly **1–7+ years**; AAHA/AVMA convention says ≥5 years ([CoVet survey](https://co.vet/post/veterinary-medical-records-laws/)). petdocs' free-tier deletion mechanics must never be marketed to clinics as a compliance archive — we're a personal vault, complementary to the practice's own retention.
- Boards expect practices to keep **written protocols** for records release (MR 29 above) — an adoptable clinic will want to file our share-link flow in that protocol ([Instinct.vet](https://instinct.vet/blog/10-common-questions-about-veterinary-medical-recordkeeping-standards/)).

## 4. Document authenticity & e-signatures (ESIGN/UETA) for manually-signed docs

Where this bites us: product-direction item — owners manually entering records that were **signed offline** (paper certs, clinic printouts) with vet name/clinic/date/signature reference ([research/product-direction.md](product-direction.md)).

Legal backdrop:

- The federal **ESIGN Act** (15 U.S.C. ch. 96) gives electronic signatures the same legal standing as handwritten ones and bars denying effect solely for being electronic ([statute text, US House](https://uscode.house.gov/view.xhtml?path=/prelim@title15/chapter96&edition=prelim); summary: [Purdue Global Law School](https://www.purduegloballawschool.edu/blog/news/e-signatures-legal-requirements)).
- State-level **UETA** (Uniform Law Commission, 1999) does the same for state law and has been adopted broadly — commonly cited as **49 states + DC + PR + USVI; New York uses its own ESRA statute instead** ([ULC Electronic Transactions Act](https://www.uniformlaws.org/committees/community-home?CommunityKey=2c04b76c-2b7d-4399-977e-d5876ba7e034); [Westlaw summary](https://content.next.westlaw.com/Glossary/PracticalLaw/I66e3df587a6611e498db8b09b4f043e0?transitionType=Default&contextData=%28sc.Default%29); [Adobe state-by-state summary incl. NY](https://helpx.adobe.com/legal/esignatures/regulations/united-states.html)).
- Recommended e-signature workflow elements per [Adobe's US regulations summary](https://helpx.adobe.com/legal/esignatures/regulations/united-states.html): clear intent to sign, consent to do business electronically, attribution/association of signature to record, retention of the executed record, and an opt-out path to paper.

What this means for petdocs' "manually signed entries":

1. **We are not the signer and must not imply we verified anything.** An owner transcribing "Dr. Patel signed my rabies cert on 3/1/26" is creating an **owner attestation** about a wet-ink document. ESIGN/UETA don't validate owner attestations — they only make e-signatures for actual transactions enforceable ([ESIGN text](https://uscode.house.gov/view.xhtml?path=/prelim@title15/chapter96&edition=prelim)).
2. **Design the entry to be self-describing:** fields for signer name, clinic, date, signature reference ("wet-ink on file"), and an explicit "entered by owner" provenance label. This matches the AAHA instinct that signed forms need attribution and witnesses ([Instinct.vet MR 21t/MR 32](https://instinct.vet/blog/10-common-questions-about-veterinary-medical-recordkeeping-standards/)).
3. **If we later offer true e-signature flows (owner consents to clinic-drafted docs),** we'd be an ESIGN/UETA transaction system: intent, consent, attribution, retention, delivered copies ([Adobe checklist](https://helpx.adobe.com/legal/esignatures/regulations/united-states.html)). Defer; note it in the vet-pilot phase.
4. **Immutability posture:** once "signed," entries should be amendment-only (audit-trailed), echoing AAHA MR 48.1 ([Instinct.vet](https://instinct.vet/blog/10-common-questions-about-veterinary-medical-recordkeeping-standards/)).

## 5. Privacy landscape for pet data

**No GDPR-class regime exists for pet data in the US, and HIPAA does not apply** — veterinary records are explicitly outside HIPAA, governed instead by state patchwork ([CoVet survey](https://co.vet/post/veterinary-medical-records-laws/)). But the *owner* is a person, so consumer privacy law attaches to our user data.

### 5.1 CCPA/CPRA (California)

The CCPA (as amended by CPRA) applies to for-profit businesses meeting thresholds (roughly $25M+ revenue, or 100k+ consumers' data, or 50%+ revenue from selling data) doing business in California; it grants access/deletion/opt-out rights over **consumers' personal information** ([California AG overview](https://oag.ca.gov/privacy/ccpa)). Key readings for us:

- **Pet data is usually not PI — the owner's data is.** CCPA "personal information" is information relating to an identifiable consumer/household ([analysis of the PI definition](https://calawyers.org/privacy-law/what-is-personal-information-under-the-california-consumer-privacy-act/)). "Luna got a rabies shot at Clinic X" isn't PI by itself — but the account email, name, address, phone, payment data, and even pet name + microchip number tied to an identified owner arguably are. Businesses already in animal verticals publish CCPA notices accordingly (e.g., [MAI Animal Health CA privacy statement](https://www.maianimalhealth.com/ca-privacy-statement)).
- **At current scale we're likely under the thresholds**, but we should behave as if CCPA applies because (a) growth, (b) share links create data flows California regulators would view functionally, and (c) the rights are cheap to honor for a Convex store (export + delete by userId).
- **"Sale/share" language matters:** the popular "your data is never sold" claim (which petlia uses on its hero — [petlia.app](https://petlia.app), captured 2026-09-15) is also a CCPA-aligned posture; CPRA's "share" concept covers cross-context behavioral advertising ([Sevati/securiti explainer on do-not-sell/share](https://securiti.ai/blog/cpra-do-not-sell-definition/)). If we never run ad-tech pixels, the claim is easy to keep.

### 5.2 Other state laws

Roughly a dozen comprehensive state privacy laws now exist beyond California (VA, CO, CT, TX, OR, MT, etc.). petdocs' practical posture — data minimization, no ad-tech, export/delete tooling, plain-language policy — satisfies the common denominator. Watch: state laws keep passing; recheck annually.

### 5.3 FTC: health-adjacent claims

- FTC Act **Sections 5 and 12** plus the deception and substantiation policy statements are the foundation of US truth-in-advertising; health claims need "competent and reliable scientific evidence" ([FTC Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance); [FTC Health Claims hub](https://www.ftc.gov/business-guidance/advertising-marketing/health-claims)).
- **Precedent in our space:** the FTC chased **Mars Petcare over Eukanuba ads claiming dogs fed the food lived ~30% longer**, forcing substantiation-backed settlement terms ([FTC business blog, 2016](https://www.ftc.gov/business-guidance/blog/2016/08/mars-petcare-doghouse-deceptive-claims-about-eukanuba); [DVM360 coverage](https://www.dvm360.com/view/mars-petcare-settles-with-ftc-over-advertising-claims)). Proof that pet-health claims are squarely in FTC reach.
- **Health apps get the same treatment** — FTC enforcement against health-app claims (e.g., an instant blood-pressure app) is precedent for software making physiological claims ([Cohen Healthcare Law roundup](https://cohenhealthcarelaw.com/fda-ftc-law/advertising-and-marketing-claims/)).
- **Device angle:** FDA regulates *devices* that diagnose/treat; a document vault makes no diagnostic claims, so we are not a medical device — but any AI feature that "reads" records and outputs health conclusions invites both FDA device questions and FTC substantiation demands. Copy discipline (see §8) is the control.

## 6. Microchip registration legalities

- **No US state mandates microchipping for all pets**, but several require it for **shelter/rescue adoptions and pet-store sales**, and registration with current owner info is often part of those statutes ([PetRegistrationAndRecovery state survey](https://petregistrationandrecovery.com/resources/microchip-guides/pet-microchipping-laws-by-state-is-it-required-where-you-live)).
- **Local ordinances go further:** e.g., Fort Worth, TX requires dogs/cats to have a **registered** microchip before 4 months of age ([Fort Worth Code §6-17](https://codelibrary.amlegal.com/codes/ftworth/latest/ftworth_tx/0-0-0-60255)); LA County ties microchip + registration to dog licensing ([state survey](https://petregistrationandrecovery.com/resources/microchip-guides/pet-microchipping-laws-by-state-is-it-required-where-you-live)); Hawaii (Honolulu) gives owners **30 days after implant to register** contact info ([Hawaii VMA regulation update](https://hawaiivetmed.org/microchip-regulation-update/)).
- **Registries, not government, run the data.** AAHA's Universal Pet Microchip Lookup exists precisely because chips can be registered in multiple registries; it reconciles chip numbers to registries for clinics ([AAHA lookup tool](https://www.aaha.org/for-veterinary-professionals/microchip-registry-lookup-tool-aaha-find-your-pets-microchip-registry/)). AAHA's consumer FAQ stresses adopters must re-register chips to their own info ([AAHA microchipping FAQ](https://www.aaha.org/resources/pet-microchipping-faqs/)).

Implications for petdocs:

1. Storing the chip number in the vault + on the passport is high-value for reunification and is **not itself regulated** — the *registry* status is. 
2. **Never claim petdocs "registers" a chip.** We can display the number and link out to registries; a "check my chip" feature would point at the AAHA lookup pattern, not replace it ([AAHA lookup](https://www.aaha.org/for-veterinary-professionals/microchip-registry-lookup-tool-aaha-find-your-pets-microchip-registry/)).
3. A "stale registration" nudge ("did you move? re-verify your chip registry entry") is a legitimate, defensible reminder feature that mirrors what ordinances and AAHA already urge ([AAHA FAQ](https://www.aaha.org/resources/pet-microchipping-faqs/); [Honolulu 30-day rule](https://hawaiivetmed.org/microchip-regulation-update/)).
4. On share passports, chip numbers are semi-sensitive (theft/reassignment vector) — consider masking by default on public links.

## 7. Vet–client data-sharing consent models

How clinics legitimately move records today, and what each implies for petdocs:

| Model | How it works | Consent posture | Source |
|---|---|---|---|
| **Owner-requested copy** | Client asks for their copy; practice protocol (MR 29) governs form & approval; some states allow copying fees | Owner's statutory right to a copy | [CoVet survey](https://co.vet/post/veterinary-medical-records-laws/); [CA VMB §4855 FAQ](https://vmb.ca.gov/consumers/faqs.shtml) |
| **Vet-to-vet transfer** | Records released to another vet involved in the patient's care, with client knowledge | Implied/known consent; state-recognized exception | [CoVet survey](https://co.vet/post/veterinary-medical-records-laws/) |
| **Written-consent release** | Client signs a release naming recipient | Express consent | [CoVet survey](https://co.vet/post/veterinary-medical-records-laws/); [JAVMA Indiana example](https://avmajournals.avma.org/view/journals/javma/255/3/javma.255.3.282.xml) |
| **Owner-fronted sharing (petdocs)** | Owner uploads their copy and shares a link/QR they control, expiring & revocable | The owner shares what is already theirs; clinic never disclosed anything | This product's existing `/p/[shareToken]` design |
| **Inbound API push (future)** | Clinic pushes documents into the owner's vault post-visit | Requires clinic-side consent capture at intake ("I agree my clinic may send records to my petdocs") + a data-handling agreement | [research/product-direction.md](product-direction.md) |

The clean wedge: **owner-fronted sharing requires no clinic action and no clinic disclosure**, so it's lawful everywhere from day one. Inbound API and vet-portal features enter clinic-disclosure territory → need the consent capture + agreement of §8.

## 8. Compliance checklist: what petdocs must do for clinic adoption

BAA-equivalents (HIPAA) **do not apply** — no human health data ([CoVet survey](https://co.vet/post/veterinary-medical-records-laws/)). But clinics operate under board discipline, so they'll ask for data-handling commitments before adopting anything touching records.

**Data-handling commitments (the "poor man's BAA"):**
- [ ] One-page **Data Handling Summary**: encryption in transit/at rest, access controls, RBAC, audit trails, backup, breach notification promise — written so a practice manager can staple it to their AAHA MR 28/29 written protocol ([AAHA standards context](https://instinct.vet/blog/10-common-questions-about-veterinary-medical-recordkeeping-standards/)).
- [ ] **No-training-on-customer-data commitment** for any AI parsing (owners' records are not our ML corpus unless separately consented).
- [ ] **Deletion & export** tooling honoring owner requests (CCPA posture; cheap in Convex) ([CA AG CCPA overview](https://oag.ca.gov/privacy/ccpa)).
- [ ] **Audit trail** on document create/edit/share/revoke events ([AAHA MR 48.1](https://instinct.vet/blog/10-common-questions-about-veterinary-medical-recordkeeping-standards/)).
- [ ] **Share-link controls**: expiry + revocation (shipped), passport chip-number masking, optional passphrase.
- [ ] **Sub-processor list** (Convex/Netlify/Resend) published in privacy policy.

**Disclaimers needed:**
- [ ] In-product: "petdocs is a personal document vault. It is **not a veterinary medical record of care** and does not replace your clinic's records." 
- [ ] Passport pages: "Records shown are copies provided/uploaded by the owner; verify originals with the issuing clinic." 
- [ ] Owner-entered signed docs: "Entered by owner from an originally signed document; petdocs does not verify signatures" ([ESIGN/UETA context](https://uscode.house.gov/view.xhtml?path=/prelim@title15/chapter96&edition=prelim)).
- [ ] Reminders: "Reminders are informational; confirm schedules with your veterinarian."

**What NOT to claim:**
- [ ] Not a **medical device**: never "diagnose," "detect," "screen," "monitor health conditions" — document organization only. Any claim that a feature assesses health invites FTC substantiation duties and FDA device questions ([FTC Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance); precedent: [Mars/Eukanuba](https://www.ftc.gov/business-guidance/blog/2016/08/mars-petcare-doghouse-deceptive-claims-about-eukanuba)).
- [ ] Not **replacing vet records of record**: never "the official record" / "your pet's medical record." The practice owns the record of care ([Fla. §474.2165](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&Search_String=&URL=0400-0499/0474/Sections/0474.2165.html); [CoVet survey](https://co.vet/post/veterinary-medical-records-laws/)).
- [ ] Not **vet-endorsed** until a real pilot exists; no implied AAHA affiliation (we are not accredited; AAHA marks are theirs) ([AAHA](https://www.aaha.org/resources/aaha-standards/)).
- [ ] No **"bank-level security" / "HIPAA-grade"** vagueness — claim only what the Data Handling Summary states.
- [ ] No **"AI reads your vet records"** health-interpretation framing (see device/FTC above); "auto-fills fields for your review" is the safe frame.
- [ ] No **"chip registration"** claims ([AAHA lookup](https://www.aaha.org/for-veterinary-professionals/microchip-registry-lookup-tool-aaha-find-your-pets-microchip-registry/)).

## 9. Phased compliance roadmap

### Phase 1 — Now (pre-launch hardening, no clinic claims)
1. Ship the Data Handling Summary + sub-processor list into `/legal` ([docs-only; matches MR 28 expectations](https://instinct.vet/blog/10-common-questions-about-veterinary-medical-recordkeeping-standards/)).
2. Add provenance labels to owner-entered docs ("entered by owner," signer fields) per §4 ([product-direction](product-direction.md); [ESIGN](https://uscode.house.gov/view.xhtml?path=/prelim@title15/chapter96&edition=prelim)).
3. Mask microchip numbers on public passports (§6).
4. Sweep marketing copy against §8 not-to-claim list ([FTC guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance)).
5. Confirm export/delete paths work end-to-end (CCPA posture) ([CA AG](https://oag.ca.gov/privacy/ccpa)).

### Phase 2 — Post-launch (consumer trust)
1. Publish breach-notification and data-retention commitments; annual policy review as states pass laws.
2. Share-link hardening v2: passphrase, download-disable toggle, view-audit for owner.
3. "Verify with your clinic" language on passports + chip re-registration nudges ([AAHA FAQ](https://www.aaha.org/resources/pet-microchipping-faqs/)).
4. Reminder-content review: informational only, no dosing/medical advice.

### Phase 3 — Vet-pilot (relationship-led)
1. Pilot agreement pack: data-handling terms, no-AI-training clause, audit-trail access for the clinic ([MR 28/29 fit](https://instinct.vet/blog/10-common-questions-about-veterinary-medical-recordkeeping-standards/)).
2. Clinic intake consent capture for **inbound API** record delivery (§7 model 5) — start with consent-statute-sensitive states (CA, FL, IN) flagged in §3.
3. Vet role in RBAC scoped to clinic/patient, distinct from owner roles ([MR 50.1 role-based security](https://instinct.vet/blog/10-common-questions-about-veterinary-medical-recordkeeping-standards/); [product-direction](product-direction.md)).
4. Optional true e-signature flow for clinic-drafted docs (ESIGN/UETA-compliant workflow: intent, consent, attribution, copies) ([Adobe checklist](https://helpx.adobe.com/legal/esignatures/regulations/united-states.html)).
5. Pilot-state shortlist: start TX/FL-friendly clinics with clear written release protocols; treat CA/IN consent regimes as the design constraint for the API ([§3](#3-state-veterinary-board-rules-broad-survey-strict-states-to-watch)).

---

## Source index

Primary/official: [AVMA VCPR](https://www.avma.org/resources-tools/pet-owners/yourvet/veterinarian-client-patient-relationship-vcpr) · [AVMA telehealth & VCPR](https://www.avma.org/resources-tools/animal-health-and-welfare/telehealth-telemedicine-veterinary-practice/telehealth-and-vcpr) · [AVMA state board directory](https://www.avma.org/advocacy/state-and-local-advocacy/veterinary-state-board-websites) · [AAHA Standards](https://www.aaha.org/resources/aaha-standards/) · [AAHA Guidelines](https://www.aaha.org/for-veterinary-professionals/aaha-guidelines/) · [Fla. Stat. §474.2165](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&Search_String=&URL=0400-0499/0474/Sections/0474.2165.html) · [CA VMB FAQ](https://vmb.ca.gov/consumers/faqs.shtml) · [ESIGN, 15 U.S.C. ch. 96](https://uscode.house.gov/view.xhtml?path=/prelim@title15/chapter96&edition=prelim) · [ULC UETA](https://www.uniformlaws.org/committees/community-home?CommunityKey=2c04b76c-2b7d-4399-977e-d5876ba7e034) · [CA AG CCPA](https://oag.ca.gov/privacy/ccpa) · [FTC Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance) · [FTC Mars/Petcare blog](https://www.ftc.gov/business-guidance/blog/2016/08/mars-petcare-doghouse-deceptive-claims-about-eukanuba) · [AAHA Microchip Lookup](https://www.aaha.org/for-veterinary-professionals/microchip-registry-lookup-tool-aaha-find-your-pets-microchip-registry/) · [Fort Worth §6-17](https://codelibrary.amlegal.com/codes/ftworth/latest/ftworth_tx/0-0-0-60255)

Industry/practitioner: [Instinct.vet AAHA recordkeeping Q&A](https://instinct.vet/blog/10-common-questions-about-veterinary-medical-recordkeeping-standards/) · [CoVet state records survey](https://co.vet/post/veterinary-medical-records-laws/) · [JAVMA record confidentiality](https://avmajournals.avma.org/view/journals/javma/255/3/javma.255.3.282.xml) · [MSU Animal Legal & Historical Center](https://www.animallaw.info/article/overview-veterinary-client-issues) · [Adobe US e-signature law](https://helpx.adobe.com/legal/esignatures/regulations/united-states.html) · [PetRegistrationAndRecovery microchip survey](https://petregistrationandrecovery.com/resources/microchip-guides/pet-microchipping-laws-by-state-is-it-required-where-you-live) · [Hawaii VMA chip rule](https://hawaiivetmed.org/microchip-regulation-update/) · [DVM360 Mars settlement](https://www.dvm360.com/view/mars-petcare-settles-with-ftc-over-advertising-claims)
