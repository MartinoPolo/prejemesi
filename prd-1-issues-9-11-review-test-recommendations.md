# PRD #1 / Issues #9-#11 Review and Test Recommendations

Review date: 2026-06-03  
Scope: PRD #1 plus issues #9, #10, #11 against current `dev`

## Requirement Sources

- GitHub issue #1: PRD v1 requires gift CRUD, reservations, likes, followers, owner surprise protection, Storybook interaction coverage for complex components, and critical Playwright flows.
- GitHub issue #9: Gift management and drag-and-drop.
- GitHub issue #10: Reservation system.
- GitHub issue #11: Like system and follower tracking.
- `.mpx/CONTEXT.md`: visitors can reserve, unreserve, and like gifts; anonymous users can reserve but have no dashboard/followed-list persistence.
- `.mpx/DECISIONS.md`: owner never sees reservation state; likes are persistent and notify interested users; remote functions are the client-server boundary.
- `.claude/rules/`: readable rules were `shadcn-svelte.md`, `svelte-context.md`, `sveltekit-paths.md`, and `sveltekit-dev-warmup.md`. `.claude/rules/svelte.md` is referenced as a symlink but currently missing/broken.

## Review Findings

### Important: liked-gift reservation notifications are not created

Requirement: issue #11 says "When a liked gift is reserved by someone else, create a notification record." Current `reserveGift` inserts only into `reservation`; no code queries `giftLike` or inserts `notification`. Search found seeded `liked_gift_reserved` examples and notification types, but no runtime trigger.

Impact: likers receive no in-app/email-critical signal when someone else reserves a gift they liked, breaking the purpose of likes.

Recommended fix: in `reserveGift`, after successful reservation insert, create `liked_gift_reserved` notifications for active likers of the gift except the actor/reserver. For anonymous reservers, use `anonymousName` as `actorName`. Keep email sending deferred to issue #13.

### Important: anonymous gifters cannot self-unreserve

Requirement: PRD and issue #10 say a gifter can unreserve their own reservation. Current implementation supports self-unreserve only for authenticated reservations because `myReservationId` is only returned for authenticated users and `unreserveGift` rejects unauthenticated callers for anonymous reservations.

Impact: an anonymous visitor can reserve incorrectly and loses any correction path after refresh or tab close.

Recommended decision: give anonymous reservations a revocable client-held capability token. Store a hashed token on the reservation, return the raw token once, persist it in localStorage under the wishlist/gift key, and accept `{ reservationId, token }` for anonymous unreserve. If anonymous email is provided, also offer a magic-link recovery flow later.

### Important: stale reservation state after another client reserves

Requirement: visitor should see available/reserved state and not buy duplicates. Current server-side capacity enforcement is good: `reserveGift` locks the gift row with `FOR UPDATE` and rejects overbooking. Current UX still leaves other open clients stale until they act or refresh.

Impact: the second visitor sees a reserve button, clicks, and receives an "available amount is zero" toast. This is safe but rough; it should also refresh the gift list immediately after the failed reserve.

Recommended fix: on `NOT_ENOUGH_AVAILABLE`, call `refreshData()` after the toast so the stale client updates. Then add a focused stale-client E2E test.

Recommended enhancement: use SvelteKit remote-function refresh APIs for mutation-local refreshes (`command().updates(...)` / server `requested(...).refreshAll()` where appropriate). For cross-client updates, evaluate `query.live` only for small availability deltas, or use refocus/visibility refresh plus short polling while a reserve modal is open. `query.live` streams from server to client, but it is not a database pub/sub system by itself; the app still needs a change source or polling loop.

### Important: anonymous likes need a product decision

PRD language says "visitor" can like gifts, but issue #11 says "one like per gift per user" and current schema requires `userId`. Current anonymous visitors cannot like, which matches persistent/user-backed likes but conflicts with the broad visitor wording.

Recommended decision: for v1, require auth/magic link for likes. Likes drive notifications and persistence, so anonymous likes without identity are low value unless we build the same capability-token model as anonymous reservations. UI should show a login/magic-link prompt instead of silently failing/reverting.

### Important: block-level Storybook coverage is below PRD expectation

Requirement: complex block/derived components should have Storybook stories with play functions. Current block stories exist for some wishlist image/crop/theme components, but no stories were found for gift/reservation/sharing block components such as `ReserveModal`, `ReserveButton`, `LikeButton`, `GiftCard`, `GiftListItem`, `GiftDetailModal`, or `ShareWizard`.

Impact: most issue #9-#11 UI behavior is covered only by E2E or remote unit tests, not component-level interaction tests.

Recommended fix: add Storybook stories with play functions for reservation, gift action, and sharing components listed below.

## Exact Test Recommendations

### Unit Tests

1. `src/lib/modules/reservations/reservations.remote.test.ts`
    - `reserveGift creates liked_gift_reserved notifications for active likers except the reserver`
    - `reserveGift uses anonymousName as actorName when anonymous reserver triggers liked-gift notifications`
    - `reserveGift does not notify soft-deleted likes`
    - `reserveGift does not notify wishlist owner if owner somehow has a stale like`
    - `unreserveGift accepts anonymous capability token for matching anonymous reservation`
    - `unreserveGift rejects missing, wrong, or expired anonymous capability token`
    - `unreserveGift keeps current authenticated owner/visitor/moderator authorization rules unchanged`

2. `src/lib/modules/reservations/reservations.race.test.ts`
    - Keep the existing real-Postgres race tests.
    - Add CI/local docs stating this suite skips without a usable `DATABASE_URL`.
    - Add one case where two authenticated users each reserve quantity `2` on quantity `3`; assert total reserved never exceeds `3`.

3. `src/lib/modules/gifts/gifts.remote.test.ts`
    - `getGiftsByWishlistShortId returns no reservation or like fields for normal owner`
    - `getGiftsByWishlistShortId returns reservedCount/isFullyReserved/myReservationId for authenticated visitor`
    - `getGiftsByWishlistShortId returns anonymous reservation token ownership only when current browser token matches` if anonymous token design is accepted.

4. `src/lib/modules/likes/likes.remote.test.ts`
    - If v1 requires auth for likes: assert unauthenticated calls are rejected by guarded remote wrapper and document UI login prompt expectation.
    - If anonymous likes are accepted: add token-backed anonymous like/unlike tests mirroring anonymous reservation token tests.
    - Add a race/uniqueness unit test with a real database or integration harness: two concurrent `toggleLike` calls for the same user/gift cannot create duplicate active likes.

5. `src/lib/modules/wishlists/wishlists.remote.test.ts`
    - `followWishlist does not create follower record for owner`
    - `followWishlist updates lastVisitedAt on every authenticated visit`
    - `followWishlist does not refollow an unfollowed wishlist implicitly`
    - `refollowWishlist clears unfollowedAt and updates lastVisitedAt`

### Storybook Interaction Tests

1. `src/lib/components/blocks/reservation/ReserveModal.stories.svelte`
    - Anonymous submit without name shows inline field error.
    - Quantity selector appears only for quantity > 1.
    - Increment/decrement cannot exceed available count or go below 1.
    - Submit emits `giftId`, `quantity`, `anonymousName`, and optional `anonymousEmail`.
    - Authenticated variant hides anonymous fields and emits no anonymous identity fields.

2. `src/lib/components/blocks/reservation/ReserveButton.stories.svelte`
    - Available gift renders primary reserve action.
    - Fully reserved gift renders disabled reserved state.
    - Current user's reservation renders unreserve action.
    - Archived wishlist hides reserve action but still allows existing user's unreserve if authenticated/token-backed.

3. `src/lib/components/blocks/gift/LikeButton.stories.svelte`
    - Initial liked/unliked state follows likes context.
    - Click optimistically toggles pressed state and count.
    - Remote failure reverts state and count.
    - Anonymous/auth-required variant shows login prompt if v1 requires auth for likes.

4. `src/lib/components/blocks/gift/GiftCard.stories.svelte`
    - Owner variant has no reservation/like controls or counts.
    - Visitor available/reserved/partially-reserved variants show correct actions and counts.
    - Moderator variant shows reservation state without leaking reserver identity in card view.

5. `src/lib/components/blocks/gift/GiftDetailModal.stories.svelte`
    - View mode shows full image, description, price, store link, reserve, and like actions for visitor.
    - Edit mode pre-fills all issue #9 fields.
    - Shared-owner edit-lock variant disables edit/delete for pre-share gifts.
    - Moderator cannot delete reserved gift.

6. `src/lib/components/blocks/sharing/ShareWizard.stories.svelte`
    - Step 1 requires explicit lock confirmation.
    - Step 2 exposes copy link, WhatsApp, email, Messenger, Telegram, SMS.
    - Step 3 shows post-share guidance.

### E2E Tests

1. `tests/e2e/reservation-race.spec.ts`
    - Owner creates and shares a one-quantity gift.
    - Visitor A and Visitor B open the wishlist in separate browser contexts.
    - Visitor A reserves successfully.
    - Visitor B still sees stale reserve button, clicks it, sees the not-available toast, and the page refreshes to disabled/reserved state without manual reload.

2. `tests/e2e/anonymous-reserve.spec.ts`
    - Anonymous visitor reserves with name and email.
    - Same browser can unreserve after refresh.
    - New browser/session cannot unreserve without the capability token.
    - If email recovery is accepted: magic link restores unreserve capability for matching email.

3. `tests/e2e/likes-followers.spec.ts`
    - Authenticated visitor likes a gift, refreshes, still sees liked state.
    - Another visitor reserves that gift.
    - Original liker sees a `liked_gift_reserved` in-app notification.
    - Owner never sees like controls/counts.
    - Anonymous visitor sees explicit auth prompt for like if auth-required decision is accepted.

4. `tests/e2e/owner-no-reservations.spec.ts`
    - Owner cannot infer reservation state from card/list/compact views, detail modal, filters, sort labels, disabled buttons, dashboard cards, or network-returned fields.

5. `tests/e2e/gift-crud-archive.spec.ts`
    - Owner can add all fields from issue #9.
    - After sharing, owner can add a new gift but cannot edit/delete pre-share gifts.
    - Moderator can edit but cannot remove reserved gifts.
    - Owner drag-and-drop order persists and is default visitor order.

## Product Questions to Grill

1. Should anonymous reservations be recoverable only in the same browser via a local token, or also by email magic-link recovery when optional email was provided?
2. Should anonymous users be allowed to like gifts, or should likes require auth/magic link because likes are persistent and notification-backed?
3. Is near-realtime availability necessary for v1, or is "server prevents overbooking + refresh stale client after failed reserve + refresh on tab focus" enough?
4. If realtime is required, should we accept polling/live-query operational cost on Cloudflare Workers, or defer to a later notification/live-update feature?

## Verification

- Could not run targeted Vitest tests because `node_modules` is missing in this worktree; `pnpm.cmd test ...` failed with `vitest is not recognized`.
- No source autofix applied. Findings are review/test recommendations only.
