# Confidence-gated batch review (#245 / #246)

## Reviewers and findings

- **Reviewer 1 — import transaction safety:** duplicate-warning detection ran after category resolution, allowing category creation/restoration to commit without gift import.
- **Reviewer 2 — gifts context reactivity and persistence:** a derived calculation mutated persisted grouping state; browser storage failures could also break rendering and migration.
- **Reviewer 3 — category transaction/concurrency safety:** category assignment could race soft-delete; preset enable could race the partial unique constraint; application-normalized custom labels could race creation/rename.
- **Reviewer 4 — import error handling:** the wizard discarded actionable server errors and the confirmation step displayed only a generic message.

## Fixes applied

- Moved duplicate detection ahead of imported category resolution, so warning-only append attempts perform no category structure mutation.
- Made effective grouping derivation pure and moved browser-only persistence coercion to an effect.
- Guarded localStorage read/write/repair/migration operations so unavailable storage falls back to in-memory defaults while serde/programming errors remain visible.
- Kept category assignment validation and gift create/update writes in the same transaction, with the category row locked through the write.
- Serialized all category structure mutations on the wishlist row. Rename/delete discover the wishlist without a row lock, then lock in the consistent wishlist-row → category-row order before re-reading and mutating. Enable/disable, create, reorder, and import-plan mutations use the same serialization; import/create already enter through the transactional append service.
- Preserved category in-use guards for preset disable and custom delete.
- Preserved the thrown import failure, translated it with the existing server-error convention, and rendered the translated message in the confirmation error alert.
- Updated remote DB mocks to execute transaction callbacks, so update behavior tests exercise the transaction boundary rather than bypassing it.

## Tests and checks run

- `pnpm exec vitest run src/lib/modules/gift-categories/gift_categories_service.test.ts src/lib/modules/gifts/gifts.context.test.ts src/lib/modules/import/import.remote.test.ts src/lib/modules/import/duplicate_aware_submission.test.ts src/lib/modules/gifts/gifts.remote.test.ts` — passed: 5 files, 103 tests.
- `pnpm run check` — passed: 0 errors, 0 warnings.

## Intentionally unresolved

None.
