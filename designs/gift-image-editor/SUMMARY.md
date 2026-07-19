# Gift Image Editor — Design Summary

**Base**: Variant A (inset sticker panel) | **Refined**: 2026-07-18

## Refinements Applied

Variant A was chosen and refined with: **drop the „Hlavní" primary-link badge**, **rename the link
label field „Popisek" → „Viditelný popisek"** (EN „Visible label"), **re-seat the close button inside
the panel** (was overhanging the corner) keeping the hover rotation. See the design brief for full
requirements. Key changes from the base variant:

1. The link-editor row no longer renders a „Hlavní" `Badge`; primacy is conveyed by row order (`links[0]`).
2. The per-link label input now carries a **visible** „Viditelný popisek" label instead of only a placeholder.
3. The circled-X close button moved from `top/right: -13px` (overhanging) to `top/right: 16px` (inside), with
   `rotate(90deg) + scale` on hover via `--ease-spring` and a `prefers-reduced-motion` guard — i.e. the exact
   production `overlayCloseButtonClass` (#164). The original mockup had simply mis-drawn it outside the corner.

## Component Map

### Codebase — Use As-Is

| Component | Path | Usage | Key Props/Variants |
| --- | --- | --- | --- |
| `Dialog` + close button | `src/lib/components/base/dialog/` (`dialog_close_button.ts`) | Modal chrome; the circled-X **already** sits inside top-right and rotates on hover | `overlayCloseButtonClass` = `top-4 right-4 size-(--size-control-lg) … hover:rotate-90 hover:scale-[1.08] … motion-reduce:hover:rotate-0` |
| `GiftLinkEditor` / `GiftLinkRow` | `src/lib/components/blocks/gift/` | Link rows (§3.7) — modified: drop Badge, add visible label | `links`, `isPrimary` (kept for aria only), `onlabelchange` |
| `Label` (base) | `src/lib/components/base/label/` | New visible „Viditelný popisek" label on the link-label input | 12 px / 600 / `--ink-label` |
| `ToggleGroup`, `Button`, `ImageFrame`, `ImageCropStage`, `GiftImagePreviewSlots`, `Input`, `Select`, `Switch`, `Textarea` | base / derived / blocks | Unchanged by this refine — see brief §5 | per brief |

### No longer used in the link row

| Component | Path | Note |
| --- | --- | --- |
| `Badge` | `src/lib/components/base/badge/` | The `tone="neutral" badgeStyle="subtle"` „Hlavní odkaz" badge is **removed** from `GiftLinkRow`. Still used elsewhere; only this usage drops. |

### Adopt from shadcn-svelte / Bits UI

None.

### Build Custom

None from the refine. (The brief's build items — adaptive-stage sizing rework, second preview tile, mode-section
panel treatment — are unchanged by this pass.)

## Implementation Notes

Only things not already in the brief:

- **Close button = zero new code.** Production `overlayCloseButtonClass` (`dialog_close_button.ts`) is already the
  inside-position + rotate-90 spec the user asked for. The gift dialog uses the standard `Dialog.Content` close, so
  nothing needs building — the mockup was simply corrected to match production. Do **not** re-implement a bespoke
  close button in the gift modal.
- **`GiftLinkRow.svelte` — two edits:**
  1. **Remove the primary `Badge`** block (the `{#if isPrimary}…gift_link_primary…{/if}`). Keep the `isPrimary`
     prop; if a screen-reader hint is wanted, expose it via `aria-label`/visually-hidden text on `links[0]`, not a
     visible chip. `gift_link_primary` message may become visually unused.
  2. **Add a visible `Label`** reading „Viditelný popisek" for the label `Input` (currently the second `Input`
     carries only `placeholder={gift_link_label_placeholder}`). New message key **`gift_link_visible_label`**
     (`cs`: „Viditelný popisek", `en`: „Visible label"). Keep `gift_link_label_placeholder` („Popisek (volitelné)")
     as the input placeholder. The visible label disambiguates from the gift **„Popis"** (description) field above.
- **Layout note:** with the badge gone, the label row is just `Label` + `Input` (domain default). In the compact
  editor this can be a single row (`Label` inline-start, `Input` flex-1) or stacked; match the `Field`/`Label`
  spacing used elsewhere in the form (12 px label, 6 px gap).
- **i18n:** add `gift_link_visible_label` to both `messages/cs.json` and `messages/en.json`. No other copy changes.
- **A11y / motion:** the close-button rotation is already `motion-reduce`-gated in production; the mockup mirrors it
  with a `@media (prefers-reduced-motion: reduce)` block. No new a11y work for the link-row changes beyond the
  optional aria hint for the primary link.
