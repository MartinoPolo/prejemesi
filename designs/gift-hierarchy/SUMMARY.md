# Gift hierarchy — approved design summary

**Issue:** [#377](https://github.com/MartinoPolo/prejemesi/issues/377) · **Base:** Variant A · **Approved:** 2026-09-14

[Open the approved mockup](refined.html). The [design brief](DESIGN_BRIEF_GIFT_HIERARCHY.md) remains the authoritative requirements document. The `design needed` label was removed from #377 and [approval was recorded](https://github.com/MartinoPolo/prejemesi/issues/377#issuecomment-5669742952). No design questions remain.

## Final direction

- Category is image top-left; priority is image bottom-left.
- Reservation/received state and authorized identity form one group centered on the image. Preserve all server-derived privacy gates and do not duplicate identity in content.
- Grid Like is image top-right with a separate wrapping category lane. List Like and quantity align to the first title line through typography-derived alignment, retaining the accessible hit target.
- Titles are 18 px mobile / 24 px desktop, clamp to two lines, keep quantity outside the clamp, and expose the full name through existing gift detail.
- List content starts at its ordinary top inset. Grid cards in one row have equal height. Actions stay bottom-aligned.
- Received uses a shared full-ink secondary intent, distinct from Reserve and stronger than More.

## Do not copy from the mockup

- **Mobile List is broken:** its grid-like stacking is excluded from approval. Preserve genuine side-by-side mobile List rows and the shared square image/crop contract; use only necessary constrained-content or enlarged-text fallbacks. Verify the real layout in the application.
- Badge appearance and the prototype sizing behavior are schematic. Reuse production badge components, shared geometry, crop behavior, role gates, and contextual selection/reorder controls.

## Component map

| Reuse | Purpose |
| --- | --- |
| `GiftCard`, `GiftListItem` | Approved hierarchy and responsive layouts |
| `LikeButton`, `GiftPieceCount` | Like/count placement and title-line alignment |
| `GiftCategoryBadge`, `GiftPriorityBadge`, `GiftStateOverlay` | Real badge styling and approved overlay positions |
| `GiftActionRow`, `GiftReceivedToggle`, `ReserveButton` | Existing role/state behavior and bottom action lane |
| Shared Button intents | Full-ink secondary; audit consumers before changing defaults |
| Existing gift detail | Full title disclosure |

No dependency or new production primitive is required.

## Implementation boundary

Application code, correct mobile List composition, shared-intent changes, seed/fixture enrichment, and production tests remain outstanding. Validate crowded states, light/dark, narrow widths, enlarged text, permissions, focus, crop fidelity, and selection/reorder collisions. Design approval does not certify production behavior or authorize production-data changes. Related #376 is coordination work, not a hard blocker.
