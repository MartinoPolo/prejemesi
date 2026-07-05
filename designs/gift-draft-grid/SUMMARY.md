# Gift Draft Grid – Design Summary

**Base**: Variant B (Roomy Rows) | **Refined**: 2026-06-03

## Refinements Applied

Variant B was chosen and refined with: detached card-like bulk bar, single global
select-all (header only), ghost "+ odkaz" button (de-duplicated plus), multiline resizable
Poznámka, and whole-card color status. See the design brief for full requirements. Key
changes from the base variant:

- **Bulk bar is now a detached card** – rounded corners, padding, full border, soft shadow,
  side margins; floats (sticky) above the grid instead of being a full-bleed strip welded to
  the table header.
- **Removed the redundant select-all checkbox** that sat next to "Vybráno N". There is now
  exactly one global select-all – the tri-state checkbox in the grid header, column-aligned
  with the per-row checkboxes (fixes the horizontal-misalignment complaint).
- **"+ odkaz" is a neutral ghost button** (transparent, no border, hover surface tint) instead
  of a dashed outline. The duplicate plus was removed – one `Plus` icon + label "odkaz".
- **Poznámka is a multiline `Textarea`** (`resize: vertical` + `field-sizing: content`). Rows
  top-align (`align-items: start`) so growing the note grows the whole card.
- **Whole-card status color replaces the left-edge stripe.** One status class per row tints the
  entire card: `is-ready` (green), `is-duplicate` (orange), `is-error` (red). Inclusion is shown
  by the checkbox; deselected rows are dimmed (`is-excluded`). A status legend sits above the grid.

### Status color model (confirmed with user)

| Status        | Class          | Color  | Meaning                                  | Non-color cue (a11y)        |
| ------------- | -------------- | ------ | ---------------------------------------- | --------------------------- |
| Ready         | `is-ready`     | green  | Valid, ready to import                   | checked checkbox            |
| Possible dup  | `is-duplicate` | orange | Matches existing gift (name OR link)     | "možný duplikát" badge      |
| Error         | `is-error`     | red    | Missing required field (blank Název)     | helper text "Zadejte název" |
| Excluded      | `is-excluded`  | (dim)  | Deselected – not committed, still edits  | unchecked checkbox          |

Single duplicate tier (orange) – yellow tier dropped per user decision. Precedence when
combined: **error > duplicate > ready**. `is-excluded` and `is-editing` are orthogonal overlays.
Tints are subtle (`color-mix` 7–9% over surface) with stronger colored borders; field/link/price
controls keep a `--surface` background for AA text contrast. New token `--status-dup` (orange,
distinct from amber `--status-warning` and red `--status-danger`) added per theme block.

## Component Map

### Codebase – Use As-Is

| Component | Path                                | Usage                              | Key Props/Variants                       |
| --------- | ----------------------------------- | ---------------------------------- | ---------------------------------------- |
| Checkbox  | `src/lib/components/base/checkbox/` | Per-row select; header tri-state   | indeterminate for partial select-all     |
| Textarea  | `src/lib/components/base/textarea/` | Poznámka (multiline, resizable)    | `state="error"`; `field-sizing-content`  |
| Button    | `src/lib/components/base/button/`   | "+ odkaz", bulk delete, remove, ✨ | `intent="ghost"` (+odkaz, enrich), `intent="danger"`, `size="sm"`/`icon-sm` |
| Badge     | `src/lib/components/base/badge/`    | "možný duplikát" (orange)          | custom `--status-dup` tone               |

> `base/textarea/Textarea.svelte` already applies `resize-vertical` + `field-sizing-content min-h-16`
> and exposes `state: 'default' | 'error'` – exactly what the multiline Poznámka needs. No new prop required.
> Button `intent="ghost"` already matches the de-dashed "+ odkaz" look (transparent, hover `surface-hover`).

### Adopt from shadcn-svelte / Bits UI

None. All controls are covered by existing base components.

### Build Custom

| Proposed Name          | Description                                              | Why existing components don't cover it                       |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| `GiftDraftRow`         | Status-tinted row/card; owns `is-ready/duplicate/error/excluded/editing` class logic | No primitive renders a whole-card status-color overview |
| `GiftDraftLinksCell`   | Stacked clickable new-tab links + ghost "+ odkaz" (max 10) | Composed list of anchors + add/remove, not a base primitive |
| `GiftDraftPriceCell`   | numeric input + CZK/EUR/USD currency select             | input-group pairing with right-aligned numeric + small select |
| `GiftDraftBulkBar`     | Detached card: count + Smazat vybrané (+ Phase 2 enrich) | No select-all here; standalone sticky card, not a base bar  |
| `GiftDraftGrid`        | Orchestrator: rows, selection, validity, status derivation, emits draft set | feature composition with the single header select-all |
| `GiftDraftDialog`      | Batch-add wide-dialog host wrapping the grid            | host-specific dialog shell + footer                          |

## Implementation Notes

- **Row status is `$derived`**, never an effect: compute `status: 'ready' | 'duplicate' | 'error'`
  from `name.trim() === '' → error`, else `isDuplicate → duplicate`, else `ready`. Map to the card
  class via a `satisfies Record<Status, string>` lookup (no scattered class literals).
- **Pristine vs. error**: the batch dialog's initial blank row renders **neutral** (no `is-error`
  tint, no helper) until touched/commit-attempted – avoid premature-validation red on an untouched
  form. Import (Host A) parsed rows with blank names show `is-error` immediately (they carry data).
- **Single global select-all**: the only tri-state checkbox lives in the grid header (desktop). On
  mobile there is no header row, so the detached `m-bulk` card keeps a select-all checkbox – that is
  the only place a mobile global toggle can live. Do not reintroduce a select-all next to "Vybráno N".
- **Header/row checkbox alignment**: body rows nest inside the grid-body padding (8px) and add a 1px
  border + 20px row padding, so their content starts 29px in. The sticky header is a direct grid child
  with no border, so its horizontal padding must equal that inset (29px) for the header select-all to
  column-align with row checkboxes. Whatever box model the real component uses, keep the header and
  row content boxes on the same left/right inset (verified: checkbox centers within 0.3px).
- **Status tints – mix in `oklab`, NOT `oklch`.** `color-mix(in oklch, <hued> X%, var(--surface))`
  interpolates the **hue angle** between the color and the surface's hue (white = 0°), which drags
  every tint toward red: green 145° → ~19° (pink), orange 68° → ~12°, red 25° → ~3°, so all three
  collapse into the red band and look identical. `color-mix(in oklab, …)` interpolates rectangular
  a/b, preserving hue when mixing with the near-achromatic surface. Tints run 15–20% of the status
  color over `--surface`; borders 55–62%. Keep red (`--status-danger`, hue ~25) and orange
  (`--status-dup`, hue ~68) well apart in hue. Re-check both themes after any token change.
- **Textarea growth**: `align-items: start` on the row grid means a grown note pushes the card taller
  while sibling cells top-align. Use `Textarea` with `field-sizing: content` so it also auto-grows
  with content, and `resize: vertical` for manual drag.
- **"+ odkaz" label**: render `Plus` icon + text "odkaz" (one plus, not two). Disable at 10 links
  (`title="Dosažen limit 10 odkazů"`).
- **A11y / non-color signalling**: every status keeps a textual/iconographic cue besides color
  (badge, helper text, checkbox) per the brief's "never color alone" constraint. Keep tints subtle and
  verify AA contrast on tinted rows in both themes.
- **Bulk bar stacking**: detached card uses `--z-sticky (30)`; keep below the grid header sticky
  context. In the dialog host, the dialog manages its own stacking – no manual z-index on the bar.
- Icons in implementation use path-based Lucide imports (`Plus`, `Trash2`, `X`, `Sparkles`,
  `ExternalLink`, `CircleAlert`, `Check`, `Copy`) with `data-icon` slots inside `Button`.
