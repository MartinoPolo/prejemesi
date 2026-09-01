# Hard Shadow Style — Design Brief

> **Status**: Refined (Variant B)
> **Refined mockup**: `designs/hard-shadow-style/refined.html`
> **Summary**: `designs/hard-shadow-style/SUMMARY.md`
> **Refinements**: three compact self-previewing choices, Balanced ink values, opaque black option, quiet dark-mode shadows

This appearance control lets each viewer keep the current softly tinted sticker depth, opt into a balanced palette-ink shadow, or choose a fully black offset without changing wishlist content. The design must make color palette and depth style feel like two independent choices, prove the stronger treatment across all ten light palettes, and deliberately define what the same preference does in dark mode.

**Source**: GitHub issue [#290](https://github.com/MartinoPolo/prejemesi/issues/290), follow-up visual experiment from #286

---

## 1. Purpose

Anime Sky already uses hard-offset sticker geometry, but its light-mode shadow color is intentionally translucent: `--hard-shadow` mixes only 16% palette ink and `--hard-shadow-strong` mixes 20%. The #286 gift-action mockup demonstrated that a nearly opaque ink/black offset can create clearer layering and stronger personality. This feature turns that color/intensity choice into a viewer appearance preference instead of changing the default for everyone.

The user's mental model is two independent appearance axes:

1. **Barevná paleta** answers “which colors do I want?”
2. **Hloubka a stíny** answers “how strongly should raised surfaces separate?”

The mockups are a comparison laboratory, not a new product page. They must let the reviewer inspect the same realistic surfaces under every palette, both modes, and multiple candidate shadow systems without mentally translating isolated swatches.

**Key value**: Choose calm or graphic sticker depth independently from color, with predictable results everywhere.

---

## 2. Surrounding Context

The mockup **must** show the full viewport with all chrome at correct proportions.

### Full viewport structure

- **Review strip — MOCKUP-ONLY:** a compact eyebrow row at the top names the variant and exposes its candidate shadow angle. It must not be mistaken for application UI.
- **App shell navbar — FINAL:** 56 px high, white/palette card surface, 2.5 px ink lower border. Reproduce the real desktop order: Přejeme si logo, Moje seznamy, Spravované, Sledované, flexible gap, Vytvořit, notification, appearance/language controls, avatar. At narrow widths, preserve the existing consolidated appearance control rather than inventing extra header controls.
- **Scrollable app region — FINAL:** dotted Anime Sky background from `src/app.css`, below the navbar. The viewer palette themes the app shell.
- **Comparison page container — DESIGNED HERE:** centered, maximum 1200 px, 24 px desktop side padding, 16 px mobile side padding, approximately 32 px vertical rhythm.
- **Appearance card — DESIGNED HERE:** a realistic `SettingsAppearanceSection`-style card near the top. It contains the existing light/dark/system mode control, the ten-palette grid, then a separate labeled `Hloubka a stíny` compact three-option control. Each selectable button renders its own shadow recipe directly; it has no nested preview block or explanatory paragraph. Palette and depth must not share one segmented control or one combined swatch.
- **Live specimen area — DESIGNED HERE:** the dominant viewport region. Show representative dashboard/wishlist surfaces at real proportions: a wishlist card, a 4:3 gift card, the full-width wishlist toolbar, a small alert/sticky panel, primary and outline buttons, and one open popover or dialog sample. The specimen updates when palette, mode, or depth changes.
- **All-palette gallery — DESIGNED HERE:** show all ten light palettes simultaneously in compact but realistic mini-cards. Each tile includes palette name, brand swatch, and identical `Jemné`, `Inkoustové`, and `Černé` examples with enough surrounding background to judge separation. Obloha, Hrozen, Tužka, and other dark-ink palettes must remain especially easy to compare.
- **Dark-mode comparison — DESIGNED HERE:** either a dedicated side-by-side strip or an interactive mode with an always-visible explanation. The chosen variant must communicate whether depth changes in dark mode, not merely inherit light values.

**What the parent provides**: 56 px navbar, global viewer mode, global viewer palette, app-content scroll container, canonical Anime Sky typography/tokens, focus behavior, and appearance persistence infrastructure.

**What this component fills**: the new depth-control row in appearance settings/consolidated appearance UI plus the token-level visual treatment on existing raised surfaces.

**Excluded — belongs to the parent**: wishlist theme selection, wishlist data, reservation state, navigation behavior, profile settings, and persistence transport.

**Mockup rendering instructions**:

- Full viewport at approximately 1440×900; page may scroll vertically to the complete ten-palette gallery.
- The first viewport must include the appearance controls and enough live specimens to judge the active combination.
- Provide interactive controls for all ten palettes, light/dark mode, and all three `Jemné` / `Inkoustové` / `Černé` depth styles.
- Provide a one-click `Porovnat vedle sebe` or equivalent side-by-side view so the only changed variable is depth.
- Other app-shell elements are settled context and must not become alternative navigation designs.
- Also render safely at 390×844 with no horizontal overflow; the palette gallery becomes one column or a horizontally safe two-column grid.

---

## 3. Requirements

### 3.1 Independent appearance controls

- Keep mode, palette, and depth as three separately labeled settings.
- Mode options use the existing light / dark / system mental model.
- Palette options use all production keys and Czech labels: `sky` Obloha, `mint` Máta, `peach` Broskev, `grape` Hrozen, `sakura` Sakura, `ocean` Oceán, `honey` Med, `ruby` Malina, `matcha` Matcha, `graphite` Tužka.
- Depth has exactly three product choices:
  - `Jemné` — current production treatment and default;
  - `Inkoustové` — balanced palette-derived stronger treatment;
  - `Černé` — fully opaque black hard offset.
- Present these as one compact row of minimum 48 px selectable buttons. Each button uses its own shadow recipe as its actual `box-shadow`, including while unselected, so no nested preview sample is needed.
- Keep only the option name and selected indicator. Do not add persistent secondary descriptions; exact formulas belong in design/review documentation rather than the production control.
- Selection remains explicit through `aria-pressed`, ink border, surface change, and radio-style mark. Shadow or color alone cannot communicate selection.
- Selecting a palette never changes depth. Selecting depth never changes palette or wishlist theme.
- In the mockup, update instantly and store the three demo settings in localStorage so comparisons survive reloads.

### 3.2 Current/default depth baseline

- Preserve the current production baseline precisely enough for honest comparison:
  - light `--hard-shadow`: palette ink mixed 16% into transparency;
  - light `--hard-shadow-strong`: palette ink mixed 20% into transparency;
  - dark `--hard-shadow`: near-black at 42% opacity;
  - dark `--hard-shadow-strong`: near-black at 55% opacity;
  - geometry: 2 px small, 4 px standard, 7 px lifted; no blur.
- `Jemné` is selected on first use and remains the migration/default behavior.
- Do not quietly strengthen borders or backgrounds in the baseline column to make the comparison easier.

### 3.3 Historical depth explorations and approved decision

The design review held content and layout constant while exploring three historical candidate systems:

- **Variant A — Pure palette ink:** opaque or nearly opaque `--p-ink` hard offsets in light mode; dark mode deliberately returned to the current dark shadow values so the preference was light-only. This was the closest expression of #286's pure ink context-menu/toast shadow.
- **Variant B — Balanced ink:** darker palette-derived offsets in light mode, strong but not fully opaque, with a restrained near-black increase in dark mode. This provided an everyday setting that adds depth without turning every surface into a comic panel.
- **Variant C — Layered depth:** a crisp palette-ink hard offset plus a subtle ambient shadow on large surfaces only. In dark mode, it considered a dark core plus a faint palette-bright separation/rim for legibility, while controls and micro-surfaces kept crisp offset only.

The historical mockups exposed exact candidate values in mockup-only annotation panels so review feedback did not depend on color sampling.

**Approved final decision — Variant B:** use all three compact choices. `Inkoustové` uses palette ink at 58% / 68% in light mode and near-black at 48% / 62% in dark mode. `Černé` uses opaque `#000` in both modes. Dark mode intentionally keeps physical shadows dark rather than inverting them to white; light ink borders and surface color differences remain the primary boundaries.

### 3.4 Shared surface scope

The setting is semantic and token-driven. It applies consistently wherever the application intentionally uses sticker depth:

- `shadow-sticker-sm`, `shadow-sticker`, `shadow-sticker-lift`, and `shadow-sticker-strong` utilities;
- card roots, wishlist cards, gift cards, dashboard list rows, toolbar panels, settings cards, and landing feature panels;
- primary, secondary, outline, and danger sticker buttons that currently carry a hard shadow;
- popovers, dropdown menus, select menus, dialogs, sheets, toasts, and tooltips;
- paper artifacts and raised decorative objects already tied to `--hard-shadow` or `--hard-shadow-strong`, including polaroids and sticky notes;
- small direct uses such as slider thumbs, keyboard-key caps, image-preview tiles, reserved stickers, and Lucide-backed action chips.

The setting does **not** change:

- 2.5 px ink borders, focus outlines/rings, validation rings, selection rings, or text color;
- background/palette derivation, dotted/ruled patterns, image veils, opacity, or saturation;
- elements that intentionally have no shadow (`ghost` controls, flat nav links, separators);
- layout spacing or reserved space: changing depth must not cause reflow.

### 3.5 Live specimen content

Use realistic Czech content and production proportions:

- a wishlist card for `Vánoce u Nováků` with a 128 px banner, status chip, recipient row, metadata, and progress only where the specimen is explicitly non-recipient;
- a 4:3 gift card for `Vlněná deka s třásněmi`, plausible price, priority, store link, and a heart action;
- a full-width wishlist toolbar with 32 px controls and current view/sort/filter grouping;
- a warning or note panel with Czech copy and a small raised chip;
- primary `Vytvořit seznam`, outline `Filtrovat`, ghost icon button, and a visible keyboard-focus sample;
- one open palette/depth popover or small dialog, plus a toast, to prove overlay boundaries.

Keep the recipient privacy invariant: an owner-context specimen never shows reservation counts, state, or names.

### 3.6 All-palette validation gallery

- Render all ten palette tiles in light mode in one continuous gallery; no palette may be hidden behind a dropdown for this check.
- Every tile compares `Jemné`, the refined `Inkoustové` treatment, and `Černé` on identical mini surfaces.
- Include at least a card/panel and a control/overlay sample per palette; pure swatch circles are insufficient.
- The palette's background, card, ink border, brand button, and accent note must all be visible.
- Flag likely contrast/balance concerns with mockup-only notes; do not solve them through per-palette one-off values unless the variant is explicitly testing a derivation rule.
- Med's alternate accent and Tužka's neutral family must be represented accurately.

### 3.7 Dark mode behavior

- Dark mode remains derived from the same palette primitives.
- The refined Variant B deliberately preserves dark shadows rather than swapping to white offsets: `Jemné` uses near-black 42% / 55%, `Inkoustové` uses near-black 48% / 62%, and `Černé` uses opaque black.
- Each variant explicitly states and demonstrates its rule:
  - A: `Inkoustové` is a light-only visual preference; both choices map to the current dark values.
  - B: `Inkoustové` remains subtly stronger in dark mode but never reaches opaque black; the separate `Černé` choice deliberately does.
  - C: large surfaces receive layered separation appropriate to dark mode; micro-surfaces remain crisp and restrained.
- Dark shadows must not merge cards into the background or reduce popover/dialog boundaries.
- Focus outlines and 2.5 px ink borders remain the primary accessibility boundary in all three styles.
- System mode follows the device mode while preserving the selected depth preference.

### 3.8 Responsive and accessibility behavior

- At 390 px, the settings card stacks labels and controls; palette choices remain at least 44 px touch targets even if the visible swatches are smaller.
- The three depth buttons remain in one compact row at 390 px. Labels may wrap without clipping; at narrower unsupported widths they may stack.
- The specimen grid becomes one column and overlays are presented in-flow if a floating sample would overflow.
- Every setting control has a programmatic label and visible selected state; keyboard focus is always visible independently of shadow style.
- `prefers-reduced-motion` removes lift transitions but does not remove the static depth distinction.
- Shadow-only differentiation is never used for status, selection, error, or focus.

### 3.9 Persistence contract shown by the design

- Depth is a viewer appearance preference, never a wishlist field.
- Mockup persistence uses its own localStorage key only for prototype continuity.
- Product implementation should mirror the palette preference model: logged-in user preference plus cookie mirror for SSR; anonymous viewer cookie only.
- The selected depth must apply before first paint to avoid a flash from `Jemné` to another stored choice.
- Navigating into a wishlist with its own color palette keeps the viewer's depth choice while the wishlist subtree changes color primitives.

---

## 4. States

| State | Visual Treatment | Trigger |
| --- | --- | --- |
| Default depth | `Jemné` selected; exact current translucent shadow values | First use, migration, reset |
| Ink depth | Balanced palette-ink values in light mode and restrained near-black values in dark mode | User selects `Inkoustové` |
| Black depth | Opaque black hard offset in both modes | User selects `Černé` |
| Palette selected | Swatch, text label, border/check indicator; specimen and page colors update | User chooses one of ten palettes |
| Light mode | Full palette-derived page plus chosen depth | Explicit light or light system preference |
| Dark mode | Midnight-notebook tokens plus variant's documented dark rule | Explicit dark or dark system preference |
| System mode | Current OS mode indicator; depth choice unchanged | User selects system |
| Compare mode | Three identical specimens side by side with locked palette/mode/content | User opens comparison |
| Palette gallery | All ten light palettes visible with three-way depth examples | Reviewer scrolls below live specimen |
| Hover/lift | Offset grows from standard 4 px to 7 px without hit-area flicker | Pointer hover where current component supports lift |
| Pressed | Raised control returns toward 2 px/static depth | Pointer/key activation |
| Keyboard focus | Existing outline/ring remains distinct from border and shadow | Keyboard navigation |
| Open overlay | Popover/dialog/toast keeps crisp boundary above content | Trigger opened/sample enabled |
| Mobile stacked | Settings and specimens become one column; no clipping | Width below 640 px |
| Reduced motion | Static shadows remain, translations/animated lifts stop | OS reduced-motion preference |
| Persistence restored | Mode, palette, depth controls and tokens match stored values before interaction | Reload/navigation |
| Persistence failure | Visual selection remains for session; non-blocking error may be logged | Save call fails |

---

## 5. Component Reuse Map

### Existing components (use these)

| Component | Variant/Props | Usage in this design |
| --- | --- | --- |
| `SettingsAppearanceSection` | Existing mode ToggleGroup, inline PaletteSwitcher, autosave footer | Parent structure for the new separate depth row |
| `PaletteSwitcher` | `variant="inline"` and `variant="popover"` | Existing ten-palette grid and header access |
| `DarkModeToggle` | `variant="inline"` / icon cycle | Existing mode behavior and compact appearance UI |
| `AppearanceMenu` | Popover with palette, language, mode sections | Add a compact depth section without adding another narrow-header button |
| `ToggleGroup` | `type="single"`, 32 px controls | Light/dark/system selection in settings |
| `Card` | default root, 2.5 px border, 16 px radius | Settings card and specimen panel |
| `Button` | `intent="primary" | "outline" | "secondary" | "ghost"`, production sizes | Control and action specimens |
| `WishlistCard` | standard non-archived presentation | Dashboard specimen |
| `GiftCard` | normal non-dimmed presentation | Wishlist gift specimen |
| `WishlistDetailToolbar` | existing 32 px controls | Full-width participating sticker panel |
| `Alert` | calm or warning tone | Note/warning specimen |
| `Popover` / `Dialog` / global toast | existing bordered sticker surfaces | Overlay-depth validation |

### Components to adopt

| Component | Source | Rationale |
| --- | --- | --- |
| None | Existing project primitives | The experiment changes semantic depth tokens and appearance controls; no missing library primitive is required. |

### Components to design

| Component | Description | Why new |
| --- | --- | --- |
| `DepthStyleSwitcher` | Three compact self-previewing buttons for `Jemné` / `Inkoustové` / `Černé`, with inline and popover layouts | Palette and mode controls cannot accurately preview depth semantics |
| `DepthComparisonSpecimen` | Storybook/design-only matrix of representative card, control, paper, and overlay surfaces across palettes/modes | Needed to regression-check a global token preference without hand-testing arbitrary pages |

---

## 6. Layout Constraints

- Full desktop viewport: approximately 1440×900.
- Navbar: 56 px; review strip, if present, no taller than 40 px.
- Content: maximum 1200 px; 24 px desktop side padding, 16 px mobile.
- First viewport: appearance card approximately 340–420 px wide and live specimen remainder; below 960 px, stack.
- Live specimen gift/wishlist card columns use a minimum 280 px width; 20 px gap.
- All-palette gallery: 2 columns on desktop if each comparison tile stays at least 500 px, otherwise one column; one column on mobile.
- Participating hard-offset shadows must have enough surrounding space so 7 px lift never clips.
- Controls use the production 26/32/38/48 px scale; setting option touch targets are at least 44 px.
- No candidate changes element box metrics, border width, radius, or DOM order.
- Czech labels tolerate 30% text expansion without clipping.

---

## 7. Design Tokens

`src/app.css` is canonical. `designs/tokens.css` remains linked by pipeline convention but its Figtree/Noto and soft-shadow reference values do not override the current app source.

- **Fonts:** `--font-head: 'DynaPuff Variable'`; `--font-body: 'Geist Variable'`.
- **Palette primitives:** `--p-brand`, `--p-deep`, `--p-ink`, `--p-bright`, optional `--p-accent`, optional `--p-on-accent`.
- **Current light depth:** `--hard-shadow: color-mix(in oklab, var(--p-ink) 16%, transparent)`; strong 20%.
- **Current dark depth:** `rgb(2 6 12 / 42%)`; strong 55%.
- **Geometry:** `--shadow-sticker-sm: 2px 2px 0`; standard 4 px; lift 7 px; strong uses standard geometry with strong color.
- **Surfaces:** `--background`, `--card`, `--popover`, `--surface`, `--panel-hover`, `--border`, `--border-strong`.
- **Boundaries:** `--ink`, `--ring`, `--invalid-ring`, `--invalid-border`; depth style must not replace these.
- **Motion:** 200 ms standard, 300 ms slow, spring lift `cubic-bezier(.34,1.56,.64,1)` under no-reduced-motion media query.
- Candidate derivation uses `color-mix(in oklab, …)`, never OKLCH mixing and never per-component hard-coded shadow colors.

---

## 8. Design Constraints (non-negotiable)

- `Jemné` stays the default and is visually identical to current production behavior.
- Palette, dark mode, and depth are independent preferences with separate labels and controls.
- Evaluate every supported light palette in the artifact, not just Obloha.
- Define dark mode deliberately in each variant.
- Apply depth through shared semantic tokens; no arbitrary per-component overrides or palette-specific exceptions.
- Do not alter focus rings, borders, state colors, selection rings, validation, layout, or content to compensate for a shadow candidate.
- Controls and overlays remain coherent; popovers/dialogs cannot lose boundary contrast.
- The preference belongs to the viewer and must never mutate wishlist data.
- The wishlist's own palette can change inside its subtree while the viewer depth preference remains active.
- Use DynaPuff/Geist, Anime Sky geometry, 2.5 px ink borders, production control heights, and project Lucide icon conventions.
- Czech copy uses formal address where applicable and avoids em dashes.
- Light mode is the source of truth; dark adaptation must remain palette-derived and accessible.
- Mockups link `../../tokens.css`, load local project fonts, avoid external image dependencies, and have no console errors.

---

## 9. Design Freedom

- Exact Czech product label for the preference (`Hloubka a stíny`, `Stínování`, or an equally clear option) may be compared, but palette and depth must stay visibly separate.
- Exact opacity/derivation of Variants B and C within their stated angle.
- Whether the all-palette gallery uses paired mini-cards or a baseline/candidate split tile.
- The dark-mode rim/ambient recipe in Variant C, provided it remains token-driven and restrained.
- Micro-animation for changing depth or compare mode within existing motion tokens.
- Placement of mockup-only formulas/annotations so long as they are clearly not application UI.

---

## 10. Visual References

- **Canonical tokens:** `src/app.css` — all ten palettes, light/dark derivation, semantic hard-shadow tokens.
- **Appearance controls:** `src/lib/components/blocks/settings/SettingsAppearanceSection.svelte`, `src/lib/components/derived/appearance-menu/AppearanceMenu.svelte`, `src/lib/components/derived/palette-switcher/PaletteSwitcher.svelte`, `src/lib/components/derived/dark-mode-toggle/DarkModeToggle.svelte`.
- **Raised production surfaces:** `src/lib/components/base/card/card_variants.ts`, `src/lib/components/base/button/button_variants.ts`, `src/lib/components/base/popover/popover-content.svelte`, `src/lib/components/base/dialog/dialog_variants.ts`.
- **Representative cards:** `src/lib/components/blocks/dashboard/wishlist_card_variants.ts`, `src/lib/components/blocks/gift/gift_card_variants.ts`.
- **Anime Sky visual source:** `designs/redesign-2026/sky-final/anime-sky-final.html` and `anime-dashboard.html`.
- **Pure-ink discovery:** `designs/wishlist-gift-actions/refined.html` in the #286 design worktree, especially its context menu, toast, confirmation, and mobile-phone shadows.

---

## 11. Not Included (scope exclusions)

- Implementing the persisted user field, cookie, SSR attribute, remote function, or migration.
- Changing any wishlist theme/palette data or adding custom colors.
- Adding more than three product depth options.
- Redesigning card layout, toolbar actions, navigation, gift actions, or settings information architecture.
- Blur, glassmorphism, glow, or elevation systems unrelated to the Anime Sky sticker language.
- Per-palette sliders or per-component shadow customization.
- Replacing ink borders, focus rings, or accessibility state indicators with shadow alone.
- Alternative variants are not part of the approved final artifact; they remain historical exploration material only.
