# 08 — Design System (DX-maximized)

One import for art, one hook for flows, tokens that match the theme. Warm, offline-safe, AA by default.

## PetArt — `src/components/art/PetArt.tsx`

`<PetArt name="happy" size={120} />` — kawaii SVG, zero deps, `aria-hidden`, cream disc backdrop.

| motif | use when |
|---|---|
| `lost` | 404 / dead trail |
| `sleepy` | empty timeline / quiet list |
| `happy` | no-pets, success, Done |
| `mail` | magic-link, inbox |
| `camera` | no-docs, upload empty |
| `box` | vault / docs storage |
| `rocket` | onboarding done |
| `siren` | error + cone pup |
| `clock` | no-reminders, due-soon |
| `link` | share / passport link |

Size: `96–120` inline in empty boxes (`120` hero, `96` compact), `80` for header avatar, `120` default. Never rely on emoji alone — art + text.

## Wizard kit — `src/components/flow/Wizard.tsx`

- `useSteps(total, initial)` → `{ step, next, back, go, isFirst, isLast }`
- `Stepper({ steps, current, onGo })` — dots + labels, `aria-label="Progress"`, never bar-only
- `StepShell({ art, title, subtitle, children, footer })` — centered art + card
- `FlowNav({ onBack, onNext, nextLabel, loading })` — 48px Back/Continue, loading-aware
- `WizardShell({ steps, current, art, title, subtitle, children, nav })` — stepper + shell in one

Recipe — new 3-step flow in ~40 lines:

```tsx
import { FlowNav, useSteps, WizardShell } from "@/components/flow/Wizard";

const STEPS = ["Pet", "Doc", "Done"];
export function MiniFlow() {
  const s = useSteps(3);
  return (
    <WizardShell steps={STEPS} current={s.step} onGo={s.go}
      art={["happy", "camera", "rocket"][s.step] as never}
      title={STEPS[s.step]} subtitle="Skippable, resumable, <3min">
      {s.step === 0 && <p>Name + species fields…</p>}
      {s.step === 1 && <p>Camera-first uploader…</p>}
      {s.step === 2 && <p>Passport preview + share…</p>}
      <FlowNav onBack={s.back} onNext={s.next}
        hideBack={s.isFirst} nextLabel={s.isLast ? "Finish" : "Continue"} />
    </WizardShell>
  );
}
```

## Brand tokens — `src/app/globals.css` (`@theme`)

- cream `#FFFBF5` → `bg-cream`, dark `#F7EFE2` → `bg-cream-dark`
- teal `600 #0D9488 / 700 #0F766E` → `bg-brand-600/700`, scale `brand-50–900`
- amber `#F59E0B` → `bg-accent-500`, soft `#FBBF24` → `bg-accent-400`
- ink `#1C1917` → `text-ink`, soft `#57534E` → `text-ink-soft`
- type `font-display` (rounded, e.g. Nunito) for h1/h2; body `font-sans`
- shape `rounded-2xl` cards, `rounded-full` pills; soft shadows, light-only MVP

## Voice + a11y rules

- Plain language: "Vet visit" not "Encounter", "Snap" not "Capture asset"
- Emoji + text, never color-only (`VaccineBadge` dot + label)
- Targets `min-h-[48px]`, rows `56px`; base `17px+`, always-visible labels
- `aria-live` for upload/status, `role="alert"` errors, focus rings, keyboard-safe dialogs

## Flow checklist (every flow, every time)

- [ ] Empty: PetArt + warm title + one next action (never blank table)
- [ ] Loading: `role="status"` skeleton (“Loading pet…”, spinners untouched)
- [ ] Error: `role="alert"` + retry (“Couldn’t create the share link — try again.”)
- [ ] Success: `happy`/`rocket` + toast + timeline insert + undo where destructive
