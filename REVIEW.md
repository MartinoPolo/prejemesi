# Review: PRD #1 / Issue #6

Mode: review  
Scope: commit `94a0af444d58bf14f10ef9a61473b965472e82b7` plus current state  
Coverage: full  
Autofix: true, high-confidence/critical only

## Fixed

- Critical: gift URLs allowed unsafe schemes. Added shared URL normalization and server-side create/update enforcement; gift links now render only normalized `http`/`https` URLs.
- Critical: archived wishlists could still be mutated through remote gift and wishlist commands. Added archived guards for create/update/delete/reorder/received and wishlist update.
- Critical: `reorderGifts` accepted gift IDs from multiple wishlists. Added ownership/wishlist consistency validation and scoped updates.
- Important: wishlist creation inserted default priority levels outside the wishlist insert operation. Wrapped creation and default priorities in one transaction.
- Important: wishlist creation accepted blank titles, invalid dates, and invalid themes at the remote boundary. Added validation.
- Important: archive affordance/past-date prompt was missing from the wishlist page. Added owner archive action, confirmation, prompt, and localized messages.
- Important: wishlist E2E coverage did not assert creation/detail flows from requirements. Added focused E2E assertions for create, draft banner, add gift, view switching, and share flow.
- Unrelated blocker encountered during E2E: wishlist page set Svelte contexts after top-level awaits. Moved context setup before async fetch state assignment.

## Remaining Findings

- Important: issue #6 also requires editing wishlist description, banner, thumbnail, theme, and event date. Current UI only exposes theme editing on the detail page.
- Important: reservation overbooking still appears race-prone; reservation capacity checks should be enforced atomically.
- Minor: navbar/dashboard data loading is broader than needed and can be optimized later.

## Verification

- Passed: targeted unit tests for wishlist and gift remotes, 51 tests.
- Previously passed before the final page/test selector edits: `pnpm.cmd run check`, full Vitest, `pnpm.cmd run check:all`.
- Not completed after the final selector patch: focused Playwright rerun was blocked by environment escalation usage limit.
