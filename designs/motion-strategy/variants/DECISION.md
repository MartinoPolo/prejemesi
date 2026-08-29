# Motion Strategy Decision

Use Variant A as the visual and structural base, with Variant B’s hidden-gift exit and card/list
transition.

Refinements requested:

- Run the received and hidden-gift sequences at roughly half their previous baseline speed.
- Animate every affected sibling slowly; no gift may jump directly to its final position.
- For a visible `Obdržené` destination, keep the changed gift recognizable while it flies above the
  other gifts to the final section, but only when that same gift identity truly moves between two
  visible sections.
- Gifts newly revealed or removed by filtering enter or exit in place, with at most opacity. They
  never receive translate/FLIP movement merely because they were inserted, revealed, or hidden.
- Capture only rendered, non-zero-size gift rectangles and FLIP only identities visible before and
  after the update. Continuously visible cards whose coordinates genuinely change may still use
  bounded FLIP to avoid jumping.
- For a hidden destination, use Variant B’s local fade/scale exit and slow sibling reflow.
- Do not insert a banner or status row after hiding a gift.
- Keep Variant A’s reservation, wizard, and like micro-animations.
- Use Variant B’s card/list crossfade.
- Treat notification skeleton-to-list loading, import draft-row insertion/removal, and category
  reorder/deletion as the first three approved list/list-order demos and one coherent motion family.
- Reject the image-editor border/frame-mode candidate because it does not correspond to the real
  editor.
- Keep the reorder-mode toolbar as a realistic proposal pending approval: preserve the real toolbar
  and responsive slots; morph only `Změnit pořadí` in place to `Hotovo`; keep incompatible
  view/preview/sort/group/filter/reset/active-filter/settings/batch-add/add-gift controls visible but
  programmatically disabled; add no Save/Cancel session; do not translate/reflow the toolbar or move
  focus; reveal grips in place; and switch immediately under reduced motion.
- Track reorder implementation in standalone issue #268 (`Keep wishlist toolbar stable during gift
  reorder mode`). Its `design needed` label remains pending user approval.
- Keep the current secondary-candidate composition to four demos: the three approved list-motion
  studies plus the reorder proposal pending approval.
- Do not continue Variant C.
