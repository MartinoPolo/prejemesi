# Unavailable gift comparison — design summary

**Base:** Variant A | **Approved:** 2026-09-24, selected 50% treatment

[Implementation plan and session handoff](IMPLEMENTATION_PLAN.md).

[Open the refined standalone mockup](refined.html). The comparison and gallery remain interactive.

## Component map

| Reuse | Path | Role |
| --- | --- | --- |
| GiftCard | `src/lib/components/blocks/gift/GiftCard.svelte` | Grid gift surface and content |
| GiftListItem | `src/lib/components/blocks/gift/GiftListItem.svelte` | Genuine horizontal List surface |
| GiftImage / GiftListImage | `src/lib/components/blocks/gift/` | Existing image/crop presentation |
| GiftCategoryBadge / GiftPriorityBadge | `src/lib/components/blocks/gift/` | Existing secondary badge placement and styling |
| GiftStateOverlay | `src/lib/components/blocks/gift/GiftStateOverlay.svelte` | Crisp reservation status, including its label |
| GiftActionRow | `src/lib/components/blocks/gift/GiftActionRow.svelte` | Crisp, operable action lane |

No adoption or new component is proposed by this design-only refinement.

## Implementation notes

Keep status and actions outside dimmed wrappers. The reference screenshot shows a crisp reservation state: **both status and actions are explicit exceptions** to the 50% treatment. Apply one retained-visibility treatment to image, title, description, source link, price and both secondary badges; soften card border/shadow and the image/body separator with the frame. Do not stack the old reserved image veil on top. The separator must visibly divide image and body in both available and reserved Grid, and divide image and body vertically in List; clip the image art inside its image box so it cannot paint over that edge. Source colors and geometry come from `src/app.css` and existing gift components; `designs/tokens.css` is a reference, not the app's canonical token source. The visual treatment is approved; contrast and keyboard usability still require evaluation during implementation. Approval does not certify accessibility or authorize deployment.
