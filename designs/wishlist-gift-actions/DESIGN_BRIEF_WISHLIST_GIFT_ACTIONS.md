# Wishlist Gift Actions — Design Brief

> **Status**: Finalized and approved (Variant A)
> **Refined mockup**: `designs/wishlist-gift-actions/refined.html`
> **Summary**: `designs/wishlist-gift-actions/SUMMARY.md`
> **Refinements**: full-surface selected tint and ring, palette-adaptive blue-theme selection, aligned grouped checkboxes, project-standard icons, primary Done action, compact view excluded

Contextual gift actions, persistent multiselect, bulk editing, and a sticky wishlist toolbar turn a long wishlist from a card-by-card workflow into a fast management surface without weakening the recipient-surprise invariant. The design must feel native to the existing Anime Sky wishlist page, preserve its supported card and list layouts, and expose secondary actions without adding visible per-card menu buttons.

**Source**: GitHub issue [#286](https://github.com/MartinoPolo/prejemesi/issues/286), its completed product grilling, and related issues #246, #255, #265, and #284

---

## 1. Purpose

This feature lets visitors reach link-oriented secondary actions and lets recipients and správci manage many gifts as one deliberate selection. The mental model is a familiar file manager: right-click or long-press one gift for its contextual actions, choose multiselect, then use checkboxes and a stable toolbar to act on a visible set. At a glance, users must understand which gifts are selected, whether some selected gifts are hidden by display changes, and exactly how many gifts the next action affects.

The toolbar also solves a separate navigation problem: display and management controls currently scroll away inside the app-content scroller. It becomes a full sticky sticker panel below the app header in both normal and selection modes.

**Key value**: Reach the right gift action where the gift is, and safely apply repetitive edits to many gifts without losing context.

---

## 2. Surrounding Context

The mockup **must** show the full viewport with all chrome at correct proportions.

### Full viewport structure

- **App shell — FINAL:** `src/routes/(app)/+layout.svelte` owns a `100dvh`, overflow-hidden shell. A sticky **56 px** `Navbar` spans the top. Reproduce the real desktop order: Přejeme si logo, Moje seznamy, Spravované, Sledované, flexible gap, Vytvořit, notification, appearance/language controls, and avatar. Mobile uses the existing menu consolidation; do not invent another navigation system.
- **Scrollable app region — FINAL:** `.app-content` is the vertical scroller below the navbar. The page background uses the current dotted Anime Sky surface from `src/app.css`.
- **Wishlist page container — FINAL:** centered, maximum **1200 px**, with **24 px** app-shell outer padding and the route's `px-4 py-6` inner rhythm. At 1440 px the working page reads as approximately 1200 px wide with generous side margins.
- **Wishlist notebook header — FINAL:** reproduce the current spiral-notebook header, recipient-first `Pro: Martin Novák`, wishlist title `Vánoce 2026`, date/status/meta chips, taped polaroid, sticky countdown, and management actions. It occupies roughly **236 px** before the toolbar. It is settled context, not a redesign target.
- **Wishlist toolbar — DESIGNED HERE:** full container width. Normal content is the implemented view → sort → grouping → filter → reset → separated reorder sequence, with the management-action cluster aligned right. The toolbar shell is a **16 px** rounded panel with a **2.5 px** ink border, card background, `10px 14px` padding, and hard `shadow-sticker` offset. It starts in normal flow and becomes sticky at **12 px** below the top of `.app-content`; because the navbar occupies its own 56 px shell row, its viewport position is effectively about **68 px** from the top. It remains a full responsive toolbar; it does not transform into a compact mini-bar while sticky.
- **Gift display — FINAL except selection additions:** begins **20 px** below the toolbar. Card view is an auto-fill grid using `minmax(280px, 1fr)` with **20 px** gaps and 4:3 card images. List view is a vertical stack with 1:1 thumbnails. Group headings span the display width. The currently broken compact view remains hidden and is outside this feature.
- **Overlays — DESIGNED HERE:** desktop contextual menu appears at the pointer above gift content and below modal surfaces. Mobile contextual actions use the existing bottom `Sheet`. Toasts remain at the global toast layer.

**What the parent provides**: the 56 px app navbar, the `.app-content` scroll container, route padding, wishlist palette scope, notebook header, gift data, role/capability data, filtering/grouping/sorting state, modal hosts, and global toast host.

**What this component fills**: the existing wishlist toolbar footprint, selection controls layered into each gift view and group heading, a desktop pointer-anchored context menu, and a mobile bottom action sheet.

**Excluded — belongs to the parent**: navbar, notebook-header content, gift detail/editor dialogs, filter/sort/group menu internals, reservation and like flows, and page routing.

**Mockup rendering instructions**:

- Use one interactive `variant-a.html` with a **1440×900** primary frame and state tabs that reveal every required artboard without shrinking the desktop page.
- Required artboards: desktop card grid with context menu; selected card grid with sticky selection toolbar; selected cards on a blue wishlist surface using the adaptive complementary treatment; grouped desktop list with tri-state headers; mobile list with selected gifts; mobile bottom action sheet.
- Reproduce the app shell, notebook header, and ordinary gift content faithfully. Only the toolbar mode, selection affordances, context menu, and action sheet are explored.
- Show realistic Czech content. Light mode is the design source of truth; palette-derived styling must remain valid in dark mode.

---

## 3. Requirements

### 3.1 Sticky normal toolbar

- Keep `WishlistDetailToolbar` as one complete responsive sticker panel. Do not create a second floating toolbar and do not weld it edge-to-edge to the viewport.
- It remains in normal flow until its top would pass the 12 px gap below the app header, then uses the existing `--z-sticky` layer.
- Preserve all implemented control families, order, current values, active-filter pills, management cluster, and container-query wrapping behavior.
- Preserve 32 px `md` controls and 26 px `sm` pills. The sticky state changes position and shadow emphasis only, never control sizing.
- Account for toolbar height changes as controls wrap; content must never slide under or overlap it.
- Sticky behavior applies on desktop and mobile and must remain inside the page's horizontal bounds.

### 3.2 Context menu entry and behavior

- Do **not** add a visible overflow or `⋯` button.
- Desktop mouse/trackpad: right-click a gift card or list row to open the menu at the pointer. Suppress the native browser context menu only on the gift surface.
- Keyboard: when a gift surface has focus, `Shift+F10` or the Context Menu key opens the same desktop menu. This is required because the chosen gesture-only design still needs a keyboard entry path.
- Touch: a **600 ms** long-press opens the mobile action sheet. Cancel recognition on scrolling, pointer cancellation/up, or movement beyond **8 px**. Existing links and controls keep their ordinary tap behavior outside multiselect.
- Never open a floating Bits UI context menu on touch; the mobile renderer is the bottom sheet.
- Menu and action-sheet items share one role-aware action model, icons, labels, availability rules, and callbacks, but use separate renderers appropriate to menu and sheet semantics.
- Desktop menu is **220–280 px** wide, uses the existing card surface, 2.5 px ink border, 7 px radius, hard shadow, Lucide icons, separators, roving focus, typeahead, Escape dismissal, outside-click dismissal, and nested submenus.
- Mobile `Sheet side="bottom"` has rounded top corners, safe-area bottom padding, a compact gift-name heading, a close control, minimum 44 px action rows, and mobile drill-in/back views for priority and category instead of hover submenus.
- Opening the menu does not open the gift detail. Choosing an item closes the menu/sheet unless it opens a nested choice.

### 3.3 Role-aware single-gift actions

Action order is stable so muscle memory transfers across roles:

1. **Open primary link in new tab** — all roles, only when `links[0]` exists.
2. **Copy primary link** — all roles, only when `links[0]` exists; success toast confirms copy.
3. Separator when link actions and management actions both exist.
4. **Edit gift** — recipient and správce when current wishlist state and post-share field rules permit editing.
5. **Change priority** submenu/drill-in — recipient and správce; show current value with a check and include no-priority.
6. **Change category** submenu/drill-in — recipient and správce; follow manager category order, show current value with a check, and include uncategorized.
7. **Mark as received / Mark as not received** — recipient and správce on non-archived wishlists, using the gift's current state.
8. Separator.
9. **Select multiple gifts** — recipient and správce on non-archived wishlists; entering selection mode immediately selects the triggering gift.

Visitors see only Open and Copy. Existing like, reserve, and cancel-reservation actions remain visible on cards and are never duplicated in the context menu. Archived wishlists keep non-mutating Open/Copy only. A gift without a primary link omits both link actions rather than displaying disabled rows. A recipient never sees reservation-derived state, names, or actions.

### 3.4 Entering and exiting multiselect

- Multiselect is available only to roles for which `canManageWishlist(role)` is true: recipient and správce on an active or draft, non-archived wishlist.
- Enter through **Select multiple gifts** in one gift's contextual actions. Select that gift immediately, replace the toolbar contents, disable reorder/dragging, and preserve the current view, grouping, sorting, and filters.
- Exit through a clearly labeled **Hotovo** action or Escape when focus is not inside an open menu/dialog. Exiting clears the selection and restores the normal toolbar without changing display preferences.
- After a successful bulk action, remain in selection mode with the same gift IDs selected. If an action changes visibility or section placement, retain those IDs and report hidden selection count.
- On an error, retain selection and display a clear error toast.

### 3.5 Selection interaction and visuals

- While selection mode is active, clicking/tapping anywhere on a gift surface toggles selection. Ordinary detail opening, links, edit, like/reserve/received controls, and drag affordances are inert; the selection hit target owns the whole surface.
- Each gift surface remains legible but gains a selection layer:
  - unchecked: visible checkbox, ordinary card/row background, no hover lift that implies opening;
  - checked on a neutral/light surface: palette-primary soft blue tint over the **entire card, including the image**, a crisp 3 px primary ring enclosing the **entire outer card**, checked control, and `aria-selected="true"`;
  - checked on a blue wishlist surface where another blue wash loses separation: a pale complementary accent tint over the **entire card and image**, with the palette's high-contrast accent/ink pair for the full-card ring; the checkbox remains an independent checked cue;
  - keyboard focus: existing ink/ring outline remains distinct from selected color.
- Apply image tint with a non-interactive overlay below badges and checkbox, not by changing image opacity. Preserve image detail and keep text at normal contrast.
- Draw the selection ring as a card-level overlay or outline above every child surface. Never rely on an inset box shadow that can be covered by the image or body and appear only along the lower half.
- Grid card checkbox: **top-left over the 4:3 image**, inset 10 px, on an opaque card-colored circular/square backing so it remains legible over photography.
- Desktop list checkbox: a dedicated leading column before the 1:1 thumbnail, aligned through the full list.
- Mobile list checkbox: overlay the thumbnail's top-left corner to avoid stealing horizontal content width.
- Selected styling must remain obvious on already dimmed reserved or received gifts. Reservation and category stickers remain readable but are non-interactive.
- Use a real `Checkbox` visual with checked, unchecked, and indeterminate states; the entire gift remains the primary hit target.

### 3.6 Global and grouped selection

- The selection toolbar starts with a global tri-state checkbox controlling **visible filtered gifts only**:
  - unchecked: no visible gift selected;
  - checked: every visible gift selected;
  - indeterminate: some visible gifts selected.
- Grouped views add a tri-state checkbox before each `GiftSectionHeader` label. Its horizontal center must align exactly with the checkbox column of the list rows below; the heading text starts after that shared selection column. It controls visible gifts in that rendered group only.
- Keep the existing heading/divider visual language and add a localized selected fraction, for example `2 z 5`, after the heading in muted text.
- Preserve selected gift IDs across view, sort, group, and filter changes, including gifts no longer rendered.
- The main count reads `Vybráno 6`. When selection includes filtered-out gifts, add a warning chip such as `2 skryté` with an EyeOff icon and warning semantics.
- Before any bulk action affects hidden selected gifts, show a concise confirmation: `Akce ovlivní také 2 skryté dárky.` with Cancel and Continue actions. Do not confirm when every selected gift is visible.
- Global and group checkboxes add/remove only their current visible domain; they do not silently clear hidden selections.

### 3.7 Selection toolbar

- Replace, rather than append to, `WishlistDetailToolbar` contents during multiselect.
- Wide layout order:
  1. global tri-state checkbox;
  2. `Vybráno {n}` count;
  3. optional hidden-count warning chip;
  4. flexible gap;
  5. labeled bulk controls: Priority, Category, Image fit, Background, Received state;
  6. separated `Hotovo` button.
- Use `Button intent="outline" size="md"` or the matching existing menu trigger treatment for bulk dropdowns. Consolidated `Akce` uses the Lucide `SlidersHorizontal` icon plus a proper `ChevronDown`; do not use an ambiguous generic symbol. Use `Button intent="primary" size="md"` for `Hotovo` so the exit action is unmistakable.
- At a **56rem toolbar container width** and below, consolidate all five bulk controls into one `Akce` dropdown while keeping global select, counts, and Hotovo visible. Below **640 px**, allow two intentional rows: selection/count/Hotovo first, full-width `Akce` trigger second if required.
- Never clip, horizontally scroll, or reduce below the four-step control scale.
- Disable action controls when zero gifts are selected. Hotovo remains enabled.

### 3.8 Bulk action menus

- **Priority:** current common value is checked; mixed selection shows `Smíšené hodnoty` as a non-action label. Choices follow wishlist priority order and include `Bez priority`.
- **Category:** same mixed treatment; choices follow manager category order and include `Bez kategorie`.
- **Image fit:** offer only `Vyplnit` (Fill / `cover-crop`) and `Přizpůsobit` (Fit / `contain-padded`). Never offer Manual because one crop cannot be meaningfully shared across unrelated images.
- **Image background:** show the real supported frame-fill swatches as labeled choices, with mixed/common state. Swatches require text labels and selection indicators; color alone is insufficient.
- **Received state:** explicit `Označit jako obdržené` and `Označit jako neobdržené` choices. There is no bought state.
- Choosing a value applies it to every selected gift, even when current values are mixed.
- Each server mutation is atomic from the user's perspective: all selected gifts update or none do. Pending state disables repeat activation and communicates the affected count.
- Received/unreceived applies immediately. Success toast states the count and provides **Vrátit zpět**, restoring each gift's exact prior state, including a mixed starting set.

### 3.9 Loading, error, and empty behavior

- Entering selection is client-local and immediate; do not show a page loader.
- During a bulk request, preserve the toolbar and cards, show pending state on the chosen action, and prevent another bulk mutation.
- On success, update visible cards/sections without exiting selection. Use the existing toast pattern.
- On failure, make no partial visual state permanent, retain selection, and show an error toast with actionable Czech copy.
- If filters produce zero visible gifts while hidden selections remain, keep the selection toolbar with count/warning and show the existing empty-filter state below it. Hotovo and bulk actions remain available after the hidden-impact confirmation.
- If no gifts exist at all, multiselect cannot be entered and the normal empty wishlist surface remains unchanged.

### 3.10 Mockup coverage

The first mockup must make every settled option inspectable in one file:

- Desktop card grid, normal sticky toolbar, manager context menu at pointer.
- Desktop selected card grid with selected/unselected/dimmed-selected cards and wide selection toolbar.
- Desktop grouped list with global/group tri-state combinations and hidden-count warning.
- Blue-wishlist selected card comparison demonstrating the complementary palette-aware tint and full-card ring.
- Mobile list with image-overlaid checkboxes and two-row selection toolbar.
- Mobile bottom action sheet for a manager, including a nested priority/category drill-in example.
- Contextual visitor version demonstrating Open/Copy only.
- Toast with received undo and hidden-selection confirmation state.

---

## 4. States

| State | Visual Treatment | Trigger |
| --- | --- | --- |
| Normal toolbar, in flow | Existing full sticker panel and control order | Page starts above toolbar threshold |
| Normal toolbar, sticky | Same size/content, stronger spatial separation, 12 px header gap, `--z-sticky` | Toolbar reaches sticky threshold |
| Context target hover | Existing gift hover/focus treatment; no visible menu affordance | Mouse enters gift outside selection mode |
| Desktop context menu | Pointer-anchored card menu, current submenu value checked | Right-click, `Shift+F10`, or Context Menu key |
| Visitor context menu | Open and Copy only; absent entirely if no primary link | Visitor opens contextual actions |
| Mobile long-press pending | Subtle pressed/ring feedback without committing an action | Valid touch held under 600 ms |
| Mobile action sheet | Bottom Sheet with gift title, role-aware action rows, safe area | Valid 600 ms long-press |
| Mobile nested choices | Sheet title/back affordance changes to Priority or Category; selected choice checked | Tap a drill-in action |
| Selection mode, none selected | Toolbar visible; actions disabled; all gift checkboxes visible | All selections toggled off without exiting |
| Selection mode, partial visible | Global/group controls indeterminate; count shown | Some visible gifts selected |
| Selection mode, all visible | Global checkbox checked | Every filtered visible gift selected |
| Selected gift, neutral surface | Full-card soft primary tint including the image, uninterrupted 3 px outer card ring, checked control, no ordinary card interaction | Gift ID is selected |
| Selected gift, blue surface | Full-card pale complementary tint including the image, high-contrast accent/ink ring, checked control | Blue surface would make primary blue selection ambiguous |
| Selected dimmed gift | Full-card selection ring/tint remains above reserved/received veil | Reserved or received gift selected |
| Hidden selections | Warning chip with hidden count; confirmation before mutation | Filters/group changes hide selected IDs |
| Mixed bulk value | `Smíšené hodnoty` menu label, no value falsely checked | Selected gifts differ for a field |
| Bulk pending | Chosen action shows pending state; bulk controls disabled | Mutation in flight |
| Bulk success | Updated gifts remain selected; success toast | Atomic mutation succeeds |
| Received undo available | Toast includes `Vrátit zpět` and affected count | Received/unreceived succeeds |
| Bulk error | No partial committed UI; error toast; selection retained | Mutation fails |
| Empty filtered result with selection | Existing empty-filter panel under active selection toolbar | Display changes hide every selected/visible gift |
| Archived/read-only | Open/Copy may remain; edit/received/select actions absent | Wishlist archived or capability denied |
| Keyboard focus | Existing 2 px outline/ring distinct from selection ring | Tab or menu roving focus |
| Reduced motion | No lifts or sliding embellishment; state changes remain immediate and clear | `prefers-reduced-motion: reduce` |

---

## 5. Component Reuse Map

### Existing components (use these)

| Component | Variant/Props | Usage in this design |
| --- | --- | --- |
| `WishlistDetailToolbar` | existing `viewMode`, sort/group/filter props and manager callbacks | Own sticky positioning and switch between normal and selection contents |
| `Button` — `$lib/components/base/button` | `intent="outline" | "ghost" | "primary"`, `size="sm" | "md" | "icon-sm"` | Bulk triggers, menu/action-sheet rows where appropriate, Hotovo, undo |
| `Checkbox` — `$lib/components/base/checkbox` | Bits UI checked/indeterminate states | Gift, global, and group tri-state selection controls |
| `DropdownMenu` — `$lib/components/base/dropdown-menu` | `Root`, `Trigger`, `Content`, `Item`, `RadioGroup`, `RadioItem`, `Separator`, `Sub`, `SubTrigger`, `SubContent` | Narrow `Akce` menu and wide bulk-control dropdowns |
| `Sheet` — `$lib/components/base/sheet` | `Content side="bottom"`, `showCloseButton`, Header/Title/Description/Close exports | Mobile long-press action sheet and mobile drill-in content |
| `GiftCard` | `gift`, `role`, `isArchived`, `hideReservationState`, callbacks; `giftCardVariants({ dimmed })` | Existing grid content under selection overlay |
| `GiftListItem` | existing gift/role/state/callback props | Existing list content with leading or image-overlay checkbox |
| `GiftSectionHeader` | `section: GiftSection` | Extend with optional tri-state checkbox, shared list-column alignment, and selected fraction in selection mode |
| `GiftReceivedToggle` | `giftId`, `received`, `role`, `isArchived`, `size`, `onreceived` | Source of single-gift received capability and copy; hidden/inert in selection mode |
| `GiftImage` / `ImageFrame` | targets `square` and `thumb`; fit/fill metadata | Preserve real photo, fit, background, reserved and category context |
| Global Sonner toast | existing app toast host | Copy success, bulk success/error, and received undo |

### Components to adopt

| Component | Source | Rationale |
| --- | --- | --- |
| `ContextMenu` base primitive | shadcn-svelte registry `ui/context-menu`, backed by Bits UI 2.17 `ContextMenu` | The repository has `DropdownMenu` but no pointer-anchored context-menu trigger. Upstream provides virtual pointer anchoring, menu roles, roving focus, typeahead, dismissal, checkbox/radio items, and nested submenus. Add it under `src/lib/components/base/context-menu/` in the established shadcn-managed tier. Use it only for mouse/keyboard desktop rendering; intercept touch for `Sheet`. |

### Components to design

| Component | Description | Why new |
| --- | --- | --- |
| `GiftContextActions` | Shared typed action tree resolving role/state/link availability and callbacks, with desktop ContextMenu and mobile Sheet renderers | No saved-gift contextual-action model exists; one model prevents role and copy drift between renderers |
| `GiftLongPressTarget` behavior | Pointer recognizer with 600 ms duration, 8 px movement tolerance, scroll/cancel cleanup, and pressed feedback | Bits ContextMenu's built-in 700 ms touch behavior opens a floating menu and cannot redirect to the required bottom Sheet |
| `WishlistSelectionToolbar` | Selection-mode contents hosted by `WishlistDetailToolbar`, including counts, global checkbox, wide controls, narrow Akce menu, hidden warning, and Hotovo | Existing `GiftDraftBulkBar` is import-grid-specific and cannot represent wishlist field actions or hidden selections |
| `WishlistGiftSelection` state/model | Selected ID set, visible/group tri-state derivations, hidden count, selection persistence, and action pending state | No wishlist selection state exists; view components need one consistent source |
| Selection adapters for gift views | Whole-surface selection layer, full-image tint, uninterrupted card ring, and checkbox placement for grid/list/mobile | Existing cards/rows are action-rich browse surfaces and need an explicit inert selection mode without duplicating their content |

---

## 6. Layout Constraints

- Full viewport target: approximately **1440×900**; content max width **1200 px**.
- Navbar: **56 px**. Sticky toolbar viewport offset: navbar plus **12 px** visual gap; within `.app-content`, use `top: 12px`.
- Page spacing: 4 px token grid; principal gaps 12, 16, 20, and 24 px.
- Toolbar: full available width, 16 px radius, 2.5 px ink border, `10px 14px` padding, 32 px controls, hard 4 px sticker shadow.
- Wide selection toolbar remains one row while content fits. At 56rem container width collapse five field controls into Akce. Below 640 px permit two intentional rows.
- Desktop context menu: 220–280 px wide; item text truncates only after preserving icon/check/submenu arrow.
- Mobile sheet: full viewport width, maximum content height 80dvh, internally scrollable, safe-area padded.
- Card grid: `repeat(auto-fill, minmax(280px, 1fr))`, 20 px gap. Images stay 4:3.
- List thumbnail: `clamp(8rem, 39vw, 9.5rem)` desktop/current responsive behavior; mobile checkbox overlays the thumbnail.
- Checkbox visual: at least 20 px; whole-card/row target supplies the minimum 44 px interaction target.
- Group header checkbox center and row checkbox center share one explicit selection-column coordinate; do not align each element independently with unrelated padding.
- Czech labels must tolerate approximately 30% text expansion without clipping.

---

## 7. Design Tokens

`src/app.css` is canonical. `designs/tokens.css` is linked by mockups as pipeline infrastructure but its old Figtree/Noto values are superseded by the application tokens below.

- **Fonts:** `--font-head: 'DynaPuff Variable'` for headings and gift names; `--font-body: 'Geist Variable'` for controls, menus, counts, and body copy.
- **Control sizes:** `--size-control-sm: 26px`, `--size-control-md: 32px`, `--size-control-lg: 38px`, `--size-control-xl: 48px`.
- **Geometry:** `--radius-panel: 16px`, `--radius-btn: 7px`, `--border-w: 2.5px`.
- **Layers:** `--z-dropdown: 20`, `--z-sticky: 30`, `--z-overlay: 40`, `--z-modal: 50`, `--z-toast: 60`.
- **Motion:** `--duration-normal: 200ms`, `--duration-slow: 300ms`, `--ease-spring` for sticker lifts; all movement gated by reduced-motion preference.
- **Surfaces:** `--background`, `--card`, `--surface`, `--panel-hover`, `--border`, `--ink`, `--foreground`, and `--muted-foreground` derived from the active palette.
- **Selection:** define palette-scoped `--selection-tint`, `--selection-ring`, and `--selection-on-ring` semantic tokens. On neutral/light card surfaces, derive the familiar blue treatment from `color-mix(in oklab, var(--primary) 14%, var(--card))` and `--primary`. On blue wishlist surfaces where the primary treatment has insufficient visual distance, switch these tokens to a pale `--accent` tint and the high-contrast `--on-accent`/ink pair. Apply the tint to body and image overlay, and the ring to the uninterrupted outer card. The checkbox, 3 px ring, and tint provide three cues, so color is never the only selection signal.
- **Warnings:** use the established warning semantic for hidden-selection disclosure; do not use danger red for informational hidden state.
- **Status:** received uses existing primary/received treatment; errors use `--status-danger`; success/undo remains the standard toast surface.
- All derived color mixing uses `color-mix(in oklab, …)`, never OKLCH mixing and never a new wishlist-token namespace.

---

## 8. Design Constraints (non-negotiable)

- No visible per-card overflow button. Context actions enter through right-click, keyboard context-menu keys, or mobile long-press.
- Visitor menus contain only Open and Copy. Like and reservation actions stay on cards.
- Recipients never receive or infer reservation state, counts, or identities.
- Archived wishlists remain mutation-free.
- There is no bought state; only received/unreceived is bulk editable.
- Manual image crop is not a bulk option. Only Fill and Fit are shared safely.
- Selection affects visible filtered gifts when initiated globally/by group, but explicit selected IDs persist when later hidden.
- Hidden selected gifts must be counted and disclosed before a bulk action affects them.
- Each bulk mutation is all-or-nothing from the UI perspective.
- Received undo restores each gift's exact prior state, including a mixed set.
- Selection remains active after successful actions.
- Whole gift surfaces toggle selection in selection mode; ordinary card actions cannot fire through the selection layer.
- Use existing cards, rows, toolbar shell, menu styling, Sheet, button variants, checkboxes, DynaPuff/Geist typography, and palette derivation. All icons must come from the project's established Lucide icon usage and inherit project sizing, stroke, and alignment; project component styling supersedes illustrative or custom glyphs in the HTML mockup.
- All interactive surfaces need visible keyboard focus, semantic menu/checkbox roles, accessible names, Escape behavior, and minimum 44 px touch targets where pointer precision is low.
- Context-menu action order and wording remain consistent between desktop and mobile.
- Light mode is the design source of truth; selected, mixed, warning, focus, and dimmed-selected states must also work in dark mode and every wishlist palette.
- Keep Czech UI copy in formal address where a sentence addresses the user, and avoid em dashes in visible Czech copy.

---

## 9. Design Freedom

- Exact icon choices within Lucide, provided meanings stay conventional and consistent.
- The visual treatment of the long-press pending state, as long as it is subtle and does not resemble selection before the sheet opens.
- Whether wide field triggers show tiny value summaries or only their field labels, provided mixed/common state is clear after opening.
- Exact warning-chip shape and placement within the selection-count cluster.
- Context-menu separator rhythm and mobile action-sheet grouping.
- Sheet drag-handle decoration is optional; the existing Sheet remains the implementation primitive.
- Selection tint strength may be tuned for photography and dimmed cards while retaining the chosen palette-aware semantic ring.
- Micro-animation for check appearance and toolbar-content replacement, within motion tokens and reduced-motion rules.

---

## 10. Visual References

- **Current visual source:** `src/app.css` and `designs/redesign-2026/sky-final/anime-sky-final.html` — Anime Sky palette, sticker geometry, notebook motifs, DynaPuff/Geist, motion.
- **Current toolbar:** `src/lib/components/blocks/wishlist/WishlistDetailToolbar.svelte`, `designs/unified-filters/refined.html`, and `designs/unified-filters/SUMMARY.md` — final bordered toolbar shell, labeled control families, active pills, responsive rows.
- **Current gift surfaces:** `src/lib/components/blocks/gift/GiftCard.svelte`, `GiftListItem.svelte`, and `designs/gift-card-v2/refined.html` — real badges, photos, roles, actions, and card proportions.
- **Existing bulk precedent:** `designs/gift-draft-grid/refined.html` and `SUMMARY.md` — detached sticky bulk card and tri-state selection language. Reuse the pattern, not its import-grid actions.
- **Current group headers:** `src/lib/components/blocks/wishlist/GiftSectionHeader.svelte` — uppercase DynaPuff heading plus divider.
- **External implementation reference:** shadcn-svelte Context Menu registry and Bits UI 2.17 ContextMenu primitive for pointer anchoring, focus, typeahead, and submenus.

---

## 11. Not Included (scope exclusions)

- Middle-clicking a card to open its primary link — tracked separately by #284.
- A visible `⋯`/overflow trigger.
- Bulk Manual crop coordinates or applying one manual crop across images.
- Bulk name, description, links, price, quantity, delete, reserve, unreserve, like, or reorder.
- A bought/purchased workflow distinct from received.
- Redesigning the notebook wishlist header, navbar, gift detail/editor modal, cards, category badges, filters, sorting, or grouping semantics.
- Repairing, exposing, rebuilding, or adding multiselect support to the currently hidden compact view.
- The optional hard-shadow appearance setting, tracked separately by #290; this design keeps the existing dark sticker shadow as visual context only.
- Changing post-share permissions, archived behavior, recipient privacy, or reservation release authorization.
- Exact remote-function/database implementation and schema design; the visual contract only requires atomic behavior, pending/error feedback, and exact received undo.
