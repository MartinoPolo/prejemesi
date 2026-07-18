# Unified Filters (Dropdown + Active-Filter Pills) — Design Brief

> **Status**: Refined (Variant A)
> **Refined mockup**: `designs/unified-filters/refined.html`
> **Summary**: `designs/unified-filters/SUMMARY.md`
> **Refinements**: dashboard gap-fill pill placement (trigger moved to front of toolbar cluster, pills grow leftward), mobile (< 640 px) pill-less mode on both surfaces (count badge carries state), clear-all as dropdown item on mobile

One consistent filtering pattern for both list/gift toolbars: a single **filter dropdown trigger** where the user checks filters, and each active filter becomes a **removable pill** in the toolbar. Removing a pill (its ×) or unchecking the item in the dropdown clears that filter; the two stay in sync. This replaces today's inconsistent mix: a permanent "Pouze dostupné" chip + hidden icon-menu filters with only a dot-badge (wishlist), and permanent `FilterChip` toggles (dashboard).

**Source**: issue #161 (supersedes #101; relates to #104 — future category filters must plug into the same dropdown).

---

## 1. Purpose

Filtering currently surfaces three different ways, so users cannot build one mental model:

- **Wishlist gift toolbar**: "Pouze dostupné" is always visible as a chip; "S odkazem" and "Oblíbené" hide inside a filter-icon dropdown and, when active, show only a tiny dot-badge on the icon — the active state is nearly invisible.
- **Dashboard toolbars** (Moje seznamy / Spravované / Sledované): "Archivované" and "Opuštěné" are permanent toggle chips that occupy toolbar space even when unused.

The unified model answers two questions at a glance: *"What can I filter by?"* (open the one dropdown) and *"What is filtering my view right now?"* (read the pills). Decision 2026-07-15: dropdown → removable-pill model everywhere; "Pouze dostupné" loses its permanent chip.

**Key value**: active filters are always visible as removable pills, and every filter lives in exactly one predictable place.

---

## 2. Surrounding Context

The mockup **MUST** show the full viewport with all chrome elements at correct proportions. Two surfaces, two mockup viewports. Current-state screenshots (reproduce chrome faithfully from these):

- `designs/unified-filters/current-wishlist-toolbar.png` — wishlist detail as gifter (Petr), Christmas-themed list
- `designs/unified-filters/current-dashboard-my-lists.png` — Moje seznamy as recipient (Martin)
- `designs/unified-filters/current-dashboard-followed.png` — Sledované as gifter (Petr), both dashboard filters visible

### Surface A: Wishlist detail toolbar (`/w/<shortId>`)

Full viewport, top to bottom (all elements FINAL except the toolbar filter area):

1. **App header** (~56 px, FINAL): logo, nav pills (Moje seznamy / Spravované / Sledované), right cluster (Importovat dárky, Vytvořit, bell, palette, CZ, dark-mode, avatar).
2. **Notebook header panel** (FINAL): spiral-notebook card with taped polaroid image, „Pro: Martin Novák", DynaPuff title „Vánoce 2026", description, meta chips (Sdíleno, event date, „Spravují …"), taped sticky-note countdown top-right.
3. **Sticker toolbar panel** (THE DESIGN AREA): full-content-width rounded panel, `rounded-panel` (16 px), `border-[2.5px] border-ink`, `bg-card`, `px-3.5 py-2.5`, `shadow-sticker`, `flex flex-wrap items-center gap-2.5`. Current contents left→right:
    - `GiftViewSwitcher` (grid/list/compact icon toggle, FINAL — keep)
    - `GiftSortSelect` („Výchozí pořadí" select, height `--size-control-md` 32 px, FINAL — keep)
    - **permanent chip „Pouze dostupné"** (REMOVED by this design)
    - **filter icon button with dot-badge** (`GiftFilterOverflowMenu`, REPLACED by the new dropdown trigger + pills)
    - right cluster `ml-auto` (role-gated, FINAL — keep): for a visitor just „Přestat sledovat" ghost button; for a manager palette/settings/import/export/batch-add icon buttons + primary „Přidat přání" button.
4. **Gift card grid** (FINAL): 3-column sticker cards.

**Important**: the wishlist page is tinted by per-wishlist theme tokens (`--wishlist-*`); on the Christmas fixture the panel and cards render cream/red instead of the app's sky blue. The new filter UI must inherit these tokens automatically by using semantic tokens only (`bg-card`, `border-ink`, `bg-primary`, …) — never hardcoded colors.

### Surface B: Dashboard page header toolbar (Moje seznamy / Spravované / Sledované)

Full viewport, top to bottom (all FINAL except the filter area):

1. **App header** (same as above).
2. **PageHeader row** (`page_header_variants.ts`): DynaPuff page title left („Moje seznamy" / „Sledované"), toolbar right, one wrapping row (`flex flex-wrap items-center justify-between`). Toolbar (`DashboardToolbar`) contents left→right:
    - `SortDropdown` („Řazení: Poslední aktivita", FINAL — keep)
    - `ViewToggle` (grid/list, FINAL — keep)
    - **permanent `FilterChip` „Archivované"** (+ „Opuštěné" on Sledované only) (REPLACED by the new dropdown trigger + pills)
3. **Wishlist card grid** (FINAL): 3-column sticker cards with banner image, status chip, meta chips.

**What parent provides**: app header, page/notebook headers, grids — reproduce, do not redesign.
**What this component fills**: only the filter zone inside each existing toolbar (trigger + pills + clear-all).
**Must NOT include**: navigation chrome redesign, sort/view control redesign, card redesign.

**Mockup rendering instructions**:

- Two desktop viewports at ~1440×900, one per surface, chrome reproduced from the screenshots above.
- Per surface show at least: (a) dropdown OPEN with ≥1 item checked, (b) closed state with 2–3 active pills + clear-all visible.
- Wishlist surface must use the Christmas-tinted theme from the screenshot to prove token inheritance; dashboard uses default sky-blue.
- Add one narrow (~390 px) strip of the wishlist toolbar showing wrap behavior with 2 pills.

---

## 3. Requirements

### 3.1 Filter dropdown trigger (REQ-1)

- Exactly one trigger per toolbar. Wishlist: after the sort select (where the current filter icon sits). Dashboard (refined 2026-07-18): at the FRONT of the right-aligned toolbar cluster, before the sort select, so pills can grow leftward into the title↔toolbar gap without moving sort/view controls.
- Opens a `DropdownMenu` listing every filter available to the current viewer as checkbox items (checked = active).
- The trigger replaces: the „Pouze dostupné" permanent chip, the wishlist overflow filter icon + dot-badge, and both dashboard `FilterChip`s.
- Trigger must read as a filter control (lucide `list-filter` icon; label „Filtrovat" recommended — see Design Freedom for icon-only option).
- Dot-badge-only active indication is explicitly banned (acceptance criterion); pills carry the active state on desktop. The trigger additionally shows a numeric count badge whenever ≥1 filter is active; on mobile (< 640 px) this labeled count badge alone carries the active state (refined 2026-07-18 — a count on a labeled „Filtrovat" button is not a dot-badge).

### 3.2 Dropdown contents per surface (REQ-4, REQ-5, REQ-7)

Wishlist gift filters (state: `GiftFilters` in `gifts.context.svelte.ts`; existing Czech labels from `messages/cs.json`):

| Filter | Label (existing key) | Semantics | Visibility gate |
| --- | --- | --- | --- |
| availableOnly | „Pouze dostupné" (`gift_filter_available_only`) | hides fully reserved gifts | hidden for the recipient (never sees reservation state — core invariant) |
| withLinkOnly | „S odkazem" (`gift_filter_with_link`) | keeps gifts with ≥1 link | everyone |
| likedOnly | „Oblíbené" (`gift_filter_liked`) | keeps the viewer's liked gifts | authenticated non-recipients only |

Dashboard list filters (state: `showArchived` / `showUnfollowed` page state):

| Filter | Label (existing key) | Semantics | Visibility gate |
| --- | --- | --- | --- |
| archived | „Archivované" (`dashboard_show_archived`) | ALSO shows archived lists (dimmed, at the bottom) | all three dashboard pages |
| unfollowed | „Opuštěné" (`dashboard_show_unfollowed`) | ALSO shows unfollowed lists (dimmed, with „Znovu sledovat") | Sledované page only |

- Gated filters are absent from the dropdown entirely (not disabled).
- **Semantic nuance**: wishlist filters NARROW the view; dashboard filters INCLUDE extra items. The pattern must read correctly for both (see Design Freedom re: labeling/grouping).
- Filter behavior itself is unchanged — this is purely a surfacing redesign.

### 3.3 Active-filter pills (REQ-2, REQ-3)

- Checking an item in the dropdown immediately applies the filter and adds a labeled pill to the toolbar; no confirm step.
- Each pill = filter label + × remove affordance. Clicking × clears that filter and removes the pill.
- Dropdown checkboxes and pills are two views of the same state, always in sync.
- Pills appear in the toolbar flow adjacent to the trigger, growing AWAY from it into empty space (decided 2026-07-18): wishlist pills render after the trigger and grow rightward; dashboard pills render before the trigger and grow leftward into the title↔toolbar gap. First-activated pill sits closest to the trigger on both surfaces. Sort/view controls must never shift when pills toggle.
- Zero active filters → zero pills, no reserved empty space.
- **Mobile (< 640 px / Tailwind `sm`), both surfaces**: pills are not rendered at all; the count badge on the trigger is the sole persistent active-state indicator (decided 2026-07-18).

### 3.4 Clear all (REQ-8)

- When ≥1 filter is active, a „clear all" affordance appears (existing copy candidate: „Zrušit filtry", key `wishlist_detail_clear_filters`).
- One interaction removes every active filter on that surface.
- **Placement (decided 2026-07-18)**: desktop = ghost button in the pill row (wishlist: after the last pill; dashboard: leftmost, before the pills). Mobile (< 640 px) = last dropdown item behind a `Separator`, rendered only when ≥1 filter is active.
- The existing filtered-empty state (`WishlistEmptyState`: 🔍 „Žádná přání neodpovídají filtrům" + „Zrušit filtry" button) stays and must remain consistent with the toolbar's clear-all.

### 3.5 Overflow behavior (REQ-8)

- Both toolbars are `flex-wrap`; with several pills the row wraps to a second line. The wishlist right-side action cluster (`ml-auto`) must remain reachable and visually intact when pills wrap.
- Max realistic pill count today: 3 (wishlist) / 2 (dashboard). Design for ~5+ (categories are coming, #104): define truncation for long labels (`truncate` on pill label, full text via `title`/tooltip) and the wrap pattern.

### 3.6 Extensibility (REQ-9, REQ-6)

- The dropdown and pill row must be config-driven shared derived components (filter definitions: id, label, gate), consumed by both toolbars — not two bespoke implementations.
- Structure the dropdown so a future „Kategorie" section (multi-select, from #104) can be added as a second `DropdownMenu.Group` without layout rework. Show this in the mockup only if it helps composition; it is NOT part of this scope.

### 3.7 Accessibility (acceptance criterion)

- Trigger: keyboard focusable, `aria-label`, visible focus ring (`focus-visible:outline-ring` pattern from Button).
- Dropdown: Bits UI `DropdownMenu.CheckboxItem` semantics (menuitemcheckbox, arrow-key navigation) — comes free with the base component.
- Pills: each remove control is a real `<button>` with Czech `aria-label` naming the filter (e.g. „Zrušit filtr: Oblíbené"). After removing a pill, focus moves to the next pill or back to the trigger — never lost to `<body>`.
- Clear-all: focusable button with visible label or `aria-label`.
- All visible Czech copy: NEVER use em-dashes (—); comma/colon/spaced en-dash instead.

---

## 4. States

| State | Visual Treatment | Trigger |
| --- | --- | --- |
| Trigger default | outline sticker button (matches `GiftSortSelect`/icon buttons: `border-ink bg-card shadow-sticker-sm`) | no interaction |
| Trigger hover | `hover:bg-accent` + `-translate-y-px` lift (Button `outline` intent behavior) | pointer over |
| Trigger open | pressed/active look; dropdown panel below, `align` matching toolbar side | click/Enter/Space |
| Trigger focus | 2 px `outline-ring` offset ring | keyboard focus |
| Dropdown item unchecked | plain menuitem with empty check slot | filter inactive |
| Dropdown item checked | check indicator + label | filter active |
| Dropdown item hidden | not rendered at all | role/auth gate fails |
| Pill default | ink-bordered rounded-full pill, filled treatment signalling "active" (see §9), label + × | filter activated |
| Pill × hover | affordance emphasis on the × only (not the whole pill) | pointer over × |
| Pill focus | focus ring on the × control | keyboard focus |
| Pill removal | pill disappears, view updates instantly; motion-safe exit animation optional | × clicked / item unchecked / clear-all |
| Clear-all visible | compact text/ghost affordance near the pills | ≥1 filter active |
| Clear-all hidden | absent (no reserved space) | 0 filters active |
| Wrapped toolbar | pills flow to a second row inside the panel; right action cluster stays aligned | narrow viewport or many pills |
| Filtered-empty result | existing `WishlistEmptyState` 🔍 + „Zrušit filtry" (unchanged, must feel connected) | filters remove all items |
| Recipient view (wishlist) | dropdown shows only „S odkazem" (no available, no liked) | viewer is the recipient |
| Anonymous visitor (wishlist) | dropdown shows „Pouze dostupné" + „S odkazem" (no liked) | not authenticated |
| Mobile, filters active | no pills; count badge on trigger; „Zrušit filtry" as last dropdown item behind separator | viewport < 640 px, ≥1 filter active |
| Mobile, no filters | trigger without count badge; no clear-all item in dropdown | viewport < 640 px, 0 filters active |

---

## 5. Component Reuse Map

### Existing Components (MUST use)

| Component | Variant/Props | Usage in This Design |
| --- | --- | --- |
| `DropdownMenu` (base, `$lib/components/base/dropdown-menu`) | `Root` + `Trigger` (snippet-child) + `Portal` + `Content` + `Group` + `GroupHeading` + `CheckboxItem` | the filter dropdown (same primitives `GiftFilterOverflowMenu` uses today) |
| `Button` (base) | `intent="outline"`; size `md` with label, or `icon` if icon-only | dropdown trigger |
| `Button` (base) | `intent="ghost"` `size="sm"` | clear-all affordance candidate |
| Badge pill metrics (base badge, `size="lg"`) | `h-(--size-control-sm)` (26 px), rounded-full, `text-sm` | METRICS reference for pill sizing (pills are interactive, so they are a new derived component, not `Badge` itself) |
| `SimpleTooltip` (base tooltip) | text | full label of a truncated pill; optional trigger hint |
| Lucide icons | `list-filter`, `x`, `check` | trigger icon, pill remove, checkbox indicator |

### Components to Adopt (install from shadcn-svelte)

| Component | Source | Rationale |
| --- | --- | --- |
| — none — | | base `dropdown-menu`, `button`, `badge`, `tooltip` cover everything |

### Components to Design (new derived components, REQ-6)

| Component | Description | Why New |
| --- | --- | --- |
| `FilterMenu` (derived) | config-driven dropdown: takes filter definitions (id, label, checked, gated) + change callback; renders trigger + CheckboxItems | pattern used on 2+ surfaces; today duplicated/bespoke |
| `ActiveFilterPill` / pill row (derived) | removable pill (label + × button) and the wrapping row incl. clear-all | no existing interactive-pill component; `Badge` is non-interactive; `FilterChip` is a toggle, not a removable pill |

### Retired by this design

| Component | Fate |
| --- | --- |
| `FilterChip` (derived) | removed from both toolbars; delete if no other consumer remains |
| `GiftFilterOverflowMenu` (block) | replaced by `FilterMenu` |

---

## 6. Layout Constraints

- Wishlist toolbar panel keeps its exact shell: `rounded-panel border-[2.5px] border-ink bg-card px-3.5 py-2.5 shadow-sticker`, `flex flex-wrap items-center gap-2.5`; the right action cluster keeps `ml-auto`.
- Dashboard toolbar keeps its slot in the PageHeader row (`flex flex-wrap items-center gap-2`, right-aligned against the title).
- Control heights: trigger 32 px (`--size-control-md`) to match adjacent sort/view controls; pills 26 px (`--size-control-sm`) so they read as secondary to controls.
- Pills and clear-all live INSIDE the existing toolbar flow (no new toolbar rows/panels as fixed chrome; a wrapped second line within the panel is fine).
- Touch targets ≥ 24 px for the pill × on mobile widths; toolbar remains usable at 390 px via wrapping.
- Long pill labels truncate (`truncate`), max pill width ~200 px.

## 7. Design Tokens

From `src/app.css` (canonical source; `designs/tokens.css` is reference only):

- Fonts: `--font-body` Geist Variable (all filter UI text); `--font-head` DynaPuff (page titles only — NOT for pills/menu).
- Type: `--text-sm` 12 px (pill label, menu items via base component), `--text-md` 13 px (trigger label).
- Sizes: `--size-control-sm` 26 px, `--size-control-md` 32 px.
- Radii: `--radius-panel` 16 px (toolbar shell), `--radius-btn` 7 px (trigger), `rounded-full` (pills).
- Color/border: `--ink` (`border-ink`, 2–2.5 px borders), `bg-card`, `--primary` + `--primary-foreground` (active fill), `--foreground-muted` (clear-all text), `--ring` (focus).
- Shadows: `--shadow-sticker-sm` (2 px hard offset, trigger), `--shadow-sticker` (toolbar panel).
- Semantic tokens ONLY — the wishlist surface re-maps them via `--wishlist-*` theme tokens (see screenshot: Christmas cream/red) and dark mode re-maps `--ink`; hardcoded colors will break both.

## 8. Design Constraints (Non-Negotiable)

- One dropdown trigger per toolbar; no permanent filter chips remain anywhere (REQ-1, REQ-4, REQ-5).
- Active filter = visible labeled pill with a working × (desktop ≥ 640 px); dot-badges or icon-only active indication banned. On mobile the labeled trigger's count badge carries the state (see §3.1).
- Dashboard: pills must never shift the sort/view controls — they grow leftward into the title↔toolbar gap (refined 2026-07-18).
- Dropdown checkbox state and pills always in sync, both directions (REQ-3).
- Role/context gating exactly as today (§3.2 table); gated items absent, not disabled. Recipient must never encounter „Pouze dostupné" (core surprise-protection invariant).
- Clear-all appears when ≥1 filter active and clears everything (REQ-8).
- Shared derived components used by BOTH surfaces — including the Spravované page, which shares `DashboardToolbar` (REQ-6).
- Reuse the base `DropdownMenu`/`Button` primitives and semantic tokens; keep adjacent sort/view controls and the wishlist right action cluster untouched.
- Keyboard + ARIA per §3.7. Czech copy without em-dashes.
- Filter semantics unchanged; no server/API changes implied.

## 9. Design Freedom

- **Trigger form**: labeled „Filtrovat" button vs icon-only `list-filter` button (with tooltip); optional active-count affix on the trigger (e.g. „Filtrovat · 2") as a secondary cue.
- **Pill visual voice**: how "active" reads — primary-filled (like current pressed `FilterChip`), tinted per the Badge `primary` tone recipe, or outlined with bold ×; pick one treatment used identically on both surfaces.
- **Pill placement/order**: directly after the trigger vs end of the control cluster; insertion order vs fixed canonical order.
- **Clear-all form**: text link „Zrušit filtry", ghost button, or an × pill; placement relative to pills.
- **Dashboard inclusion-semantics labeling**: pills may carry clarified copy (e.g. „Včetně archivovaných") or a distinct visual to signal "showing more" vs "narrowing" — or keep the current short labels; designer's call, existing keys are the default.
- **Dropdown composition**: flat list vs grouped with `GroupHeading` („Filtrovat"); check placement; whether the menu stays open for multi-select toggling (recommended) or closes per pick.
- **Motion**: pill enter/exit micro-animation (motion-safe only), trigger open transition.

## 10. Visual References

- **Internal**:
    - `src/lib/components/blocks/wishlist/WishlistDetailToolbar.svelte` — toolbar shell to preserve
    - `src/lib/components/blocks/dashboard/DashboardToolbar.svelte` + `src/lib/components/blocks/page-header/page_header_variants.ts` — dashboard slot
    - `src/lib/components/derived/filter-chip/FilterChip.svelte` — current active-chip look (pressed = `bg-primary text-primary-foreground`), a voice reference for pills
    - `src/lib/components/base/badge/badge_variants.ts` — pill metrics + tint recipes (`color-mix` 14% tone over card)
    - `src/lib/components/base/button/button_variants.ts` — sticker button behaviors (lift, hard shadows)
    - `designs/redesign-2026/sky-final/anime-sky-final.html` + `anime-dashboard.html` — anime-sky design language
    - Current-state screenshots in this folder (§2)
- **External**: e-commerce faceted-filter pattern — filter menu + removable applied-filter chips row (e.g. shadcn "faceted filter" table pattern) as interaction reference only; visual language stays anime-sky.

## 11. Not Included (Scope Exclusions)

- Gift categories / category filter UI — #104 (this design only guarantees the plug-in point).
- Any change to filter semantics, sorting, view modes, or their controls.
- Server-side/persisted filters (all state stays client-side as today).
- Search/text filtering.
- Redesign of the empty states, gift cards, headers, or navigation.
- The wishlist right-side action cluster (palette/settings/import/export/add) — untouched.
