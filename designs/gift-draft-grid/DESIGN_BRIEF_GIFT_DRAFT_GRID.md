# Design Brief — Gift Draft Grid

> **Status**: Design phase
> **Source**: DECISIONS.md "Bulk gift entry via large dialog", "CSV / Google Sheets import via 3-step wizard", "Multiple links per gift", "Name-based enrichment deferred; blank names stay blank", "Metadata enrichment: per-item, progressive, offloaded". CONTEXT.md domain terms "Gift draft", "Draft grid".
> **Delivery**: Phase 1 (grid + batch-add dialog, no enrichment) · Phase 1b (multi-link data model) · Phase 2 (✨ enrich placeholder activates) · Phase 3 (name search — out of scope here).

**Component:** `GiftDraftGrid` (`src/lib/components/blocks/gift-draft-grid/`)
**Date:** 2026-06-03
**Status:** Design phase — variants under exploration

---

## 1. Purpose

The Gift Draft Grid is the editable, multi-row table where a user reviews and edits **gift drafts** (unsaved gift rows) before committing them to a wishlist as real gifts. It is the largest new UI surface in the import/bulk-entry feature and is **reused in two hosts**:

1. The **Import Wizard** Review step — rows arrive pre-filled from a parsed CSV / pasted cells / fetched Google Sheet.
2. A standalone **"Hromadně přidat dárky" (batch-add) large dialog** — opened from the wishlist toolbar, starts empty, the user types rows manually.

Its job is to:

1. Present each draft as a row with editable fields (Název, Poznámka, Odkazy, Cena + currency).
2. Make **link-only rows self-naming**: every link is clickable and opens in a new tab, so the user can open the product, see what it is, and type the name themselves. The grid never auto-fills the name from a URL.
3. Validate inline — a blank-name row is invalid and is excluded from commit until named.
4. Flag **possible duplicates** (import context only) against existing wishlist gifts, while keeping the row user-toggleable.
5. Support per-row and bulk select/deselect, delete-selected, and (Phase 2) enrich-selected.
6. Stay usable at up to ~200 rows.

This brief covers **both** the grid itself and the **batch-add dialog host**. The Import Wizard shell and its Source/Confirm steps are separate (see § 11).

---

## 2. Surrounding Context

The grid is a shared primitive embedded in two different chromes:

**Host A — Import Wizard Review step.** The grid sits inside the wizard step body (`/import` flow, entered from "Vytvořit ze souboru" or "Přidat ze souboru"). Above the grid lives the wizard's **Review header**, which owns the **column-mapping controls** (which parsed column → Název / Poznámka / Odkaz / Cena, plus skipped-row info). Those mapping controls are NOT part of this grid — the grid only reflects the already-mapped result. A wizard footer ("Zpět" / "Pokračovat") sits below; "Pokračovat" is disabled until ≥ 1 valid selected row exists.

**Host B — Batch-add large dialog.** A standalone `base/dialog` opened from the wishlist page toolbar ("Hromadně přidat dárky"). It starts with **one blank row** plus a "Přidat řádek" affordance; the user builds rows by hand. The dialog owns its own title, body-scroll lock, focus trap, close button, and a footer with the commit action ("Přidat dárky" / "Zrušit"), disabled until ≥ 1 valid selected row exists.

In both hosts the grid is the focus; the host supplies the surrounding chrome and the single commit/next action. The grid emits the current draft set + validity; the host owns the commit. Closing/leaving without committing discards drafts (a confirm guard is the host's concern, noted in § 11).

There is no per-row URL routing — this is a local editing surface, not a navigable page.

---

## 3. Content Requirements

### Columns (left → right, always shown)

| Column                | Field                                               | Control                                                                    | Notes                                                                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select                | row selection                                       | `base/checkbox`                                                            | Per-row include/exclude. Header cell hosts select-all tri-state.                                                                                                                                                                                              |
| **Název**             | `draft.name` (required)                             | `base/input` `state`                                                       | Blank = invalid (highlighted + helper text). The naming affordance is the row's clickable link.                                                                                                                                                               |
| **Poznámka**          | `draft.description`                                 | `base/input` / `base/textarea`                                             | Free text; optional. Single-line input acceptable, auto-grow optional (design freedom).                                                                                                                                                                       |
| **Odkazy**            | `draft.links: {url,label?}[]` (max 10)              | composed link cell                                                         | Each link is a **clickable chip/row opening in a new tab** (`target="_blank" rel="noopener"`). A **"+ odkaz"** control adds links up to 10; each link is removable. `links[0]` is primary. Empty state shows a single add affordance, no "Bez odkazu" filler. |
| **Cena**              | `draft.price` (int, whole units) + `draft.currency` | `base/input-group` (numeric `base/input` + small `base/select`)            | Currency default **CZK**, options CZK/EUR/USD. Whole units only. Both optional.                                                                                                                                                                               |
| _Phase 2 placeholder_ | per-row enrich                                      | ✨ `base/button` `intent="ghost"` icon (`Sparkles`) + per-row enrich state | **Placeholder only** in this brief — reserve the slot and the per-row state visuals; provider/internals are out of scope (§ 11).                                                                                                                              |
| Remove                | delete this row                                     | `base/button` `intent="ghost"` icon (`Trash2` / `X`)                       | Removes the draft row.                                                                                                                                                                                                                                        |

### Row metadata (not a column — row-level affordances)

| Item                   | Where shown                          | Notes                                                                                                             |
| ---------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Invalid-name marker    | Název cell                           | `state` highlight + `base/help-text` "Zadejte název" (or inline icon + tooltip in compact layouts).               |
| "možný duplikát" badge | row (Název cell or row leading edge) | `base/badge` `tone` — **import context only**. Row stays toggleable; badge is informational, never auto-excludes. |
| Quantity               | not a column in v1 grid              | Quantity defaults to 1; per-row quantity editing is deferred to the single-gift modal (§ 11).                     |
| Priority / Image       | not in grid                          | Set later per gift in the gift modal (§ 11).                                                                      |

### Bulk action bar (visible when ≥ 1 row selected)

| Action              | Control                                   | Notes                                     |
| ------------------- | ----------------------------------------- | ----------------------------------------- |
| Selected count      | text                                      | e.g. "Vybráno 5".                         |
| Select all / none   | header checkbox (tri-state)               | Indeterminate when partial.               |
| Smazat vybrané      | `base/button` `intent="danger"`/`outline` | Deletes selected rows.                    |
| ✨ Obohatit vybrané | `base/button` (Phase 2 placeholder)       | Reserve slot; disabled/absent in Phase 1. |

### Role / context gating

The grid is an **owner/moderator authoring surface only** — it never renders reservation state, like counts, or gifter identity (core owner-surprise invariant holds trivially: no reservation data exists for unsaved drafts). The only context branch is **import-vs-batch**:

| Element                  | Import (Host A)                            | Batch-add (Host B)                                 |
| ------------------------ | ------------------------------------------ | -------------------------------------------------- |
| Rows on open             | pre-filled from parse                      | one blank row                                      |
| "možný duplikát" badge   | shown (matched vs existing wishlist gifts) | not shown (no parse/source to dedup; manual entry) |
| Column-mapping reference | in wizard Review header (not the grid)     | n/a                                                |
| Commit action label      | "Pokračovat" (wizard footer)               | "Přidat dárky" (dialog footer)                     |

---

## 4. States Table

Row-level states:

| State                         | Trigger                                                               | Visual change                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Empty (batch)**             | Batch dialog opened                                                   | One blank row + "Přidat řádek" affordance; commit disabled                                                                        |
| **Valid**                     | Row has a non-blank name, selected                                    | Normal row; counts toward commit; checkbox checked                                                                                |
| **Invalid (blank name)**      | Selected row with empty Název                                         | Název cell `state` highlight + helper "Zadejte název"; excluded from commit count; row's link emphasised as the naming affordance |
| **Possible-duplicate**        | Import row matches existing gift by normalized name OR link host+path | "možný duplikát" `badge` on row; still toggleable; not auto-deselected                                                            |
| **Excluded (deselected)**     | User unchecks the row                                                 | Row dimmed/muted; not committed; remains editable                                                                                 |
| **Editing**                   | Field focused                                                         | Active field `state` focus ring; row subtly raised/active                                                                         |
| **Enriching** _(Phase 2)_     | ✨ fired for the row                                                  | Per-row progress/shimmer on enrich-target fields (image/price/title); other fields stay editable                                  |
| **Enriched** _(Phase 2)_      | Enrich succeeds                                                       | Filled fields flash/settle; subtle "doplněno" affordance                                                                          |
| **Enrich-failed** _(Phase 2)_ | Enrich errors / quota hit                                             | Inline non-blocking marker + retry; row stays valid/editable                                                                      |

Surface-level states:

| State                          | Trigger                | Visual change                                                                                  |
| ------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------- |
| **Bulk-selection bar visible** | ≥ 1 row selected       | Sticky bulk action bar appears (count + select-all + Smazat vybrané + Phase 2 enrich-selected) |
| **Commit-disabled**            | 0 valid selected rows  | Host footer action disabled + helper ("Vyberte alespoň jeden platný řádek")                    |
| **Commit-enabled**             | ≥ 1 valid selected row | Host footer action enabled                                                                     |
| **Large set**                  | ~200 rows              | Grid stays scrollable/usable; virtualization is design freedom (§ 9)                           |
| **Mobile / narrow**            | viewport < ~600px      | Rows collapse to stacked cards (§ 6, § 9)                                                      |
| **Committing**                 | Host commit fired      | Footer action shows pending; grid locked read-only until done                                  |

---

## 5. Component Reuse Map

```
blocks/gift-draft-grid/
  GiftDraftGrid.svelte          — orchestrator: rows, selection, validity, emits draft set
  GiftDraftRow.svelte           — one draft row (desktop table row / mobile card)
  GiftDraftLinksCell.svelte     — links[] with clickable new-tab chips + "+ odkaz" (max 10)
  GiftDraftPriceCell.svelte     — numeric input + small currency select (CZK default)
  GiftDraftBulkBar.svelte       — select-all + count + Smazat vybrané (+ Phase 2 enrich)
  GiftDraftDialog.svelte        — batch-add large-dialog host (wraps the grid)
  GiftDraftEmptyState.svelte    — batch one-blank-row + "Přidat řádek"

base/  (shadcn primitives — DO NOT EDIT; no Table primitive exists → grid is COMPOSED)
  checkbox/   — per-row select + tri-state select-all
  input/      — Název, Poznámka, Cena
  textarea/   — Poznámka (optional auto-grow)
  select/     — currency (CZK/EUR/USD)
  input-group/— Cena + currency pairing
  button/     — + odkaz, remove-row, bulk delete, (Phase 2) ✨ enrich
  badge/      — "možný duplikát" (tone)
  help-text/  — inline validation ("Zadejte název")
  dialog/     — batch-add large-dialog shell (Host B)
  tooltip/    — compact-layout validation / duplicate explanation
  skeleton/   — (Phase 2) per-row enrich shimmer
  separator/  — row/section dividers where needed

derived/
  (none new required) — image-frame/image-upload belong to the per-gift modal, not the grid
```

> No `Table`/`DataTable` primitive exists. The grid is **composed** from input/select/checkbox/button + a CSS grid/flex layout. Header row + body rows are layout, not a primitive.

---

## 6. Layout Constraints

- **Host A (wizard):** grid fills the step body width (content column up to `--content-max-width` 1200px); height is the step body, internally scrollable. Review header (mapping) above, wizard footer below.
- **Host B (batch dialog):** a **wide** `base/dialog` — target `max-w-[1100px]` (≥ the gift modal's 900px), `max-h-[90dvh]`; grid body scrolls within, dialog footer pinned.
- **Column widths (desktop):** Název and Poznámka flex to fill; Odkazy sized to fit chips + "+ odkaz"; Cena fixed-ish (numeric + small currency select); select / enrich / remove are narrow fixed gutters. Header labels align to columns.
- **Sticky header row:** column labels (and the tri-state select-all) stay visible while the body scrolls.
- **Sticky bulk bar:** when active, pins to top or bottom of the grid viewport so it stays reachable in long lists.
- **Row height:** comfortable single-line default; rows grow when a Poznámka wraps or a row carries multiple links.
- **Touch targets:** checkboxes, "+ odkaz", remove, and ✨ ≥ 32px (`--size-control-md`); 44px where it must be thumb-reachable on mobile.
- **Large sets:** up to ~200 rows must scroll smoothly; virtualization permitted (§ 9).
- **Mobile (< ~600px):** the wide table is unusable as columns — **rows collapse to stacked cards** (one card per draft: name field, note field, links list + add, price+currency, select toggle, remove). Bulk bar becomes a compact sticky bar. The batch dialog goes full-screen.
- **Z-index:** `--z-modal: 50` for Host B dialog (and `--z-overlay: 40` backdrop); sticky header/bar within grid use `--z-sticky: 30`.

---

## 7. Design Tokens Used

Canonical source is `src/app.css` (design reference: `designs/tokens.css`). Never inline values.

- **Typography:** `--font-sans` (Figtree Variable — fields, body), `--font-heading` (Noto Sans Variable — dialog title); scale `--text-xs`…`--text-2xl` (`--text-sm`/`--text-md` for dense cell text, `--text-2xs` for helper/badge).
- **Spacing:** `--space-1`…`--space-8` (4px base) for cell padding, row gaps, gutters.
- **Radii:** `--radius-md` (inputs, link chips, cells), `--radius-lg` (dialog body, mobile cards), `--radius-full` (badge, optional pill chips).
- **Surfaces:** `--surface` / `--background` (grid base), `--surface-2` / `--surface-3` (header row, mobile card backplate), `--surface-hover` (row hover).
- **Text:** `--foreground`, `--foreground-muted` (labels, currency, secondary), `--foreground-subtle` (excluded-row dim, placeholder).
- **Borders / focus:** `--border`, `--border-strong` (header/column rules); `--ring` for focus.
- **Primary:** `--primary` (sage green `oklch(52.7% 0.154 150.069deg)`), `--primary-foreground`, `--primary-soft` (selected-row tint / enriched accent).
- **Validation:** `--invalid-ring`, `--invalid-border`, `--destructive` for blank-name highlight and bulk-delete `danger` intent.
- **Status / domain:** `--status-warning` or `--status-info` for the "možný duplikát" badge `tone`; `--status-success` for enriched/commit success (Phase 2 / host toast); `--status-danger` for enrich-failed marker.
- **Motion:** `--duration-normal` (150ms) + `--ease-standard` for row add/remove, selection, enrich settle; respect `prefers-reduced-motion`.
- **Z-index:** `--z-modal`, `--z-overlay`, `--z-sticky`.
- **Layout:** `--content-max-width`, `--size-control-sm/md/lg`.

---

## 8. Design Constraints

1. **Blank-name rows stay blank — no domain auto-fill.** Never derive the name from the URL/domain (explicitly user-rejected). The row's **clickable link is the manual-naming affordance**.
2. **Blank-name row is invalid and excluded from commit** until a name is typed; surfaced inline (highlight + helper). Host commit/next is disabled until ≥ 1 valid selected row.
3. **Every link is clickable and opens in a new tab** (`target="_blank" rel="noopener noreferrer"`). Links are real anchors, keyboard-focusable, not just decorative.
4. **Multiple links per row, max 10**, `links[0]` primary; "+ odkaz" disabled at 10; each link removable. Matches the `links: {url,label?}[]` jsonb model.
5. **Possible-duplicate is import-only and advisory** — matched by normalized name OR link host+path; the row remains user-toggleable and is never auto-removed.
6. **Owner-surprise invariant intact** — the grid renders no reservation/like/gifter data (none exists for drafts); do not add any.
7. **Compose the grid** from base input/select/checkbox/button + layout. Do **not** introduce a new Table primitive or edit `base/`.
8. **Currency default CZK**, options CZK/EUR/USD; price is whole integer units only.
9. **Czech UI throughout** (Paraglide). Examples: "Hromadně přidat dárky", "Přidat řádek", "+ odkaz", "Zadejte název", "možný duplikát", "Vybráno {n}", "Smazat vybrané", "Přidat dárky", "Pokračovat", "Vyberte alespoň jeden platný řádek".
10. **Up to ~200 rows usable** — performance is a hard requirement; virtualization is allowed (§ 9).
11. **Token-driven, light + dark safe** (light mode is source of truth); WCAG AA contrast on all cell text, labels, helper, and badges; validation never conveyed by color alone (pair with icon/text).
12. **✨ enrich is a Phase 2 placeholder** — reserve the per-row slot and the bulk "Obohatit vybrané" slot, but no provider/parsing/internals here (§ 11).

---

## 9. Design Freedom

- **Row model on desktop:** true table-grid vs. card-per-row vs. spreadsheet-dense — and exactly how the mobile stacked-card collapse looks.
- **Virtualization** strategy (windowing vs. plain scroll) for the ~200-row case.
- **Links cell treatment:** inline chips, stacked mini-rows, or a popover/expander for rows with many links; how "+ odkaz" and per-link remove are placed; whether the optional `label` is editable inline or defaults to the domain.
- **Validation presentation:** persistent helper text under the field vs. inline icon + tooltip in dense rows; whether invalid rows also get a leading-edge marker.
- **"možný duplikát" placement:** badge in the Název cell, a leading-edge stripe, or a row affordance with a tooltip explaining the match (name vs. link).
- **Bulk bar position** (sticky top vs. bottom) and whether it overlays or pushes content.
- **Select-all scope** semantics surfacing (all vs. all-valid vs. visible) if virtualized.
- **Add-row affordance** style in batch mode (footer button, trailing ghost row, or both) and keyboard flow (Enter/Tab to add).
- **Currency control** form (compact select vs. segmented) within the Cena `input-group`.
- **Phase 2 enrich** per-row visual language (where the shimmer/“doplněno”/retry live) — placeholder framing only.
- **Empty-state copy/illustration** for the batch dialog beyond the required one blank row + "Přidat řádek".

---

## 10. Visual References

- `designs/gift-detail-modal/refined.html` + `DESIGN_BRIEF_GIFT_DETAIL_MODAL.md` — dialog shell, backdrop/blur, two-column body, close button, typography fidelity to match for the batch-add Host B dialog.
- `designs/gift-image-crop/DESIGN_BRIEF_GIFT_IMAGE_CROP.md` — confirms gift-level fields (name, description, links, price, currency, quantity, priority, image) that the grid feeds; segmented-control / `input-group` patterns.
- `designs/wishlist-page/refined.html` + `DESIGN_BRIEF_WISHLIST_PAGE.md` — toolbar where "Hromadně přidat dárky" launches; domain-chip / link affordance language ("↗ alza.cz", new-tab links).
- `designs/dashboard/variant-2.html` / `refined.html` — `.theme-light` / `.theme-dark` palette blocks, badge and row patterns, surface hierarchy.
- `designs/tokens.css` (structural reference) and `src/app.css` (canonical token values, light + dark).
- Sage green primary: `oklch(52.7% 0.154 150.069deg)`.
- **External (conceptual only):** spreadsheet/data-grid editing patterns (sticky header, row selection, add-row affordance) — borrow interaction affordances, not chrome.

---

## 11. Not Included in This Brief

- The **Import Wizard shell** and its **Source** and **Confirm** steps — separate brief. This brief covers only the shared grid + the batch-add dialog host.
- **Column-mapping controls** (parsed column → field, skipped-row handling) — they live in the **wizard Review header**, referenced here but designed elsewhere.
- **Gift Card v2** (card display of saved gifts, piece-count + stacked links) — separate.
- The **single-gift detail/edit modal** — drafts become gifts editable there; per-gift **quantity**, **priority**, and **image** are set in that modal, not the grid.
- **Enrichment internals / provider** (Microlink, OG/JSON-LD fallback, throttling, Cloudflare budgeting) — Phase 2; this brief leaves only a ✨ placeholder slot + per-row enrich state visuals.
- **Name-based product search** (Alza/Heureka candidate matching) — Phase 3, deferred.
- **Discard-on-close confirm guard** behavior — owned by each host (wizard navigation / dialog close), not the grid.
- **Reservation / like / gifter data** — never present on drafts; intentionally absent (owner-surprise invariant).
