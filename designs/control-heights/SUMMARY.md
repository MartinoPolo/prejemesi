# Control Heights — Design Summary

**Base**: Variant A | **Refined**: 2026-07-18

## Refinements Applied

Variant A was chosen and refined with: uniform `lg` 38 auth stack confirmed (incl. magic link as
ghost `lg`), circled overlay close button (#164) kept in all dialogs, **firmer** form labels
(darker/bolder token — ≈72% ink, weight 600 — NOT an app-wide ink flip, which was rejected),
create-list segmented toggle as separate ink-outline buttons (active = accent fill + sticker
shadow), dialog header typography on the app's own scale (`text-2xl` 22 px DynaPuff title +
`text-sm` 12 px muted description — revised up from an initial `text-xl` 17 px after user
visually compared both against the mockup's 21 px and preferred the larger size; 22 px is the
nearest on-scale token, not a bespoke 21 px value). See the design brief for full requirements. Key changes from
the base variant: the mockup's bare `×` close button was replaced by the production circled X;
everything else in Variant A stands, with the dialog-chrome styling now promoted from "mockup
styling" to implementation scope (§3.9 of the brief).

> **Token caveat**: the variant links the legacy `designs/tokens.css` (Noto Sans + a larger
> scale). The live app (`src/app.css`) is DynaPuff headings / Geist body, scale
> `xs 11 · sm 12 · base 14 · lg 15 · xl 17 · 2xl 22 · 3xl 28`, control heights already 26/32/38.
> All typography decisions here use the LIVE scale, not the mockup's px values.

Explicitly debated and settled: primary CTA does NOT step up to `xl` in form stacks — hierarchy
comes from fill/variant, never height. "One group, one height" has no exceptions.

## Component Map

### Codebase — Use As-Is (with variant extensions)

| Component      | Path                                     | Usage                                                        | Key Props/Variants                                                             |
| -------------- | ---------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Button         | `src/lib/components/base/button/`        | all button surfaces; `lg` form stacks, `xl` hero/share       | **add `size="xl"`** (48 px, `--text-lg`, `px-5`); sm/md/lg/icon unchanged      |
| Input          | `src/lib/components/base/input/`         | text fields; `lg` in form stacks                             | **add `size="md" \| "lg"`** prop; `state` orthogonal, works at both            |
| Select.Trigger | `src/lib/components/base/select/`        | currency, priority, sort selects                             | **rewire to tokens**: `sm` 26 / `md` 32 (default) / `lg` 38; kill `h-9`/`h-8`  |
| ToggleGroup    | `src/lib/components/base/toggle-group/`  | create-dialog segments at `lg`; view switchers at `icon` 32  | segments restyle: separate ink-outline items, active = accent fill + shadow    |
| InputGroup     | `src/lib/components/base/input-group/`   | grouped inputs                                               | root `h-9` → `md` 32 + `lg` variant; fix dead `cn-input-group-button-size-sm`  |
| Label          | `src/lib/components/base/label/`         | all form labels                                              | **darken+embolden** (scoped to Label): ≈62%→≈72% ink, weight 500→600; NOT ink  |
| Dialog         | `src/lib/components/base/dialog/`        | create-list dialog, gift edit modal                          | `overlayCloseButtonClass` (#164) unchanged; `Dialog.Title` 15→22 px (`text-2xl`) |
| SearchField    | `src/lib/components/derived/`            | form stacks                                                  | pass `size` through to Input                                                   |
| DatePicker     | `src/lib/components/derived/`            | create-dialog event date at `lg`                             | pass `size` through to Button                                                  |

### Adopt from shadcn-svelte / Bits UI

| Component | Source | Install command | Purpose |
| --------- | ------ | --------------- | ------- |
| — none —  |        |                 | token/variant change to existing primitives only |

### Build Custom

| Proposed Name | Description | Why existing components don't cover it |
| ------------- | ----------- | -------------------------------------- |
| — none —      |             | no new visual components               |

## Implementation Notes

- **Delegate to cheap subagents** (noted on #159): the §3.7 sweep and the discovery of further
  height call sites (`h-8`–`h-12`, padding-derived heights, hardcoded px) are Haiku/Sonnet
  busy-work; reserve the main model for the component API changes and final review.
- **Label change is a scoped token nudge, NOT an ink flip** — darken + embolden the base `Label`
  only (≈62%→≈72% ink, 500→600). Do NOT touch the global `--muted-foreground` token: helper,
  description, and meta text must stay ≈62%. The app-wide ink flip was rejected — it flattens
  label→value contrast in dense forms and collides with the ~5 deliberately-muted spots
  (price-range toggle, notification matrix, reserve summary) and the inverted read-only value rows.
  Contrast is a second driver: 62% navy at 12 px likely fails WCAG AA (~3.5:1); ≈72% clears it —
  worth a quick contrast check during implementation.
- **Title/heading ladder** (app-wide, on the DynaPuff scale): page `clamp(26–34)` → dialog &
  section/empty-state `text-2xl` 22 → content-card `text-xl` 17 → dense/utility card `text-base`
  14. Consolidate the current card-title sprawl (12 / 14 / 16 / 17 px) onto the two card tiers.
- **Secondary-text consolidation** (mechanical subagent work): one helper/description token —
  `muted-foreground` at 12 px — replacing the `foreground-subtle` (55% / 11 px) + `ink-soft` mix;
  route field helpers through `HelpText`; collapse the `muted-foreground` / `ink-soft` naming
  duplication (same value, two names).
- **Segmented toggle restyle** touches `CreateWishlistModal`'s current joined-segment
  ToggleGroup overrides (`rounded-none border-transparent …`) — replace with separate items
  (gap ~8 px), active: `bg-accent border-ink shadow-sticker`, inactive: `border-border`
  muted text, no shadow. Keep `aria-checked`/radiogroup semantics from ToggleGroup.
- **Dialog.Title** currently `font-heading text-lg` (15 px); step to `text-2xl` (22 px) DynaPuff
  semibold — the app-scale target, NOT the mockup's off-scale 21 px. (An intermediate proposal
  used `text-xl` 17 px to converge with `GiftDraftDialog`/`GiftDetailView`; user directly compared
  both sizes and preferred the larger one, so those two components should step up to 22 px too for
  consistency — flag as a small additional delta if not already covered elsewhere.)
  `Dialog.Description` stays `text-sm` (12 px) muted, tightened gap — one shared change in the
  base dialog components, not per-modal overrides.
- **Label-row alignment** (§3.6): shared `min-h` (26 px) on both columns' label rows of every
  two-column `formRow` in the gift modal; verify price/currency AND quantity/priority.
- No behavior/validation changes; heights, alignment, and dialog chrome styling only.
- E2E: assert computed heights via tokens (e.g. `getComputedStyle(...).height === '38px'`) on
  login stack + create dialog; reuse `tests/e2e/fixtures/auth-helpers.ts`.
