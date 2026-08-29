# Batch Review

## Actionable Checklist

### Important

- [x] `src/lib/modules/gift-categories/gift_categories_service.ts:91` — `getManagedGiftCategories` unconditionally calls `ensureDefaultGiftCategories`, opening a transaction and locking the wishlist on every manager page load. Load persisted rows first; initialize defaults only when no active or soft-deleted row exists, then reload.
- [x] `src/lib/modules/gift-categories/gift_categories_service.test.ts:137` — default-category coverage does not prove that an explicit all-disabled/soft-deleted configuration prevents default re-insertion. Add a regression test that returns a soft-deleted row and asserts no insert occurs.
- [x] `src/lib/components/blocks/gift/gift_detail_form.svelte.test.ts:93` — rerendering props proves component reactivity but not that `saveGiftCategorySettingsCommand` waits for server-driven refreshes. Add a remote-command test with delayed refresh promises and assert save completion waits for all category/gift revalidation.

## Nice-to-Have

- [x] `src/lib/components/blocks/wishlist/gift_received_motion.ts:34` — remove the now-unused `compactViewport` option and corresponding misleading test arguments.
- [x] `src/lib/components/blocks/wishlist/gift_pointer_reorder.svelte.ts:131` and `src/lib/components/blocks/wishlist/hidden_received_motion.ts:28` — extract the duplicated custom-property materialization loop into a shared DOM helper.
- [x] `src/lib/components/blocks/wishlist/gift_received_motion.svelte.test.ts:272` — replace the fixed two-microtask wait with polling for the observable clone-removal condition while sibling reflow remains unresolved.

## Post-Fix Review

Two autofix iterations completed. The second iteration made `singleFlightRefresh` genuinely awaitable and strengthened its scheduling tests. All four partial-review axes are clean.
