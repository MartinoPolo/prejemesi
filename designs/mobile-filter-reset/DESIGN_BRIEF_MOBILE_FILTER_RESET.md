# Design brief: mobile filter reset

> **Status**: Refined (Variant A)
> **Refined mockup**: `designs/mobile-filter-reset/refined.html`
> **Summary**: `designs/mobile-filter-reset/SUMMARY.md`
> **Refinements**: pill row outside the sticky toolbar, sticky sheet footer from C, no-filters footer state

## Problem

On the wishlist detail page (`/w/<id>`) below 640 px, active filters are visible only as a count badge on the Display trigger. Clearing them needs either the faint „Zrušit filtry“ ghost button at the very bottom of the Filtrovat tab (below every category, priority and store option) or ⋯ → „Obnovit výchozí zobrazení“ (also resets sort and grouping). Filtering by two stores and then getting back to the full list is slow and hard to discover.

Current state: `01_filter_sheet_top.png`, `02_filter_sheet_clear_button.png`, `03_page_with_filters.png`, `04_more_sheet_reset.png` in this folder.

## Goal

From the closed page and from inside the Display sheet, the user sees which filters are active and clears them in one tap.

## Variants

- **A. Mobile active-filter pills:** a horizontally scrollable row under the mobile toolbar with one removable pill per active filter value (e.g. „alza.cz ✕“, „datart.cz ✕“) and a trailing „Zrušit filtry“ action, reusing the desktop `ActiveFilterPills` look. Supersedes the 2026-10-26 decision „without active-filter pills“.
- **B. Decision-compliant:** no pill row. The closed toolbar turns the count into a tappable clear chip next to the Display trigger (e.g. „2 filtry ✕“). Inside the Display sheet a sticky footer above the Řadit podle / Seskupení / Filtrovat tab bar holds „Zrušit filtry“ (enabled only with active filters) and a primary „Zobrazit 4 přání“ that closes the sheet.
- **C. A + sheet footer:** variant A's pill row on the page plus variant B's sticky sheet footer.

## Required states per variant

1. Closed page, two store filters active (alza.cz, datart.cz), 4 of 13 gifts shown.
2. Display sheet open on Filtrovat, scrolled to the store facet, same filters.
3. Closed page after clearing: no row/chip, toolbar back to default.
4. Display sheet with no active filters: footer „Zrušit filtry“ disabled, „Zobrazit 13 přání“.

Show states side by side as 390 × 844 phone frames.

## Container context

Page chrome (navbar, hero card, gift cards) and the sheet header/tab bar are context: render them faithfully but simply, matching the screenshots. The designed parts are only the reset affordances.

## Constraints

- Czech copy, vykání; existing strings: „Zrušit filtry“, „Obnovit výchozí zobrazení“, „Aktivní filtry: 2“, „Odebrat filtr {label}“ (aria).
- Tokens and utilities from `assets/app.css` (compiled from `src/app.css`); fonts DynaPuff (headings) and Geist (body) are loaded by its `@font-face` rules.
- Hard-shadow style, ink outlines, 40 px mobile controls, tab-bar SegmentedToggle in the sheet (`.mpx/DECISIONS.md`, 2026-09-04, 2026-11-03).
- Sources to match: `src/lib/components/blocks/wishlist/WishlistDetailToolbar.svelte`, `src/lib/components/derived/filter-menu/ActiveFilterPills.svelte`, `src/lib/components/blocks/wishlist/WishlistBottomSheet.svelte`, `WishlistSheetChoice.svelte`.
