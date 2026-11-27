# Shared gifts — Design Summary

**Base**: Variant B | **Refined**: 2026-11-26

## Refinements Applied

Variant B refined with: recipient avatars, explaining popover on the shared badge, explicit shared quantity, „Jak to funguje?“ section help. See the design brief for full requirements. Key structural changes from the base variant: the card badge became a button opening a Popover (bottom Sheet below 640 px), and shared cards and rows gained a „3 ks dohromady“ line under the title when quantity is above 1.

## Component Map

### Codebase — use as-is

| Component | Path | Usage | Key Props/Variants |
| --- | --- | --- | --- |
| GiftCard / GiftListItem | `src/lib/components/blocks/gift/` | Shared cards and rows; piece count placement reused for „3 ks dohromady“ | `density="grid"` / `"carousel"` |
| Badge | `src/lib/components/base/badge/` | Shared badge surface on the image | `tone="accent"` `badgeStyle="overlay"` |
| Avatar | `src/lib/components/derived/avatar/` | Recipients in badge, popover, editor and bulk rows, viewer | `appearance="recipient"`, photo or initials |
| Popover | `src/lib/components/base/popover/` | Badge explanation and „Jak to funguje?“ | trigger pattern from `derived/overflow-chips` („+X“) |
| Sheet | `src/lib/components/base/sheet/` | Explanation below 640 px, mobile bulk dialog | shared mobile sheet |
| Checkbox | `src/lib/components/base/checkbox/` | Editor field and bulk dialog rows | locked rows show a lock icon |
| GiftSectionHeader | `src/lib/components/blocks/wishlist/` | „Společná přání“ header with count and help button | `section`, `count` |
| Dialog, Alert, HelpText | `src/lib/components/base/` | Bulk share dialog, failure, field help | one solid rightmost button; `tone="danger"` |
| GiftViewer | `src/lib/components/blocks/gift/GiftViewer.svelte` | „Společně s“ caption plus explanation line | categories neighbourhood |
| Reserve dialog stepper | gift reserve dialog | Help „z {count} dostupných · společně pro oba“ | `reserve_quantity_of` |

### Adopt

None.

### Build custom

| Proposed Name | Description | Why existing components don't cover it |
| --- | --- | --- |
| `GiftSharedBadge` | Avatar stack + „Společně s: …“ button opening `GiftSharedExplanation` | No badge names other recipients or opens an explanation |
| `GiftSharedExplanation` | Popover/Sheet body: avatar row, role-specific sentence, quantity line, manager list links | Content depends on viewer role and must hide reservation state from recipients |
| `GiftSharedField` | Editor checkbox rows with avatars, current list locked, lock states | Category field is category-specific |
| `GiftBulkShareDialog` | Multi-destination avatar rows plus summary of added categories and shared quantity | Copy dialog is single-select with a move option |

## Implementation Notes

- The badge sets `data-prevent-gift-card-open` and stops card activation, like the category „+X“ trigger; it opens on hover (pointer fine), click/tap and Enter/Space, closes on Escape, outside click or Zavřít, and exposes `aria-expanded`.
- One explanation component serves the badge, the section „Jak to funguje?“ button and the viewer line, so the copy stays identical across surfaces.
- The recipient variant must be chosen server-side from the same "recipient of the shared gift" rule that hides reservation state; the client never receives reservation counts for that viewer.
- Popover motion: about 200 ms fade, scale and slide from the trigger; none under `prefers-reduced-motion`.
- The „· 1 rezervováno“ hint after the price and the „Zarezervováno 1 z 3 ks“ line are visitor and správce only.
- Mockup copy beyond the brief (popover „tento seznam“, „Také na seznamu:“, the three numbered „Jak fungují společná přání“ lines, the bulk quantity sentence) is a proposal; settle the final strings in `messages/cs.json` and `en.json` during implementation.
- The mockup links the compiled `designs/mobile-filter-reset/assets/app.css`, which lacks `--edge`; the file falls back to `--ink` as light mode does.
