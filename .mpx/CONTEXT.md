# Darecky — What This Is

Darecky ("dárečky" = presents in Czech) is a shareable wishlist web app where users create lists of desired gifts and share them with friends and family. The core mechanic is that the wishlist owner never sees which gifts are reserved, preserving the surprise element. Built with SvelteKit, Tailwind CSS, Drizzle ORM + PostgreSQL.

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
**Sharing** — Distributing a wishlist link; locks the owner from editing/removing existing gifts.
**Archive** — A read-only state for a completed wishlist; visually distinct, no new reservations accepted.
**Unfollowed** — A wishlist the user was previously invited to / followed but has since unfollowed. Tracked for re-discovery via toggle on the Sledované page.

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

| Feature                                                                        | Status  | Version     |
| ------------------------------------------------------------------------------ | ------- | ----------- |
| Authentication (email/password, Google, magic link)                            | Planned | v1 (PRD #1) |
| Anonymous visitor mode (display name + optional email)                         | Planned | v1          |
| Wishlist CRUD (create, edit, archive)                                          | Planned | v1          |
| Gift management (add, edit, remove, reorder via drag-and-drop)                 | Planned | v1          |
| Role system (owner, moderator, visitor)                                        | Planned | v1          |
| Reservation system (reserve/unreserve, quantity support)                       | Planned | v1          |
| Like system (persistent interest indicator)                                    | Planned | v1          |
| Sharing (visitor links, moderator invite links, social buttons)                | Planned | v1          |
| Notification system (email critical, in-app batched)                           | Planned | v1          |
| Three nav pages (Moje seznamy / Spravované / Sledované, no Dashboard)          | Planned | v1          |
| Theming (5 presets + custom, dark/light/system mode)                           | Planned | v1          |
| i18n (Czech primary, English secondary)                                        | Planned | v1          |
| Profile & settings (name, email, avatar, notification prefs)                   | Planned | v1          |
| Owner surprise protection (no reservation visibility, edit lock after sharing) | Planned | v1          |
| Mark gift as received                                                          | Planned | v1          |
| Comments on gifts                                                              | Planned | v2          |
| Mobile app + push notifications                                                | Planned | v2          |
| Price tracking / price drop alerts                                             | Planned | v2          |
| Social features (group gifting, cost splitting)                                | Planned | v2          |
| Gift categories/tags                                                           | Planned | v2          |
| Auto-suggest products (AI/price comparison APIs)                               | Planned | v2          |

## Key Constraints

- Owner NEVER sees reservation state — this is the core product invariant. Enforced at API level (strip data) + UI level (don't render).
- Owner cannot edit/remove gifts after sharing; can only add new ones.
- Reserved gifts cannot be removed by moderators — must contact gifter first.
- Editing a reserved gift by moderator notifies the gifter (email if known).
- Owner self-promoting to moderator triggers notification to all visitors.
- Themes are per-wishlist (owner/moderator sets); dark/light/system mode is per-user. Client-side OKLCH palette derivation for custom themes.
- Anonymous users can visit/reserve but have no persistence (no dashboard, no followed lists). Anonymous → registered auto-links reservations by email match.
- Each gift has a quantity field (default 1, hidden when 1, optional unlimited).
- Wishlists are open — anyone with the link can view and reserve. Logged-in visitors auto-follow on first visit.
- Wishlist lifecycle: Draft → Active (shared) → Archived. Archived wishlists are read-only with banner, existing reservations visible to non-owners.
- App name "Darecky" is final (from Czech "dárečky" = presents).
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
