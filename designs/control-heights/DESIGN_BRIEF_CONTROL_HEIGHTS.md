# Control Heights (App-Wide Scale + Larger Input Variant) — Design Brief

> **Status**: Refined (Variant A)
> **Refined mockup**: `designs/control-heights/refined.html`
> **Summary**: `designs/control-heights/SUMMARY.md`
> **Refinements**: uniform `lg` auth stack confirmed (magic link ghost `lg`; primary does NOT step up to `xl`), circled close button (#164) kept, firmer form labels (darker/bolder token, NOT an ink flip), ink-outline segmented toggle, dialog header typography on the app's own scale (§3.9)

Adjacent controls across the app render at inconsistent heights: on the login card the primary „Přihlásit se" button (38 px) towers over the Google button, magic-link button, and inputs (all 32 px); in the gift edit modal the priority select is an off-scale 36 px next to 32 px inputs, and the price/currency row misaligns because its two label rows differ in height; landing/share surfaces hardcode 44–48 px heights outside any scale. This design formalizes ONE control-height scale (tokens + component size variants), adds the missing larger Input variant, wires the Select trigger to the tokens (the systemic half of #141 that was never done — #141 closed with a local `size="sm"` fix only), and prescribes the app-wide sweep that unifies every adjacent control group.

**Source**: issue #159.

---

## 1. Purpose

A design system earns trust through rhythm: controls that sit next to each other must share a height, and the same kind of surface must use the same size everywhere. Today three sizing systems coexist — the `--size-control-*` tokens (Button, Input), hardcoded Tailwind heights (Select `h-9`/`h-8`, InputGroup `h-9`, landing `h-12`, share wizard `h-11`), and padding-derived heights (FilterChip, nav pills, auth tabs). The result is visible seams on the highest-traffic surfaces (login, gift edit modal).

This brief answers, for every control on every surface: *which size step does it sit on, and why*. It defines the height scale, the context rules that assign a step to a surface type, the component API changes needed (Input `size` prop, Select rewiring, Button `xl`), and the exact sweep list.

**Key value**: every control height in the app resolves to one of four tokens, and any two adjacent controls always match.

---

## 2. Surrounding Context

This is a design-system-wide concern, not a single component. The mockup deliverable is therefore **(a) a control-scale specimen sheet** plus **(b) representative in-context surfaces** reproducing real chrome.

### Affected surfaces (current state, from code inventory)

**Auth card** (`src/routes/(auth)/login/+page.svelte`, `blocks/auth/RegisterForm.svelte`, `AuthFormCard.svelte`, `SocialLoginButtons.svelte`, `AuthPasswordInput.svelte`; same pattern on magic-link + reset pages):

- Split-screen layout, form card right (~440 px wide), custom auth-tab nav on top (~40 px, padding-based).
- Stack: labeled inputs (32 px) → „Přihlásit se" submit `Button size="lg"` (38 px, full width) → divider „nebo" → „Poslat kouzelný odkaz" ghost (32 px) → „Přihlásit přes Google" outline (32 px). THE core mismatch: 38 vs 32 in one vertical stack.

**Create-list dialog** (`blocks/wishlist/CreateWishlistModal.svelte`): segmented `ToggleGroup` („Pro mě" / „Pro někoho jiného", 32 px) → recipient-name + title `Input`s (32 px) → event-date `DatePicker` (Button outline, 32 px) → footer „Zrušit" + „Vytvořit" (32 px). Internally consistent at 32 px, but issue #159 acceptance requires this dialog at the larger variant.

**Gift edit modal** (`blocks/gift/GiftDetailForm.svelte`, layout in `gift_detail_modal_variants.ts`): two-column dense form. Price/currency row = `grid grid-cols-2 gap-3`; left label row contains `Label` + 16 px range-`Switch` + its label, right label row a bare `Label` → left control is pushed down (REQ-5 misalignment). Price `Input` 32 px, currency `Select.Trigger size="sm"` 32 px (matching only coincidentally — hardcoded `h-8`), priority `Select.Trigger` default **36 px** off-scale.

**Toolbars** (final per #161, do not redesign): wishlist detail toolbar — all controls 32 px (`GiftSortSelect`, `GiftViewSwitcher` icon toggles, icon buttons, „Přidat přání"); dashboard toolbar — `SortDropdown` 32 px but `ViewToggle` uses `icon-sm` **26 px** (inconsistent with the wishlist's 32 px view switcher).

**App header** (56 px navbar): icon-button cluster 32 px, „Vytvořit" 32 px, but the anonymous-state login button is `size="sm"` **26 px** adjacent to 32 px controls. Nav pills are 36 px custom link styling (navigation, not controls).

**Landing + share flow**: landing hero/CTA buttons hardcode `h-12` = 48 px (overriding `size="lg"`); `ShareMethodButton` hardcodes `h-12` = 48 px; `ShareWizard` buttons hardcode `h-11` = **44 px** — adjacent surfaces in one flow at 44 vs 48.

**Mockup rendering instructions**:

1. **Specimen sheet** (single tall page, sky palette, light mode): the four size steps side by side with px annotations — for each step show Button (primary/outline/ghost), Input (with label, placeholder, filled), Select trigger, icon button, and the step's intended pairings: an `lg` input + `lg` primary button stack (auth pattern), an `md` toolbar row (sort select + view toggle + icon buttons + primary), an `sm` pill row (consistent with #161), an `xl` hero CTA pair. Annotate each group with its context rule (§3.2).
2. **In-context surfaces** at ~1440×900, chrome reproduced faithfully:
    - Login card with the full unified stack (inputs, submit, magic link, Google — all one height).
    - Create-list dialog at the larger variant.
    - Gift edit modal with the price/currency row aligned (show label rows lining up) and the priority select normalized.
3. One narrow (~390 px) strip of the login card to prove the `lg` stack works on mobile.
4. The toolbar surfaces are FINAL per #161's brief — reproduce, do not re-explore; only the dashboard `ViewToggle` height correction (26 → 32) may be visible.

---

## 3. Requirements

### 3.1 The height scale (REQ-2, REQ-3)

Formalize four steps. The first three tokens already exist in `src/app.css`; `xl` is new:

| Token               | Value     | Name          | Role                                                                        |
| ------------------- | --------- | ------------- | --------------------------------------------------------------------------- |
| `--size-control-sm` | 26 px     | compact       | pills (#161), secondary inline actions, `icon-sm`                            |
| `--size-control-md` | 32 px     | default       | toolbars, chrome, dense editors — the app-wide default (unchanged)           |
| `--size-control-lg` | 38 px     | **canonical form height** | standalone form stacks: inputs, selects, date pickers AND their buttons |
| `--size-control-xl` | 48 px     | hero          | marketing/hero CTAs, share-method tiles (formalizes today's hardcoded `h-12`) |

- The canonical control height (REQ-2) is **`lg` = 38 px** — the primary login button's current height (`Button size="lg"`). Everything that sits with it steps UP to it, per the issue's "prefer the larger height" rule.
- 36 px (Select default `h-9`, InputGroup root `h-9`, quick-add `size-9`) is **abolished** — it exists only as an accident of unwired Tailwind classes.
- 44 px (`h-11`) is abolished — share wizard buttons join `xl`.

### 3.2 Context rules (which surface gets which step)

| Context                                                                                       | Step | Examples                                                                       |
| --------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| **Form stack** — a standalone labeled form ending in a primary CTA (auth card, create dialogs) | `lg` | login/register/magic-link/reset forms, create-list dialog, settings profile form |
| **Dense editor** — multi-row, multi-column editing surfaces                                    | `md` | gift edit modal, import wizard, batch draft grid                                |
| **Toolbar / chrome**                                                                           | `md` | wishlist + dashboard toolbars, navbar controls (locks in #161's 32 px triggers) |
| **Compact / secondary**                                                                        | `sm` | active-filter pills (#161: 26 px), inline ghost shortcuts                       |
| **Hero / marketing**                                                                           | `xl` | landing hero + CTA buttons, share-method tiles, share wizard actions            |

Rule of adjacency: within one visual group (a form row, a stack, a toolbar), ALL height-bearing controls share one step. When today's group mixes steps, unify to the group's context step (which is always ≥ the larger member after 36/44 are abolished).

### 3.3 Component API changes (REQ-3 + systemic #141)

- **Input** (`base/input/input_variants.ts`, `Input.svelte`): gains a `size` prop — `md` (default, current 32 px metrics: `text-md` 13 px) and **`lg`** (new: `h-(--size-control-lg)`, `text-base` 14 px, horizontal padding stepped up to match Button `lg`'s `px-4` rhythm, e.g. `px-3.5`). The existing `state` prop (default/success/error/loading) is orthogonal and must work at both sizes. No `sm` input (nothing needs it — see §11).
- **Select trigger** (`base/select/select-trigger.svelte`): replace hardcoded `data-[size=default]:h-9` / `data-[size=sm]:h-8` with token-wired sizes `sm` 26 / `md` 32 (default) / `lg` 38, prop vocabulary aligned with Button/Input (`size="sm" | "md" | "lg"`). Existing call sites: `size="sm"` usages (GiftSortSelect, SortDropdown, currency) map to `md` 32 px — zero visual change; unsized usages (priority select) drop 36 → 32 px — intended normalization.
- **Button** (`base/button/button_variants.ts`): gains `size="xl"` (`h-(--size-control-xl)`, `text-lg` 15–16 px, `px-5`) so landing/share stop overriding with `h-12` classes. Existing sm/md/lg/icon/icon-sm unchanged.
- **SearchField**, **DatePicker** (derived): pass the `size` prop through to their Input/Button so form stacks can use them at `lg`.
- **InputGroup** (`base/input-group/`): root `h-9` (36 px) rewired to `md` 32 default with an `lg` variant; the dead `cn-input-group-button-size-sm` class reference (defined nowhere — currently a silent no-op) is fixed as part of this work.
- **Textarea**: NO fixed height, rows-driven — intentionally exempt (REQ-4). Its typography stays aligned with Input `md`.
- Checkbox (16), radio (16), switch (16/22): not on the height scale — they are row accessories, unchanged.

### 3.4 Auth surfaces (REQ-1)

All controls in the auth card become `lg` 38 px: email/password/name inputs, „Přihlásit se" / „Zaregistrovat se" submits (already `lg`), „Poslat kouzelný odkaz", „Přihlásit přes Google", and the resend-verification button. Same on magic-link, reset-request, and reset-set pages. This matches the anime-auth mockup's intent, where the primary, magic-link, and Google buttons share identical metrics. The custom auth-tab nav (~40 px) is navigation, not a form control — untouched (see §9).

### 3.5 Create-list dialog

Recipient segmented control, recipient-name input, title input, date picker, and footer „Zrušit" + „Vytvořit" all become `lg` 38 px (acceptance criterion: dialog inputs match the primary-button height). The small „Importovat" ghost shortcut is a secondary inline affordance and stays `sm`.

### 3.6 Gift edit modal (REQ-5)

- Whole modal unifies on `md` 32 px (dense-editor context): the only height change is priority select 36 → 32. Submit/received/delete buttons stay `md`.
- **Price/currency row alignment**: the misalignment root cause is unequal LABEL rows, not the controls. Requirement: in any `formRow` (two-column grid), the label rows of both columns render at one shared height and the control rows start at the same y. Concretely: the price column's label row (Label + 16 px range Switch + „Cenové rozpětí" label) defines the row height; the currency column's bare Label row must occupy the same height (e.g. shared `min-h`, `items-center`). Labels align on one baseline; both 32 px controls align top and bottom. The same guarantee applies to every two-column form row in the modal (price/currency, quantity/priority).
- The currency select keeps 32 px but via the token (`md`), not the coincidental `h-8`.

### 3.7 App-wide sweep (REQ-4)

| Group                                              | Today                          | Target                                       |
| -------------------------------------------------- | ------------------------------ | -------------------------------------------- |
| Auth stacks (login, register, magic-link, reset)   | 38 submit vs 32 rest           | all `lg` 38                                  |
| Create-list dialog                                 | all 32                         | all `lg` 38 (except „Importovat" `sm`)       |
| Settings profile / account forms                   | 32 inputs, mixed buttons       | form stacks `lg`; each stack internally uniform |
| Moderator panel (`ModeratorPanel.svelte`)          | `lg` buttons near `md` inputs  | unify each row/stack at `lg`                 |
| Gift edit modal                                    | 32 + one 36 select             | all `md` 32 + row-alignment fix (§3.6)       |
| Dashboard `ViewToggle`                             | `icon-sm` 26                   | `icon` 32 (matches wishlist `GiftViewSwitcher` + #161's 32 px toolbar assumption) |
| Navbar anonymous login button                      | `sm` 26 next to 32 px controls | `md` 32                                      |
| Gift list quick-add circle (`GiftListItem`)        | `size-9` 36                    | `size="icon"` 32                             |
| Share wizard buttons                               | `h-11` 44                      | `xl` 48                                      |
| Share-method tiles (`ShareMethodButton`)           | `h-12` 48 hardcoded            | `Button size="xl"` (token-wired)             |
| Landing hero + CTA buttons                         | `size="lg"` + `h-12` override  | `Button size="xl"`, overrides removed        |
| InputGroup root                                    | `h-9` 36                       | `md` 32 (+ `lg` variant)                     |
| Import wizard inputs                               | 32                             | stays `md` (dense editor)                    |

Exempt: textareas (REQ-4), checkbox/radio/switch, nav pills + auth tabs (navigation), gift-modal reserve/like sticker buttons (~52 px bespoke hero actions per Redesign round-2 delta), calendar day cells (32 px, not a control), table rows.

### 3.8 Copy

No new visible copy. All Czech labels quoted here already exist. Any copy the mockup adds must never use em-dashes (—) in Czech text; use comma, colon, or spaced en-dash.

### 3.9 Dialog chrome styling (added in refinement)

Decisions from the refinement review of Variant A's dialog rendering — implementation scope, not
mockup-only styling:

- **Firmer form labels** (revised — supersedes the earlier "labels → ink" note): the base `Label`
  stays muted-by-role but is darkened and emboldened — ≈62% → ≈72% ink, weight 500 → 600, size
  unchanged (12 px). This preserves the deliberate label→value hierarchy. An app-wide ink flip was
  rejected: it flattens dense forms (e.g. the gift-edit modal's 6+ fields become a wall of
  equal-weight ink) and collides with the ~5 deliberately-muted spots (price-range toggle,
  notification matrix, reserve summary) and the inverted read-only value rows. **Scope the change
  to `Label` only** — do NOT darken the global `--muted-foreground` token; helper/meta/description
  text must stay ~62%. Contrast is a second motivation: 62% navy at 12 px likely fails WCAG AA
  (~3.5:1); ≈72% clears it.
- **Segmented toggle** („Pro mě" / „Pro někoho jiného"): two separate ink-outline buttons with a
  small gap, NOT joined solid-primary segments. Active: accent fill + ink border + sticker shadow;
  inactive: `border-border`, muted text, no shadow. Height `lg` per §3.5.
- **Overlay close button**: the production circled X (`overlayCloseButtonClass`, #164) stays in
  every dialog/sheet. The variant mockup's bare `×` is rejected.
- **Dialog header typography**: title steps up to **22 px (`text-2xl`) DynaPuff semibold** on the
  app's own scale — NOT the mockup's off-scale 21 px / Noto Sans. (The variant links the legacy
  `designs/tokens.css` — Noto Sans + a larger scale — which is NOT the live `src/app.css`:
  DynaPuff headings, Geist body, scale `xs 11 · sm 12 · base 14 · lg 15 · xl 17 · 2xl 22 · 3xl 28`.)
  **Revised after visual review**: an initial pass sized this at `text-xl` (17 px, converging on
  `GiftDraftDialog`/`GiftDetailView`); user compared both sizes directly (devtools) and preferred
  the larger title. Since the live scale has nothing at 21 px, `text-2xl` (22 px) — already used
  for empty-state headings — is the nearest on-scale token, visually equivalent to 21 px without
  inventing a bespoke value. Description stays `text-sm` (12 px) muted with a tight gap. One
  shared change in base `Dialog.Title`.
- **Title/heading ladder** (app-wide standard settled in this review, on the DynaPuff scale):
  page `clamp(26–34)` → dialog & section/empty-state `text-2xl` 22 → content-card `text-xl` 17
  → dense/utility card `text-base` 14. Fold the current card-title sprawl (12 / 14 / 16 / 17) onto
  these two card tiers; 17 px "content heading" (gift & wishlist cards) is already the de-facto
  standard, 14 px stays for settings/utility cards.
- **Secondary-text consolidation** (mechanical — delegate to Haiku/Sonnet subagents): collapse to
  one helper/description token — `muted-foreground` at 12 px (`text-sm`) — replacing the current
  mix of `foreground-subtle` (55% / 11 px) and `ink-soft`; route field helpers through `HelpText`
  rather than raw `<p>`; and collapse the `muted-foreground` / `ink-soft` name duplication (same
  value, two names).
- Button sticker shadows in dialog footers: already consistent on dev, no action from this brief.

---

## 4. States

Interaction states are already defined by the base components and MUST survive unchanged at every size step; the specimen sheet proves them at each step:

| State                 | Requirement at all sizes                                                                     | Trigger            |
| --------------------- | -------------------------------------------------------------------------------------------- | ------------------ |
| Default               | ink border (2.5 px), sticker shadow per component; height = its step's token                  | —                  |
| Hover (buttons)       | `-translate-y` spring lift + shadow lift — lift distance identical across steps               | pointer over       |
| Focus                 | `outline-ring` 2 px offset ring; ring must not collide with neighbors in dense `md` rows      | keyboard focus     |
| Focus (inputs)        | brand border + hard offset shadow (per current Input focus)                                   | focus              |
| Disabled              | reduced opacity, no lift; height unchanged                                                    | disabled attr      |
| Input `state=error`   | danger border + message; works at `md` AND new `lg`                                           | validation         |
| Input `state=success` | success border; both sizes                                                                    | validation         |
| Input `state=loading` | spinner right-aligned; spinner scales with size step (does not overflow `md`)                 | async validation   |
| Select open           | trigger pressed look + panel; panel item heights unchanged (independent of trigger size)      | click/Enter        |
| Aligned form row      | two-column label rows equal height, control tops flush (§3.6)                                 | always             |

---

## 5. Component Reuse Map

### Existing Components (MUST use / extend)

| Component                  | Variant/Props                                        | Usage in This Design                                          |
| -------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| `Button` (base)            | sizes `sm 26 / md 32 / lg 38 / icon 32 / icon-sm 26` + **new `xl` 48** | all button surfaces; `lg` in form stacks, `xl` hero/share |
| `Input` (base)             | **new `size="md" \| "lg"`** prop, `state` orthogonal | all text fields; `lg` in form stacks                          |
| `Select.Trigger` (base)    | **rewired sizes `sm 26 / md 32 / lg 38`** via tokens | currency, priority, sort selects                              |
| `ToggleGroup` (base)       | existing Button-backed sizes                         | create-dialog segmented control at `lg`; view switchers at `icon` 32 |
| `SearchField` (derived)    | + `size` pass-through                                | inherits Input sizes                                          |
| `DatePicker` (derived)     | + `size` pass-through                                | create-dialog event date at `lg`                              |
| `InputGroup` (base)        | root rewired `md`/`lg`; dead `sm` button class fixed | grouped inputs                                                |
| `Label` (base)             | unchanged                                            | label rows in aligned form rows (§3.6)                        |

### Components to Adopt (install from shadcn-svelte)

| Component | Source | Rationale                                            |
| --------- | ------ | ---------------------------------------------------- |
| — none —  |        | this is a token/variant change to existing primitives |

### Components to Design (new)

| Component | Description | Why New                                                                   |
| --------- | ----------- | ------------------------------------------------------------------------- |
| — none —  |             | no new visual components; the deliverable is the scale + variant extensions |

---

## 6. Layout Constraints

- Heights come ONLY from `--size-control-*` tokens via component size variants — no raw `h-8/h-9/h-10/h-11/h-12` on controls after the sweep.
- Within a form row/stack, one step for all height-bearing controls; label rows in multi-column rows share a height (§3.6).
- `lg` inputs and buttons keep the 2.5 px ink border and 7 px `--radius-btn`; the border is inside the token height (box-sizing border-box — 38 px is the outer height).
- Toolbar rows (final per #161): triggers/controls `md` 32, pills `sm` 26 — this brief must not change them.
- Touch targets: `lg` (38) comfortably exceeds 24 px minimum; `sm` (26) is allowed only for secondary affordances, never the sole way to reach a primary action.
- Auth card ~440 px wide; `lg` full-width stack must hold at 390 px viewport without wrapping labels into controls.

## 7. Design Tokens

From `src/app.css` (canonical source; `designs/tokens.css` is reference only):

- Sizes: `--size-control-sm` 26 px, `--size-control-md` 32 px, `--size-control-lg` 38 px, **new `--size-control-xl` 48 px**.
- Type pairing per step: `sm` → `--text-sm` 12, `md` → `--text-md` 13, `lg` → `--text-base` 14, `xl` → `--text-lg` 15 (or 16 px to match landing's current `text-[16px]` — designer picks one, then it is THE value).
- Geometry: `--radius-btn` 7 px (buttons/inputs), `--border-w` 2.5 px ink borders, sticker shadows `--shadow-sticker-sm`/`--shadow-sticker`.
- Fonts: `--font-body` Geist for all control text (never DynaPuff in controls).
- Colors: semantic tokens only (`bg-card`, `border-ink`, `--primary`, `--ring`, …) — wishlist `--wishlist-*` re-mapping and dark mode must keep working untouched.

## 8. Design Constraints (Non-Negotiable)

- Four steps only: 26 / 32 / 38 / 48. No 36, no 44, no bespoke control heights (exemptions listed in §3.7 only).
- Canonical form height = `lg` 38 px = today's primary login button. The login stack (submit, Google, magic link, inputs) is one height (REQ-1, acceptance).
- Create-list dialog controls at `lg` (acceptance).
- Gift-modal price input and currency select pixel-aligned, label rows lined up across both columns (REQ-5, acceptance).
- Textareas keep rows-driven height (acceptance).
- Select trigger, InputGroup, and every swept surface consume the tokens — the fix is systemic, not per-call-site class overrides.
- Toolbar/chrome stays `md` 32 and pills `sm` 26 exactly as specified in `designs/unified-filters/DESIGN_BRIEF_UNIFIED_FILTERS.md` (#161) — no conflict may be introduced.
- Focus rings, hover lifts, and Input `state` treatments work identically at every step.
- Semantic tokens only; wishlist theme + dark mode unaffected.
- Czech copy: never em-dashes.

## 9. Design Freedom

- Exact `xl` typography (15 vs 16 px) and horizontal padding rhythm per step.
- Whether the gift edit modal stays `md` (recommended, dense two-column editor) or steps up to `lg` — if the mockup explores `lg`, it must show the full modal fits at 1440×900 and 390 px without scroll regressions.
- Label-row alignment mechanism visual (shared min-height vs baseline grid) — the constraint is the outcome (§3.6).
- Auth-tab nav (~40 px custom): may optionally be normalized toward the scale, or left as navigation chrome.
- „Importovat" shortcut in the create dialog: keep `sm` ghost or restyle as text link.
- Specimen-sheet layout/annotation style.

## 10. Visual References

- **Internal**:
    - `designs/redesign-2026/sky-final/anime-auth.html` — design intent: primary, magic-link, and Google buttons share one `.btn` metric; inputs slightly smaller but near (production maps this to `lg` stack).
    - `designs/unified-filters/DESIGN_BRIEF_UNIFIED_FILTERS.md` + its current-state PNGs — toolbar context (FINAL, `md` 32 / pills 26).
    - `src/lib/components/base/button/button_variants.ts`, `input/input_variants.ts`, `select/select-trigger.svelte` — current variant metrics.
    - `src/routes/(auth)/login/+page.svelte`, `blocks/auth/SocialLoginButtons.svelte` — the live mismatch.
    - `blocks/gift/GiftDetailForm.svelte` (price/currency row ~lines 736–821) — REQ-5 misalignment.
    - `blocks/wishlist/CreateWishlistModal.svelte` — dialog to step up to `lg`.
- **External**: shadcn/ui size scale (sm/default/lg buttons + inputs sharing height steps) as an interaction-pattern reference only; visual language stays anime-sky.

## 11. Not Included (Scope Exclusions)

- Filter dropdown + pills redesign — #161 (this brief only locks the shared height assumptions).
- Gift edit modal segmented mode section redesign — #183 (absorbed #156).
- Navbar language-switcher typography — #181 (heights of the icon cluster are already 32 px; only type alignment remains there).
- Nav pill link styling (36 px) and auth-tab nav — navigation, not form controls.
- Gift modal reserve/like sticker action bar (~52 px) — bespoke hero actions per Redesign 2026 round-2 decision.
- An `sm` Input variant — no consumer exists; add only when a real surface needs it.
- Checkbox/radio/switch sizing, calendar cell sizing, table row heights.
- Any behavior, validation, or copy changes — heights and alignment only.
