# Creation Dialog „Další nastavení" Accordion — Design Summary

**Base**: Variant A (Tichý formulářový akordeon) | **Refined**: 2026-07-18

## Refinements Applied

Variant A was chosen and refined with a single change: **equal, centered spacing of the
„Další nastavení" trigger between the dashed divider above it and the solid separator below**.
See the design brief for full requirements.

Key change from the base variant: the collapsed trigger previously sat ~4px below the dashed
divider but ~20px above the solid separator (border-top padding vs. form-gap + separator margin).
The trigger is now centered with an equal **8px** gap on each side — deliberately tighter than
the form's 16px `gap-4` so the optional zone reads as a compact cluster rather than an airy band.
No other visual or structural change; all states from the brief are preserved.

## Component Map

_(unchanged from the brief — this refinement is spacing-only and adopts no new components)_

### Codebase — Use As-Is

| Component | Path | Usage | Key Props/Variants |
| --- | --- | --- | --- |
| `Dialog` | `src/lib/components/base/dialog/` | dialog shell | `Content` `sm:max-w-lg` + `max-h-[85vh] overflow-y-auto` |
| `Accordion` | `src/lib/components/base/accordion/` | „Další nastavení" disclosure | `Root type="single"` collapsible, one `Item`/`Trigger`/`Content`; dashed `border-ink-faint` item divider |
| `Textarea` | `src/lib/components/base/` | description field | `state="default"`, ~3 rows, resize-vertical |
| `Label` / `Field` | `src/lib/components/base` / `derived` | section labels + description wrapper | as existing dialog fields |
| `ToggleGroup`, `Input`, `DatePicker`, `Button` | existing | existing dialog fields | at #159 `lg` 38px metrics |
| `Separator` | existing | solid separator before the import hatch | sits **8px** below the accordion (tighter than the form's `gap-4`) — see Implementation Notes |
| Lucide icons | `lucide-svelte` | trigger affordance | `chevron-down` (built into accordion), optional `settings-2` |

### Adopt from shadcn-svelte / Bits UI

| Component | Source | Install command | Purpose |
| --- | --- | --- | --- |
| — none — | | | `base/accordion` + `base/collapsible` already installed |

### Build Custom / Refactor

| Proposed Name | Description | Why existing components don't cover it |
| --- | --- | --- |
| `WishlistPalettePicker` → controlled | pure picker: `value` + `onchange`, no `wishlistId`, no network | REQ-2: reused at creation time with atomic-at-create persistence |
| auto-save palette wrapper (blocks) | thin wrapper adding today's `setWishlistPalette` click-to-save + optimistic revert + toasts | keeps both existing auto-save call sites behaviorally identical |

## Implementation Notes

**The spacing fix (only new implementation-relevant decision).** The collapsed trigger must be
vertically centered between the dashed accordion divider (above) and the solid `Separator` (below),
with an equal **8px** on each side — deliberately tighter than the form's 16px `gap-4` so the
optional zone reads as a compact cluster.

In the mockup all the accordion's spacing is localized to one rule:
`.disclosure { padding-top: 8px; margin-bottom: -8px; }` — `padding-top` sets the 8px below the
dashed divider; `margin-bottom: -8px` trims the form's 16px `gap-4` below down to 8px. The `Separator`
itself keeps `margin: 0`.

Translate to the real component tree:

1. **8px above the trigger** — space between the accordion item's dashed `border-t border-ink-faint`
   and the trigger row. Ensure the `Accordion.Item`/`Trigger` yields an 8px dashed-line-to-pill gap
   (do not let the base accordion's `py-4` be the _only_ top spacing if it doubles as the pill padding).
2. **8px below the trigger** — the accordion↔`Separator` gap must be 8px, i.e. 8px tighter than the
   form's `gap-4`. Achieve it by pulling the item/accordion down onto the separator (mockup uses a
   `-8px` bottom margin on the disclosure), not by changing the global form gap.

Net geometry (measured in the mockup): 8px visible whitespace from each separator to the trigger pill
on both sides; the trigger's own symmetric internal padding keeps the label centered within that band.

Everything else — collapse-resets-with-form, atomic-at-create persistence, `max-h-[85vh]` internal
scroll, height-only motion (motion-safe), `aria-expanded`/`aria-controls`, `aria-pressed` palette
options, `lg` 38px control metrics — is unchanged and specified in the brief (§4, §7, §9).
