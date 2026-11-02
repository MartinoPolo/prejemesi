# Mobile Keyboard Layouts — Design Summary

**Base**: Variant B | **Refined**: 2026-11-02

## Refinements Applied

Variant B was accepted without changes. See the design brief for full requirements. While the
keyboard is open, chrome compacts instead of squeezing the content: the assistant header folds to
one line with secondary actions behind ⋯, the decision bar folds to a one-line summary with Použít,
and the gift editor hides its footer and moves Uložit into the title row.

## Component Map

### Codebase — Use As-Is

| Component    | Path                                | Usage                                                     | Key Props/Variants        |
| ------------ | ----------------------------------- | --------------------------------------------------------- | ------------------------- |
| Button       | `src/lib/components/base/button/`   | Send, Použít, Uložit, Zrušit, Rezervovat, ⋯, ✕            | `size="lg"` on mobile     |
| Textarea     | `src/lib/components/base/textarea/` | Composer, Popis                                           | auto-grow with a line cap |
| Input        | `src/lib/components/base/input/`    | Reserve name and e-mail, sign-in fields                   |                           |
| Sheet        | `src/lib/components/base/sheet/`    | Assistant sheet on mobile                                 |                           |
| Dialog       | `src/lib/components/base/dialog/`   | Gift editor, reserve modal                                |                           |
| Switch       | `src/lib/components/base/switch/`   | Bez kontroly in the compact header                        | labelled                  |
| DropdownMenu | `src/lib/components/base/dropdown-menu/` | ⋯ menu: Náhled, Historie konverzací, Nová konverzace | single-choice items close |
| Assistant UI | `src/lib/components/blocks/chat/`   | Header, starters, follow-up chips, decision bar, composer |                           |

### Adopt from shadcn-svelte / Bits UI

None.

### Build Custom

| Proposed Name          | Description                                                                                   | Why existing components don't cover it               |
| ---------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Keyboard inset tracker | Shared module exposing the keyboard height and an `open` flag as CSS variables and state     | No surface reads the visual viewport today           |
| Compact chat header    | One-line form of the assistant header used while the keyboard is open                        | The two-line header costs too much height            |
| Decision summary bar   | One-line "Návrh · N dárky" + Použít, with a chevron that expands Zamítnout vše / Přijmout vše | The full decision bar does not fit above the keyboard |

## Implementation Notes

- Derive the keyboard height from `window.visualViewport` (`resize` and `scroll`) as
  `innerHeight - visualViewport.height - visualViewport.offsetTop`; never hardcode heights.
  Consider `interactive-widget=resizes-content` in the viewport meta for Chromium, but keep the
  visual-viewport path because iOS Safari ignores it.
- Treat the keyboard as open only while an editable element has focus and the inset exceeds a
  small threshold, so browser-bar collapse does not trigger the compact layouts.
- Controls that must not dismiss the keyboard (⋯, chips, decision chevron) call
  `preventDefault()` on `pointerdown` so the composer keeps focus.
- The composer line cap follows the usable height above the keyboard: more lines with a compact
  keyboard, fewer with a tall one; beyond the cap the textarea scrolls internally.
- Choosing Náhled from ⋯ blurs the composer, closing the keyboard, and shrinks the sheet.
- Gift editor: the title-row Zrušit keeps the unsaved-changes guard of ✕; on blur the footer and
  scroll position return.
- Animate with the keyboard (about 250 ms); snap under `prefers-reduced-motion`.
