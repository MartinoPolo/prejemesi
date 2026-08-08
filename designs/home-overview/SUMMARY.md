# Home Overview (Přehled) — Design Summary

**Base**: Variant A | **Refined**: 2026-08-07

## Refinements Applied

Variant A refined with: 3.5-card peek layout (cards 320px, 3 full + half-cut fourth at 1200px), counts in „Zobrazit vše (N)" heading links, lucide chevron icons on arrow buttons, horizontal-only wheel scrolling. See the design brief for full requirements.

Key structural changes from the base variant: card width grew from 280px to 320px so the fourth card is always cut at the right edge — the desktop peek affordance now matches mobile. Rows whose content fits entirely (no overflow) show no cut-off card, which doubles as the honest "nothing more" state. Nedávné stays link-less; the trailing dashed „Zobrazit vše" card keeps its „+ N dalších" count as the end-of-row landing.

## Component Map

### Codebase — use as-is

| Component    | Path                                                    | Usage                                                                 | Key Props/Variants                                                            |
| ------------ | ------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| WishlistCard | `src/lib/components/blocks/dashboard/WishlistCard.svelte` | Every slide in all four rows, narrowed to the 320px slide width       | `wishlist`, `recipientDisplayName`, `reservationProgress`, `availableGifts`, `myReservations`, `class` |
| EmptyState   | `src/lib/components/blocks/dashboard/EmptyState.svelte`   | Zero-list onboarding hero                                             | `emoji`, `title`, `description`, `actions` snippet                             |
| Button       | `src/lib/components/base/button`                          | Hero CTAs; arrow buttons come styled via Carousel.Previous/Next        | `intent="primary"` / `intent="secondary"`, `size="icon"`                       |

### Adopt

| Component                     | Source                                                              | Install command                                             | Purpose                                        |
| ----------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| Carousel                      | shadcn-svelte registry, vendored from `C:\_MP_github_cloned\shadcn-svelte` | done — vendored into `src/lib/components/base/carousel/`    | Row primitive: Root/Content/Item/Previous/Next |
| embla-carousel-svelte         | npm                                                                 | done — `pnpm add embla-carousel-svelte`                     | Embla engine behind Carousel                   |
| embla-carousel-wheel-gestures | npm                                                                 | done — `pnpm add embla-carousel-wheel-gestures`             | Shift+wheel / trackpad horizontal scrolling    |

`shadcn-svelte.com` was unreachable from this machine (TLS connect timeout, matches the known local ESET pattern), so the CLI `add carousel` failed and the registry files were vendored from the cloned repo instead. Deviations from upstream, all deliberate:

- `Carousel.Previous/Next` use the project Button API (`intent`/`size`, defaults `secondary` + `icon`) instead of upstream `variant`/`size`, and import lucide `chevron-left`/`chevron-right` directly instead of the registry's `IconPlaceholder`.
- Upstream's absolute positioning (`-start-12` overlay arrows) was dropped — this design places arrows inline in the shelf heading row, and the buttons position naturally in flex flow.
- `sr-only` labels are Czech („Předchozí" / „Další") to satisfy the vykání check and cs-first copy.

### Build custom

| Proposed Name | Description                                                                                           | Why existing components don't cover it                                            |
| ------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| HomeShelf     | One row: heading (icon + title), optional „Zobrazit vše (N)" link, Prev/Next arrows, Carousel of cards | Composition specific to /home; no existing block combines heading chrome + carousel |
| ViewAllCard   | Trailing dashed card: circled arrow-right, „Zobrazit vše", „+ N dalších seznamů"                      | One-off slide type, not a WishlistCard variant                                     |

## Implementation Notes

- **Peek geometry**: slide basis 320px (`Carousel.Item class="basis-[320px]"` or equivalent), `opts={{ align: 'start' }}`, no loop. The carousel viewport bleeds to the content-padding edge (`margin-right: calc(var(--space-6) * -1)`) so the cut-off card is flush with the page edge, exactly as in `refined.html`.
- **Wheel gestures**: add `WheelGesturesPlugin` from `embla-carousel-wheel-gestures` to `plugins`, configured `forceWheelAxis: 'x'` (or equivalent) so **plain vertical wheel keeps scrolling the page** — only shift+wheel / trackpad horizontal deltas move the shelf. Scroll-hijacking vertical wheel is explicitly rejected.
- **Arrow state**: wire `Carousel.Previous/Next` disabled state via context (`canScrollPrev/Next` — automatic). Rows whose content fits get both arrows disabled; consider hiding the pair entirely when `!canScrollNext && !canScrollPrev` (mockup shows them only on overflowing rows).
- **Counts**: „Zobrazit vše (N)" uses the row's total count, not the capped-at-10 slice length. Nedávné has no link. Trailing ViewAllCard shows `total - visible`.
- **Keyboard**: arrow buttons already handle ArrowLeft/ArrowRight via the carousel context's `handleKeyDown`.
- **Hover lift clearance**: shelves need vertical padding (~6px top / 14px bottom in the mockup) so card hover lift and hard shadows don't clip against the embla overflow-hidden viewport.
- **SSR**: all four row queries must be SSR-awaited with the issue #108 `$derived(query.current)` pattern — `getFollowedWishlists`/`getModeratedWishlists` are currently browser-gated and would flash skeletons.
