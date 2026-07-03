# Přejeme si — What This Is

Přejeme si ("dárečky" = presents in Czech) is a shareable wishlist web app where users create lists of desired gifts and share them with friends and family. The core mechanic is that the wishlist owner never sees which gifts are reserved, preserving the surprise element. Built with SvelteKit, Tailwind CSS, Drizzle ORM + PostgreSQL.

## Domain Language

**Wishlist** — A collection of desired gifts created by an owner for a specific occasion.
**Gift** — An item on a wishlist with name, optional description/URL/price/image/priority/quantity.
**Owner** — Creator of a wishlist; can add gifts, mark received, assign moderators; cannot see reservation state.
**Moderator** — User promoted by the owner; sees full state, can add/edit/remove gifts (except reserved ones).
**Visitor** — Anyone viewing a wishlist via a shared link; can reserve, unreserve, and like gifts.
**Gifter** — A visitor who has reserved at least one gift on a wishlist.
**Reservation** — A claim on one or more units of a gift by a visitor; prevents duplicate buying.
**Like** — A persistent interest indicator on a gift; triggers notification if someone else reserves it.
**Theme** — A per-wishlist visual preset (Christmas, Birthday, Fun, Elegant, Default/Custom) defining colors and default illustrations.
**ImageFrame** — The single shared image renderer used for all fixed-size image boxes (gift cards, wishlist cards, avatars). Handles fit mode and focal-point crop consistently across surfaces.
**Fit mode** — One of three rendering modes for an ImageFrame: `auto` (browser default), `contain-padded` (letterboxed, shows frame fill), or `cover-crop` (fills frame, clipped by focal point + zoom).
**Focal point** — A persisted `{ x, y, zoom }` triple (x/y in percent 0–100, zoom ≥ 1) that is the canonical crop representation consumed by the renderer. Resolution- and aspect-ratio-independent.
**Crop rect** — A normalized 0–1 editing rectangle persisted alongside focal point so the crop editor can restore the exact region the user drew. Not used for rendering — focal point is.
**Image slot** — A named display position on a wishlist: `card`, `thumbnail`, `banner`, or `social`. Each slot carries its own independent crop metadata (`image_slots` JSON column).
**App background theme** — A per-user tint applied to the app shell: `default`, `golden-hour`, or `twilight`. Set via `data-bg-theme` on `<html>`, applied server-side to avoid flash-of-wrong-theme.
**Wishlist theme tokens** — The `--wishlist-*` CSS custom properties that express a wishlist's color identity (primary, accent, surface). Scoped to the wishlist page; must not leak into the app shell.
**Image-frame fill** — The `--frame-fill` background color shown behind letterboxed images. Resolved from a priority chain: slot-specific override → wishlist theme surface → global fallback.
**OKLCH palette** — The color-derivation strategy for custom wishlist themes: one input color produces a harmonious full palette via OKLCH lightness/chroma adjustments, computed client-side for live preview.
**Sharing** — Distributing a wishlist link. Freezes each existing gift's identity (`name`) and blocks delete, but leaves presentation/info fields editable (image, links, price, priority, append-only description; quantity raise-only). See Post-share editing.
**Post-share grace window** — A 2-minute reversibility window for sharing, each description append, and the event-date lock; later gift edits never reopen gift name/delete grace.
**Description append** — A post-share description change: an immutable, accent-colored, timestamped addition. The original text freezes at share time and is preserved for the gifter; cards show only the latest append by default with a toggle for full history.
**Archive** — A read-only state for a completed wishlist; visually distinct, no new reservations accepted.
**Unfollowed** — A wishlist the user was previously invited to / followed but has since unfollowed. Tracked for re-discovery via toggle on the Sledované page.
**Gift draft** — An unsaved, editable gift row (name, notes, link(s), price) in the import or batch grid, before it is committed as a real Gift.
**Draft grid** — The editable multi-row table that powers both the import Review step and batch gift entry; each row is a Gift draft.
**Enrichment** — Auto-filling a gift's image / price / title from its link (and, in a later phase, by searching for it by name).
**Import wizard** — The 3-step Source → Review → Confirm flow that turns a pasted/uploaded CSV or Google Sheet into gifts.
**Batch add** — Adding multiple gifts at once via the shared draft grid (distinct from the import wizard, which sources data externally).
**Piece count** — The number of pieces (quantity) for a gift, displayed on gift cards in a role-conditional way (owner sees count only, never reserved count).
**Multi-link** — Multiple URLs attached to a single gift (up to 10); `links[0]` is treated as the primary link.

_Avoid_: "list" for Wishlist (ambiguous), "present" for Gift (confusing with time), "bookmark" for Like, "claim" for Reservation.

## Relationships

- User 1:N Wishlist (as owner)
- Wishlist N:N User (as moderator)
- Wishlist N:N User (as visitor/follower)
- Wishlist 1:N Gift
- Gift 1:N Reservation
- Gift N:N User (as liker)
- Reservation N:1 User (or anonymous with display name + optional email)

## Core Features

| Feature                                                                        | Status      | Version     |
| ------------------------------------------------------------------------------ | ----------- | ----------- |
| Authentication (email/password, Google, magic link)                            | Planned     | v1 (PRD #1) |
| Anonymous visitor mode (display name + optional email)                         | Planned     | v1          |
| Wishlist CRUD (create, edit, archive)                                          | Planned     | v1          |
| Gift management (add, edit, remove, reorder, image fit/crop)                   | In Progress | v1          |
| Role system (owner, moderator, visitor)                                        | Planned     | v1          |
| Reservation system (reserve/unreserve, quantity support)                       | Planned     | v1          |
| Like system (persistent interest indicator)                                    | Planned     | v1          |
| Sharing (visitor links, moderator invite links, social buttons)                | Planned     | v1          |
| Notification system (email critical, in-app batched)                           | Planned     | v1          |
| Three nav pages (Moje seznamy / Spravované / Sledované, no Dashboard)          | Planned     | v1          |
| Theming (wishlist themes + app background theme + token separation)            | In Progress | v1          |
| i18n (Czech primary, English secondary)                                        | Planned     | v1          |
| Profile & settings (name, email, avatar, notification prefs, appearance theme) | In Progress | v1          |
| Owner surprise protection (no reservation visibility, post-share edit rules)   | Planned     | v1          |
| Mark gift as received                                                          | Planned     | v1          |
| Comments on gifts                                                              | Planned     | v2          |
| Mobile app + push notifications                                                | Planned     | v2          |
| Price tracking / price drop alerts                                             | Planned     | v2          |
| Social features (group gifting, cost splitting)                                | Planned     | v2          |
| Gift categories/tags                                                           | Planned     | v2          |
| Auto-suggest products (AI/price comparison APIs)                               | Planned     | v2          |
| CSV / Google Sheets import (3-step wizard)                                     | Done        | v1.x        |
| Bulk gift entry (shared draft grid, large dialog)                              | Done        | v1.x        |
| Gift metadata enrichment (link → image/price/title)                            | Planned     | v1.x        |
| Multiple links per gift (max 10)                                               | Done        | v1.x        |

## Key Constraints

- Owner NEVER sees reservation state — this is the core product invariant. Enforced at API level (strip data) + UI level (don't render).
- After sharing, the owner can edit existing gifts' presentation/info fields (image, links, price, priority) + append to the description, and raise (never lower) quantity; `name` is frozen and delete is blocked. Edits apply uniformly to all gifts (never reservation-conditional) and are surfaced via an "Upraveno po sdílení" badge. A 2-min grace after sharing allows full edit/undo only for the initial share transition; later edits never reopen delete/name grace. Gifts added after sharing can be deleted only within 2 minutes of creation and never when reserved.
- Reserved gifts cannot be removed by moderators — must contact gifter first.
- Editing a reserved gift by moderator notifies the gifter (email if known).
- Owner self-promoting to moderator triggers notification to all visitors.
- Themes are per-wishlist (owner/moderator sets); dark/light/system mode is per-user. Client-side OKLCH palette derivation for custom themes.
- Anonymous users can visit/reserve but have no persistence (no dashboard, no followed lists). Anonymous → registered auto-links reservations by email match.
- Each gift has a quantity field (default 1, hidden when 1, optional unlimited).
- Wishlists are open — anyone with the link can view and reserve. Logged-in visitors auto-follow on first visit.
- Wishlist lifecycle: Draft → Active (shared) → Archived. Archived wishlists are read-only with banner, existing reservations visible to non-owners.
- App name "Přejeme si" is final (from Czech "dárečky" = presents).
- No GDPR/cookie banners — family app scope.
- Deployed on Cloudflare Workers (free) + Neon Postgres (free) + Cloudflare R2 (free, presigned URLs for uploads) + Resend (free).
- Uses SvelteKit remote functions (query/form/command) for all client-server communication.
- BetterAuth with `better-auth/minimal` (edge-compatible); guarded remote function wrappers for auth-protected endpoints.
- Fallow for dead-code detection (replaces knip); regression-gated in CI and pre-push.
- Component tiers: `base/` (shadcn), `derived/` (reusable wrappers), `blocks/` (feature-level). All new components use `tailwind-variants` pattern.
- Domain modules at `src/lib/modules/` — each owns types, remote functions, context (`createContext` API), and public API.
- English URL slugs. Supported currencies: CZK (default), EUR, USD.
- V1 is a single release — all 16 core features ship together.
- `src/app.css` is the canonical design token source. `designs/tokens.css` is design reference only.
- Import: CSV/Google-Sheets import creates gifts via a 3-step wizard (Source → editable draft grid with smart column detection + dedup → Confirm), with two entry points (new wishlist / append). Inputs: file upload, paste-cells, paste Sheets link (server fetch). No Google OAuth. Limits 200 rows / 1 MB. PapaParse for parsing.
- Gifts can carry up to 10 links (`links` jsonb array; `links[0]` is primary). Replaces the single `url` column.
- Piece-count / reservation display on gift cards is role-conditional — the owner sees the piece count only, never the reserved count.
- Metadata enrichment (image/price/title from a link) is per-item and progressive via an external metadata API (free tier, callable client-side). Name-based product search is best-effort and deferred.
