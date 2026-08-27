# Confidence-gated batch review (#260–#264)

## Actionable checklist

### Important

- [x] `src/lib/modules/gift-categories/gift_categories_service.ts`: make staged custom-label swaps safe under the active unique-label index by applying temporary unique labels before final labels.
- [x] `src/lib/components/blocks/wishlist/WishlistSettingsModal.svelte`: route Import-triggered parent closure through the same unsaved-category confirmation used by X, backdrop, and Escape.
- [x] `src/lib/components/blocks/sharing/ShareWizard.svelte`: keep the confirmation action visible on constrained viewports with the established bounded body and fixed-footer layout.
- [x] `src/lib/components/blocks/import/ImportWizard.svelte`: move the deferred Confirm-step commit/retry control into the fixed footer and associate it with the scroll-body form, while retaining summary, progress, errors, and success navigation in the confirm step.
- [x] Add behavioral regression coverage for the atomic category snapshot, deferred save/discard confirmation, and category rename transparency semantics. (The service test exercises label swaps through the real DB transaction boundary; it does not claim a synthetic rollback simulation.)
- [x] Add loaded-image coverage for compact change/remove controls.
- [ ] Extend sticky-footer coverage beyond the Settings Details form to every changed modal/footer path.
  - [x] Categories and Image settings footers have constrained-height browser coverage.
  - [ ] ShareWizard/CreateWishlistModal: visual Playwright already measured these paths; component setup would require invasive context mocks, so no brittle component test was added.
- [ ] `ModeratorPanel` immediate actions remain non-sticky (non-blocking): the panel has no deferred Save/commit footer. Claim, invite, self-promote, and revoke are independent contextual mutations, so choosing one fixed action would be semantically incorrect and making every action sticky would obscure scrollable content. The #260 sticky-control requirement is limited to deferred primary commit controls; retain the current scroll body.

## Nice-to-have

- [x] Remove obsolete per-operation category remote APIs and their stale test mocks after the transactional command replacement.
- [x] Replace the `enabledPresets as never` escape hatch with the actual preset-key type.
- [x] Prefer browser-observable select scrolling assertions over exact Tailwind utility assertions while retaining keyboard reachability coverage.

## Post-fix review

Four reviewers are clean except for the explicitly documented non-blocking `ModeratorPanel` interpretation. Its actions remain intentionally non-sticky because they are independent immediate contextual mutations rather than one deferred primary commit; fixing one action or all actions in place would either misrepresent priority or obscure scrollable content.
