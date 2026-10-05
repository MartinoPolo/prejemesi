# Demo playground — scoped refinement

**Base**: Variant A · [refined interaction prototype](refined.html). Approved: demo strip/buttons, reset and lifecycle interactions. The surrounding nav, cards and landing are schematic; preserve the actual app. See the [brief](DESIGN_BRIEF_DEMO_PLAYGROUND.md) for states and constraints.

## Component map

| Existing component | Source | Use |
| --- | --- | --- |
| `Button` | `src/lib/components/base/button/index.ts`, `button_variants.ts` | Entry `intent="secondary"` / `size="xl"`; strip `secondary`, `ghost`, `primary`; destructive reset `primary-destructive`. `size="responsive"` defaults to desktop `md` / mobile `lg`; disabled during pending actions. |
| `Dialog.Root`, `Dialog.Content`, `Dialog.Header`, `Dialog.Title`, `Dialog.Description` | `src/lib/components/base/dialog/index.ts`, `dialog-content.svelte` | Reset and registration handoff. `Dialog.Content size="lg"` defaults to `showCloseButton={true}`; use controlled `open`/`onOpenChange` and prevent dismissal while reset is pending. |
| `Select.Root`, `Select.Trigger`, `Select.Content`, `Select.Item` | `src/lib/components/base/select/index.ts`, `select-trigger.svelte` | Reset catalog language: `Select.Root type="single"` with selected value, `Select.Trigger size="lg"`, and items with `value`/`label`. Disable while reset is pending. |
| `Navbar`, `HomeShelf`, `WishlistCard`, landing components | `src/lib/components/blocks/navbar/`, `src/lib/components/blocks/dashboard/`, `src/lib/components/blocks/landing/` | Retain actual app chrome and content; do not implement the prototype stand-ins. |

**New feature surfaces**: a passive DemoNotice below app navigation and an expiry blocker for old content. No component adoption. The portable HTML uses native controls only to demonstrate transitions; production uses the existing primitives and `src/app.css` tokens, not its schematic CSS. No production files changed.
