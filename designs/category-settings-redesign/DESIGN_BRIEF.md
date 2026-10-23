# Design brief: one orderable category list (#534)

## Problem

Settings → Kategorie splits categories into "Vlastní kategorie" (editable, arrow reorder) and "Přednastavené kategorie" (enable checkboxes, fixed order). Users see two models for one concept, cannot rename or reorder presets, and items do not look like the badge the category becomes on gift cards. Board reference: `.mpx/board-files/Pasted image 20261009082820.png`.

## Direction

- One list. Every category, seeded or user-created, is an ordinary row: rename, recolor, reorder, delete. No enable checkboxes and no preset/custom headings.
- The row shows the real `GiftCategoryBadge` (2 px ink border, badge radius, 11 px extrabold, two-line clamp). Clicking the badge swaps it for a text input (Enter or blur keeps, Esc reverts); a pencil hint appears on hover/focus, always on touch.
- `Použito: N` uses the label role (12 px semibold `muted-foreground`). No colored left border; color lives in the badge and the existing `ColorPicker` swatch, whose popover adds a badge preview of the staged color.
- Order is the order of category groups on the wishlist and in the gift category select. Drag uses a grip, the dragged row's center picks the slot, edge auto-scroll, and FLIP settling, matching the gift reorder decisions; the grip also moves with arrow keys.
- "Nová kategorie" is a dashed row after the list. It opens inline with a live badge preview and appends to the end, so the new item appears where the user is looking.
- Deleting an unused category removes the row. Deleting a used one stages it: the row turns danger-tinted with "Při uložení se odebere z N přání." and a Vrátit button. Saving the shared settings draft is the confirmation, replacing the separate confirm dialog.
- Everything stays inside the shared settings draft and global Uložit (2026-09-01 decision).

## Constraints

- Tokens from `src/app.css`: DynaPuff headings, Geist body, ink borders, hard offset shadows; controls `md` 32 px on desktop and `lg` 40 px on mobile; swatch trigger `sm` 26 px.
- Spacing beside elevated swatches adds `--depth-clearance`. Row radius is `radius-btn + padding + border` (7 + 6 + 1 = 14 px), so the grip/trash hover surfaces nest parallel (AGENTS.md Nested Corner Geometry).
- Dialog is the existing `WishlistSettingsModal` (desktop max 1024 px, mobile viewport minus 2 rem), body-only scrolling, fixed tabs, footer with Uložit.
- Czech copy uses vykání and no em dashes.

## Data and migration note

`gift_category` already stores one row per category per wishlist (`preset_key` nullable, `custom_label` nullable, `color`, `sort_order`, soft delete), so the change is additive:

- Keep every active row with its id, gift assignments, color and `sort_order`. Today presets and custom rows share one `sort_order` space; the merged list renders active rows by `sort_order`, so current group order is preserved.
- Renaming a seeded category writes `custom_label`; the label resolves as `custom_label ?? localized preset label`. `preset_key` remains as provenance only.
- Allow deleting/recreating seeded categories freely: the `gift_category_active_preset_unique` index stays valid because nothing re-enables presets.
- New wishlists keep the existing lazy default seeding (`DEFAULT_ENABLED_GIFT_CATEGORY_PRESET_KEYS`).
- The save contract changes from `{customCategories, presetKeys, presetColors}` to one ordered list of `{id | null, label, color}`, plus `confirmedRemovalCategoryIds`. Agent/MCP category tools must follow (expand → migrate → contract).

## Variants

- A `variants/a-single-column-drag.html`: one column everywhere, grip drag on desktop and mobile; desktop list capped near 600 px with a live "Pořadí na seznamu" badge preview beside it.
- B `variants/b-grid-drag.html`: three columns on desktop, drag in reading order to the nearest slot; one column on mobile.
- C `variants/c-desktop-drag-mobile-arrows.html`: two columns with grip on desktop; on mobile, two-line rows with up/down arrows and no touch drag.

Each page shows desktop and mobile side by side with a state switcher: resting, rename, color pick, drag in progress, staged removal, new category, empty list. Drag, rename, color, removal and add are live in the HTML.

## Recommendation

Variant A. A single column reads in the same top-to-bottom order as the grouped wishlist, so drag direction is unambiguous; grids (B, C) make "after Knihy" ambiguous between right and below, and rows of different heights (long labels clamp to two lines) make the grid jump during drag. The desktop width otherwise wasted becomes a live order preview. Touch drag on a dedicated grip already works for gift reorder, and keyboard arrows on the grip cover accessibility, so separate mobile arrows (C) cost a second row per item for little gain.

## Open questions (with recommendation)

1. Disabled presets on existing wishlists. Recommendation: do not create them; only enabled presets and custom categories become list categories (as in the issue). Soft-deleted rows stay deleted.
2. Renamed seeded categories and locale. Recommendation: unrenamed seeded categories keep following the viewer's locale through `preset_key`; once renamed, the custom label is fixed for everyone.
3. Removal confirmation. Recommendation: staged in-row removal with Vrátit and the usage count, confirmed by Uložit; drop the separate confirm dialog. The server keeps its `confirmedRemovalCategoryIds` mismatch check.
4. Where new categories land. Recommendation: append at the end beside the add row; dragging to the top is one move.
5. A "restore default categories" action. Recommendation: not now; users who deleted defaults can recreate them, and the action reintroduces the preset concept.
6. Category limit. Recommendation: keep the current label length cap and add a soft cap (for example 30) only if load tests or usage show a need; the list scrolls inside the dialog body.
7. Mobile reorder. Recommendation: grip drag with auto-scroll (A); revisit arrows only if touch testing shows conflicts with body scrolling.
