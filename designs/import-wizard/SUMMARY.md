# Import Wizard — Design Summary

**Base**: Variant A (Numbered Stepper) | **Refined**: 2026-06-03

## Refinements Applied

Variant A was chosen and refined with: **source-method tabs use icons instead of ①②③ numbers**
(File / Table / Google), **clarified internal scrolling** for long lists, **expanded the duplicate
(Kontrola/append) step with realistic long, asymmetric lists**, and **removed the
"Reprezentativní náhled — interní logika mřížky" preview label** so the imported grid top-aligns
with the existing-items panel. See the design brief for full requirements.

Key changes from the base variant:

- **Source tabs**: the leading `.tab-num` circled-number was replaced with a 16px icon — Lucide
  **File** (Nahrát soubor), Lucide **Table** (Vložit buňky), and the multicolor **Google** brand
  mark (Odkaz na Tabulky Google). Numbers are gone; the numbered _stepper_ (1·2·3 in the header)
  is unchanged — that is the variant's identity.
- **Internal scroll model**: both the embedded draft grid and the append existing-items panel are
  now internally scrolling regions with a **sticky header row** and a **token-themed scrollbar**
  (`.scroll-y`), instead of the body growing unboundedly. The Review `modal-body` no longer
  double-scrolls (`.review-body`).
- **Aligned dedup comparison**: the append Review is a `.review-split.aligned` two-column region;
  the grid column (`.dedup-main`) and the existing-items `aside` are **top- and bottom-aligned**
  and each scrolls independently. Demonstrated with **16 imported rows (5 duplicates)** vs **26
  existing gifts** so the asymmetric-length case is visible.

## Component Map

### Codebase — Use As-Is

| Component        | Path                                     | Usage                                     | Key Props/Variants                          |
| ---------------- | ---------------------------------------- | ----------------------------------------- | ------------------------------------------- |
| Dialog           | `src/lib/components/base/dialog/`        | Desktop wizard shell (focus trap + lock)  | width grows per step                        |
| Sheet            | `src/lib/components/base/sheet/`         | Mobile full-screen degrade `< md`         | `side="bottom"` / full-screen               |
| Tabs / ToggleGroup | `src/lib/components/base/tabs/` · `toggle-group/` | Source-method switch (3 methods)  | equal-width; icon + label per tab           |
| Textarea         | `src/lib/components/base/textarea/`      | Paste-cells input                         | custom `paste` handler (text/plain+html)    |
| Input            | `src/lib/components/base/input/`         | Sheets URL, title field                   | `type="url"`                                |
| InputGroup       | `src/lib/components/base/input-group/`   | Cena + currency (grid Cena cell)          | numeric input + small select                |
| Select           | `src/lib/components/base/select/`        | Per-column role dropdowns                 | options Název/Poznámka/Odkaz/Cena/Stav/Ignorovat |
| Button           | `src/lib/components/base/button/`        | Next/Commit · Back · entry triggers       | `intent="primary" \| ghost \| outline"`     |
| Alert            | `src/lib/components/base/alert/`         | parse / private-sheet / over-limit / commit errors | `tone="danger" \| warning \| success"` |
| Badge            | `src/lib/components/base/badge/`         | "možný duplikát"; selection count pill    | `tone="warning"`                            |
| Progress         | `src/lib/components/base/progress/`      | Commit progress (Confirm)                 | determinate when row count known            |
| Checkbox         | `src/lib/components/base/checkbox/`      | Per-row select (lives in grid)            | tri-state select-all in grid header         |
| Separator        | `src/lib/components/base/separator/`     | grid / panel dividers                     | —                                           |
| Label / HelpText | `src/lib/components/base/label/` · `help-text/` | Title field label; inline hints   | —                                           |
| ImageUpload      | `src/lib/components/derived/image-upload/` | Drop-zone interaction pattern (retarget .csv/.tsv) | drag/drop + click-to-pick      |

### Adopt from shadcn-svelte / Bits UI

None required — every primitive already exists in `base/`.

### Build Custom

| Proposed Name        | Description                                                      | Why existing components don't cover it                                                    |
| -------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `blocks/import/*`    | Wizard orchestrator + Source/Review/Confirm steps (see brief §5)| Composition of the primitives above; the step machine + parse handling is app-specific.   |
| Google source icon   | Multicolor Google brand mark for the Sheets-link tab            | Lucide ships **no brand logos**; supply an inline 4-path SVG (`viewBox 0 0 48 48`) or a brand-icon component. File/Table use `lucide-svelte`. |
| Existing-items panel | `ImportExistingItemsPanel.svelte` — scrollable list, warn-dot on matched rows, name/link only | Append-only comparison surface; no base list primitive; must never render reservation data. |
| `.scroll-y` utility  | Token-themed thin scrollbar + sticky-head pattern               | Shared scroll affordance for the grid and existing-items panel; not a component, a utility/recipe. |

> The **Gift Draft Grid** itself (`blocks/gift-draft-grid/`) is a separate brief; Review only embeds it.

## Implementation Notes

- **Source-method icons**: File/Table from `lucide-svelte` (`File`, `Table`), sized 16px, `currentColor`
  so they tint with the active/inactive tab state. The Google mark is intentionally full-color (brand
  identity) — keep it `aria-hidden` and rely on the visible "Odkaz na Tabulky Google" label for a11y.
- **Scroll regions**: the grid is the scroll container (sticky `.grid-row.head` via `position: sticky;
  top: 0`); the existing-items panel keeps a sticky `.ep-title` header and a separate scrolling body.
  Use `overscroll-behavior: contain` so wheel scroll doesn't chain to the page/modal. In Svelte the
  scrollers live inside the grid block and the panel — the wizard footer stays pinned below.
- **Top/bottom alignment**: the dedup region is `align-items: stretch`; the grid column reserves room
  for the selection summary (grid `max-height` slightly less than the panel) so both columns end level
  regardless of which list is longer. This replaces the removed preview-label spacer that previously
  pushed the grid down.
- **Scrollbar theming**: `scrollbar-width: thin` + `scrollbar-color` (Firefox) and `::-webkit-scrollbar*`
  (Chromium) both keyed to `--border-strong` / `--surface-2`; verify in dark mode (tokens already
  flip). Always-visible gutter avoids layout shift when content grows past the threshold.
- **a11y / keyboard**: tabs remain `role="tab"`/`aria-selected`; selection count and duplicate count
  use `aria-live`; the existing-items list is informational (not focus-trapping). WCAG AA contrast holds
  for the warn-dot — pair it with the "možný duplikát" badge text, never color alone.
- **Duplicate badge in long names**: the "možný duplikát" badge must stay visible when the Název is
  long — wrap the name text in a truncating `.nm` span inside a flex `.cell-name` and keep the badge
  `flex-shrink: 0`. Truncating the whole cell (badge included) hides the flag exactly on long rows.
- **Mobile**: the append existing-items panel collapses **below** the grid under `lg` (or into a
  `base/collapsible`); the stacked source tabs already use the same icons.
