# Decisions

Settled architectural and design decisions for Darecky.

## Product & Domain

### Owner never sees reservation state

Decided: 2026-05-29
What: The wishlist owner cannot see which gifts are reserved, who reserved them, or any reservation counts.
Why: The surprise element is the core product differentiator — the owner should be genuinely surprised by their gifts.
Rejected: Partial visibility (e.g., showing counts but not names) — still leaks info and weakens the surprise.

### Sharing locks owner editing

Decided: 2026-05-29
What: Once a wishlist is shared, the owner can only add new gifts. Edit and remove are locked for existing gifts.
Why: Prevents the owner from accidentally removing a reserved gift or inferring reservation state from blocked actions.
Rejected: Soft-delete approach (owner thinks they removed it but it persists) — too deceptive, confusing edge cases.

### Single reservation state (no "bought" step)

Decided: 2026-05-29
What: Gifts have one binary state: free or reserved. No separate "bought" confirmation.
Why: Simpler model. The distinction between "reserved" and "bought" adds complexity without clear user value — the gifter knows whether they bought it.
Rejected: Two-step (reserve → bought) — unnecessary granularity.

### Like system for interest signaling

Decided: 2026-05-29
What: Visitors can "like" a gift to indicate interest. Likes are persistent (not auto-removed by reserving). If a liked gift is reserved by someone else, the liker is notified.
Why: Solves the "too many notifications" problem — only interested parties get notified, not all followers.
Rejected: Notify all followers on every reservation (too noisy), no notification system (users buy duplicates).

### Quantity field on gifts

Decided: 2026-05-29
What: Each gift has a max quantity (default 1, hidden when 1, optional unlimited). Visitors choose how many units to reserve.
Why: Supports real-world cases like "3 towels" without forcing duplicate gift entries.
Rejected: One entry = one reservation only (too limiting for fungible items).

### Open wishlist access

Decided: 2026-05-29
What: Anyone with the wishlist link can view and reserve gifts. No access control or invite-only mode.
Why: Simplicity — wishlists are shared with trusted people. Restricted mode adds friction without clear value for a family app.
Rejected: Invite-only mode (planned never — unnecessary for target audience).

### Manual archive only

Decided: 2026-05-29
What: Owner manually archives wishlists. If an event date is set, a prompt suggests archiving after the date passes.
Why: Auto-archive could catch users off guard (late gift-givers). Manual control is safer.
Rejected: Auto-archive after event date (too aggressive), time-based expiry (arbitrary).

## Roles & Permissions

### Owner can add gifts but not moderate by default

Decided: 2026-05-29
What: Owner adds gifts to their wishlist and marks received. They cannot edit, remove, or see reservation state unless they self-promote to moderator.
Why: Clean separation — the owner is the "recipient" role, not the "manager" role.
Rejected: Owner has full edit powers (breaks surprise mechanic if they notice blocked removals).

### Moderator assigned by owner only

Decided: 2026-05-29
What: Only the owner can promote users to moderator (via invite link with token or by email). Moderators cannot promote others. No limit on moderator count.
Why: Owner controls trust chain. Preventing moderator-to-moderator promotion avoids uncontrolled access spread.
Rejected: Moderators can promote others (security risk), single moderator limit (too restrictive for families).

### Owner self-promote to moderator with disclosure

Decided: 2026-05-29
What: Owner can opt into moderator role (seeing full state), but this triggers a notification to all visitors and shows a permanent banner on the wishlist.
Why: Maintains trust — visitors know the surprise is no longer protected for this wishlist.
Rejected: Silent self-promote (breaks trust), no self-promote option (too restrictive for some use cases).

## Authentication & Users

### Auth: email/password + Google + magic link

Decided: 2026-05-29
What: Three auth methods via BetterAuth. Magic link is critical for low-friction access from shared links.
Why: People arriving from WhatsApp/email shares shouldn't need to create a password to reserve a gift.
Rejected: Social-only (excludes non-Google users), password-only (too much friction for casual visitors).

### Anonymous visitor mode

Decided: 2026-05-29
What: Anonymous users can visit wishlists and reserve gifts. They provide a display name (required) + email (optional). No persistence — no dashboard, no followed lists.
Why: Minimizes friction for one-time visitors (grandma who just wants to reserve a gift).
Rejected: Require account for all actions (too much friction), fully anonymous without any identifier (moderator can't see who reserved what).

## UI & Theming

### Per-wishlist themes with 5 presets + custom

Decided: 2026-05-29
What: Each wishlist has a theme set by owner/moderator. Presets: Christmas, Birthday, Fun, Elegant, Default (yellow base). Custom = one color picker, palette auto-derived via OKLCH.
Why: Themed wishlists feel personal and festive. OKLCH derivation ensures harmonious palettes from a single input.
Rejected: User-level themes (wishlists should look the same for all visitors), full color customization (too complex, inconsistent results).

### Dark/light/system mode per-user

Decided: 2026-05-29
What: Users toggle between dark, light, and system mode. This is independent of wishlist themes — it controls the app chrome and adapts theme colors.
Why: Standard accessibility expectation. Per-user because it's a display preference, not content.
Rejected: Per-wishlist mode (visitors should control their own viewing comfort).

### Three nav pages, no Dashboard

Decided: 2026-05-30 (revised from 2026-05-29)
What: Three first-level nav items: Moje seznamy, Spravované, Sledované — each is a separate page. No separate "Dashboard" page. "Moje seznamy" is the default/home page. Each nav item doubles as a dropdown trigger (hover shows recent items + "Zobrazit vše" link). Nav layout: Logo | Moje seznamy | Spravované | Sledované | [gap] | Vytvořit | 🔔 | 🌙 | 👤
Why: Fills the nav naturally, no redundancy (Dashboard would duplicate the same content), each page owns its own filters/sorting, dropdowns provide quick access.
Rejected: Single dashboard with tabs (redundant), Dashboard + three sub-pages (4 nav items, Dashboard page adds nothing).

### Gift sorting: primary + secondary criteria

Decided: 2026-05-29
What: Owner sets default display order (drag-and-drop). Visitors can sort by: owner's order, priority, price, name, date added. Primary + secondary sort (Grovekeeper-style).
Why: Flexible for visitors while respecting owner's intent.
Rejected: Fixed sort only (too rigid), no default order (owner can't influence presentation).

### Gift detail as modal/drawer

Decided: 2026-05-29
What: Gift list view with expandable detail modal on click. Full image, description, link, price, reservation status (for non-owners).
Why: Keeps single-page feel, avoids per-gift URL routing complexity.
Rejected: Inline accordion (too noisy for long descriptions), dedicated gift pages (over-engineered for v1).

## Sharing & Links

### Permanent visitor URL + revocable moderator invite tokens

Decided: 2026-05-29
What: Each wishlist has a permanent URL (`/w/<short-id>`) for visitors. Moderator access via separate invite links with one-time/revocable tokens. Owner can revoke moderators individually.
Why: Simple sharing (one link for visitors), controlled access (revocable tokens for moderators).
Rejected: Single link with role parameter (security risk), separate links per visitor (over-complicated).

### Social sharing via intent URLs

Decided: 2026-05-29
What: Share buttons use standard intent URLs (WhatsApp `wa.me/?text=`, `mailto:`, etc.) with pre-filled messages. No API integrations needed.
Why: Works universally, no third-party API keys or rate limits, covers WhatsApp/email/Messenger/Telegram/SMS.
Rejected: Deep API integrations (maintenance burden, API key management), copy-link only (misses the low-friction sharing opportunity).

## Notifications

### Email for critical, in-app for everything else

Decided: 2026-05-29
What: Critical events (liked gift reserved by someone else, reserved gift edited by moderator, wishlist archived) sent via email. Non-critical (gifts reserved on followed lists, new gifts added) batched in-app only.
Why: Prevents notification fatigue while ensuring important events aren't missed.
Rejected: All by email (too noisy), all in-app only (critical events missed by inactive users).

## Data & Storage

### Separate banner and thumbnail uploads per wishlist

Decided: 2026-05-29
What: Owner uploads a hero banner (wishlist page) and a thumbnail (dashboard cards) separately. Theme presets provide default illustrations that the owner can override.
Why: Different aspect ratios serve different contexts (wide banner vs square thumbnail). Defaults reduce friction for users who don't want to upload.
Rejected: Auto-crop from single upload (poor results for extreme aspect ratios), no images (bland).

### Gift images: URL + upload

Decided: 2026-05-29
What: Gift images can be added via external URL (link from a store) or file upload.
Why: URL is quick for linking from stores; upload covers custom items and stores without stable image URLs.
Rejected: URL-only (too limiting), upload-only (unnecessary friction for store items).

## Platform & Infrastructure

### App name: Darecky

Decided: 2026-05-29
What: Final app name is "Darecky" (from Czech "dárečky" = presents/gifts).
Why: Personal project, Czech audience, meaningful name.
Rejected: N/A — personal choice.

### Czech primary, English secondary

Decided: 2026-05-29
What: Czech is the primary language; English is the only other supported language. Uses Paraglide JS i18n.
Why: Czech creator, Czech target audience, Czech app name. English for international friends/family.
Rejected: English-first (doesn't match audience), more languages (unnecessary scope for a family app).

### No GDPR/cookie banners

Decided: 2026-05-29
What: No cookie consent banners or GDPR compliance UI in v1.
Why: Family app scope — the overhead isn't justified for the target audience.
Rejected: Full GDPR compliance (over-engineered for personal project).

### Cloudflare Workers + Neon Postgres + R2 ($0/month)

Decided: 2026-05-30
What: Deploy on Cloudflare Workers (free) with Neon Postgres via Hyperdrive, R2 for images, Resend for email. All free tiers.
Why: $0/month is a hard requirement for a family app. Current template already uses adapter-cloudflare. `postgres` v3.4.8 supports Workers TCP via Hyperdrive. `better-auth/minimal` is edge-compatible. Neon has no pause/deletion risk (just 300-800ms cold starts after 5min idle).
Rejected: Railway ($5-7/mo), Fly.io (no free tier since 2024), Render (free Postgres expires in 30 days), Vercel (would require driver changes), adapter-node (all Node hosting costs money).

### SvelteKit remote functions for all client-server communication

Decided: 2026-05-30
What: Use `query` for reads, `form` for progressive-enhancement mutations, `command` for JS-only actions. No traditional `+page.server.ts` load functions or `+server.ts` API routes (except BetterAuth catch-all).
Why: Remote functions provide type-safe, colocated, deduplicated client-server communication. Single-flight mutations reduce round-trips. Progressive enhancement via `form` is important for a family app used on diverse devices.
Rejected: Traditional load + form actions (worse DX, no colocation, no dedup), tRPC (extra dependency, remote functions are built-in).

### Guarded remote function wrappers for auth

Decided: 2026-05-30
What: Reusable `guardedQuery`, `guardedCommand`, `guardedForm` wrappers that call `getRequestEvent()` and check `locals.user` before executing. BetterAuth's API routes stay for auth operations; remote functions handle app logic.
Why: Avoids repeating auth checks in every remote function. BetterAuth handles auth flow (cookies, OAuth redirects, CSRF); remote functions handle app data.
Rejected: Inline auth checks in each function (repetitive, error-prone), replacing BetterAuth routes with remote functions (breaks cookie/redirect flow).

## Repository Structure

### Domain modules at src/lib/modules/

Decided: 2026-05-30
What: Each domain concern gets a module directory: wishlists, gifts, reservations, likes, notifications, themes, sharing. Each module owns types, remote functions (.remote.ts), context (.context.svelte.ts), and index.ts public API.
Why: Proven pattern from Grovekeeper. Small interface, large implementation. Modules are self-contained and testable.
Rejected: Flat file structure (doesn't scale), feature-based routes (couples domain logic to routing).

### Component tiers: base / derived / blocks

Decided: 2026-05-30
What: Three tiers — `base/` (shadcn-managed primitives, do not edit), `derived/` (reusable wrappers combining base components), `blocks/` (feature-level composed UI like WishlistCard, GiftDetailModal).
Why: Clear ownership and abstraction layers. Matches Grovekeeper's proven pattern with naming aligned to the user's preference.
Rejected: Two tiers only (blocks get mixed with primitives), four tiers (over-engineered for this app's complexity).

### Fallow for dead-code detection (replaces knip)

Decided: 2026-05-30
What: Use fallow with regression baseline gating. Run in check:all and pre-push (parallel). Suppressions via `// fallow-ignore-next-line <rule>` and `/** @public */`. Stale suppressions are errors.
Why: Fallow provides richer analysis than knip (unused exports, circular deps, complexity, boundary violations). Grovekeeper uses it successfully.
Rejected: knip (less capable, being replaced across projects).

### Pre-push parallel checks

Decided: 2026-05-30
What: Pre-push hook runs fallow, svelte-check, eslint, and vitest in parallel via a Node script. Pre-commit stays lightweight (lint-staged: oxlint + prettier only).
Why: Fast feedback before pushing without blocking commits during active development.
Rejected: All checks in pre-commit (too slow, blocks flow), no pre-push checks (regressions reach CI).

### Symlink four rules from mpx-claude-code

Decided: 2026-05-30
What: Symlink svelte.md, shadcn-svelte.md, svelte-context.md, sveltekit-paths.md from mpx-claude-code/rules-per-project/ into .claude/rules/.
Why: Consistent Svelte conventions across projects. Rules are maintained centrally.
Rejected: Copy rules (drift risk), no rules (inconsistent conventions).

## Wishlist Page UI

### Three gift view modes: card, list, compact

Decided: 2026-05-30
What: Visitors can switch between Card (image grid), List (thumbnail + horizontal rows), and Compact (dense table — no images). View switcher is a 3-icon toggle group in the toolbar. All views show the same data; layout density changes.
Why: Different use cases — Card for browsing/visual appeal, List for scanning with context, Compact for quick overview of many items. Matches common e-commerce patterns.
Rejected: Single fixed layout (too rigid for diverse wishlists), two views only (compact table adds real value for long lists).

### Gift link always visible

Decided: 2026-05-30
What: Every gift shows a clickable link to the source store (external-link icon + truncated domain, e.g. "↗ alza.cz"). Items without a link show "Bez odkazu" grayed out. Link is visible in all three view modes.
Why: The primary action for visitors is to buy the gift — the link must be immediately accessible without expanding a detail view.
Rejected: Link hidden behind a click/hover (adds friction), full URL display (too noisy, domains are sufficient).

### Owner name prominent in wishlist header

Decided: 2026-05-30
What: The wishlist owner's name is displayed above the wishlist title in a large, primary-colored heading (`text-2xl`, bold). Visitors always see whose wishlist they're viewing.
Why: When a visitor arrives via a shared link, they need immediate context about who this list belongs to. Previously the name was small and easy to miss.
Rejected: Owner name in subtitle only (too subtle), owner name in nav bar (conflicts with logged-in user identity).

### Sort and filter as icon-only dropdown trigger

Decided: 2026-05-30
What: Sorting and filtering are accessed via a single icon-only button (funnel/sliders icon) in the top-right toolbar. Clicking opens a dropdown with sort options (owner's order, priority, price, name) and filter toggles (available only, with link only).
Why: Keeps the toolbar compact. Sort/filter is a secondary action — most visitors use the owner's default order. Icon-only saves horizontal space for the view switcher.
Rejected: Separate sort + filter buttons (takes too much space), inline sort controls (clutters the header).

## Design — UI Review (2026-05-30)

### App Shell: Top navbar for desktop

Decided: 2026-05-30
What: Desktop layout uses a top horizontal navbar (56px height). Base: variant 1 with dropdown inspiration from variant 2. Sidebar layout reserved for mobile (variant 3 style, future).
Why: Clean, familiar pattern for desktop. Sidebar is better suited for mobile touch targets.
Rejected: Persistent sidebar (variant 4), breadcrumb-based nav (variant 5).
Reference: `designs/app-shell/variant-1.html` (primary), `variant-2.html` (dropdown ref), `variant-3.html` (mobile ref).

### App Shell: Logo with custom icon + dimmed TLD

Decided: 2026-05-30
What: Custom logo icon + "darecky" text + dimmed TLD suffix (e.g., ".cz") with visible gap between name and TLD. Both logo and text are links to the home/default page. Domain TBD — darecky.cz unavailable, may change name or TLD.
Why: The visual gap between name and suffix is distinctive. Linking both provides easy home navigation.

### App Shell: Nav items as links + dropdown triggers

Decided: 2026-05-30
What: Main navigation items (Moje seznamy, Spravované, Sledované) function as links (click navigates) AND have dropdown menus on hover showing recent items + "Zobrazit vše" link. No "Nový seznam" or "Archivované" in dropdowns.
Why: Dropdowns provide quick access without navigation. Separate "Vytvořit" button handles creation. Archive is a separate concern (TBD).
Rejected: Dropdowns containing "Nový seznam" or "Archivované" (cluttered).

### App Shell: Unified ghost button toolbar items

Decided: 2026-05-30
What: Notification bell and dark mode toggle use ghost button styling. "Vytvořit" uses primary button variant. Icons from Lucide library exclusively.
Why: Consistent visual weight for secondary actions. Primary button draws attention to the main CTA.

### App Shell: Google OAuth shows profile image

Decided: 2026-05-30
What: When user authenticates via Google, their Google profile image is shown as the avatar instead of initials.
Why: Personal, recognizable. Initials fallback for email/password users.

### App Shell: Page title + toolbar merged into single row

Decided: 2026-05-30
What: Each page has a single title row with the page name on the left and toolbar actions (sort, filter, view switcher) as ghost buttons on the right. No separate toolbar below the title — merge them.
Why: Prevents title duplication (nav shows section name, then title repeats it below). Single row is cleaner.
Rejected: Separate title + toolbar rows (duplicates page name).

### App Shell: Sorting via explicit buttons in page toolbar

Decided: 2026-05-30
What: Sorting uses explicit labeled buttons/presets in the page toolbar (top-right, same row as page title). More explicit than icon-only triggers.
Why: Sort is important enough to be visible and labeled, not hidden behind an ambiguous icon.
Rejected: Sort presets in nav dropdown (not discoverable), icon-only sort trigger (not explicit enough).

### Auth Pages: Split screen layout

Decided: 2026-05-30
What: Auth pages (login, register, magic link) use a split-screen layout — branding/illustration on the left, form on the right. Standalone layout, not inside the app shell.
Why: Warm, branded experience that establishes the app identity before the user enters.
Reference: `designs/auth-pages/variant-2.html`.

### Dashboard: Two switchable views (card + list)

Decided: 2026-05-30
What: Dashboard supports two view modes: card grid (variant 3 style) and list rows (variant 2 style). User can switch between them.
Why: Cards for visual browsing, list for quick scanning. Same pattern as wishlist gift views.
Reference: `designs/dashboard/variant-3.html` (cards), `designs/dashboard/variant-2.html` (list).

### Dashboard: Card design — variant 3 style

Decided: 2026-05-30
What: Wishlist cards use variant 3 design: title inside the banner image, theme tag inside card body, hover effect with ring/border + shadow increase + slight lift. No visible border between banner and card body. Creation date prefixed with "Vytvořeno" + last edited date on the same line. Gift count visible. All action buttons use consistent variant and icon style.
Why: Cleaner integration of title with banner. Unified button styling prevents visual confusion.
Rejected: Title below banner (variant 1), inconsistent button variants (some primary, some outline, some with icons, some without).

### Dashboard: Status badges must work on all backgrounds

Decided: 2026-05-30
What: Status badges (Sdíleno, Koncept, Archivováno) must be legible on all banner/background colors. Adapt Grovekeeper badge component pattern.
Why: Current design shows "Sdíleno" badge barely visible on teal banner backgrounds.

### Dashboard: Archived cards dimmed

Decided: 2026-05-30
What: Archived wishlist cards use desaturated/grayish treatment to visually distinguish them from active lists.
Why: Clear visual hierarchy — archived items should recede.

### Dashboard: Progress bar for moderated/followed views

Decided: 2026-05-30
What: Moderated and followed wishlist cards show a reservation progress bar (e.g., "7/12 rezervováno").
Why: Moderators and followers need at-a-glance reservation status. Owners NEVER see this.

### Archive display: Toggle filter per page

Decided: 2026-05-30
What: Each page (Moje seznamy, Spravované, Sledované) has a "Zobrazit archivované" toggle in the toolbar. Off by default. When on, archived cards appear dimmed at the bottom.
Why: Keeps the default view clean. Users with many archived lists aren't cluttered. Simple toggle is discoverable.
Rejected: Always visible dimmed at bottom (clutters view), separate archive tab (unnecessary nav item).

### Unfollowed wishlists: Toggle filter on Sledované

Decided: 2026-05-30
What: The Sledované page has a "Zobrazit opuštěné" toggle. Unfollowed lists appear dimmed with a "Znovu sledovat" button. This was missed during the original grilling.
Why: Users may want to revisit a list they previously unfollowed. Toggle keeps the default view clean while preserving access. Simpler than a separate section.
Rejected: No tracking (user may lose the link), separate "History" section (over-engineered), automatic "Recently visited" (too magical).

### Gift Detail Modal: Center modal 2-column

Decided: 2026-05-30
What: Gift detail uses a centered modal with 2-column layout — image on the left, details + actions on the right. Works on both desktop and mobile (stacks vertically).
Why: Keeps single-page feel, familiar e-commerce pattern, responsive-friendly.
Reference: `designs/gift-detail-modal/variant-1.html`.
Rejected: Right drawer (variant 2), bottom sheet (variant 3), full-width cinematic (variant 4), inline card expand (variant 5).

### Landing Page: Feature showcase layout

Decided: 2026-05-30
What: Landing page uses a feature showcase layout (variant 2) with alternating sections. Story-driven variant (variant 3) kept as secondary reference.
Why: Best balance of product communication and visual appeal.
Reference: `designs/landing-page/variant-2.html` (primary), `variant-3.html` (reference).
Rejected: Hero-centric (variant 1), social proof (variant 4), minimalist (variant 5).

### Sharing Flow: Multi-step wizard

Decided: 2026-05-30
What: Sharing uses a multi-step wizard (variant 2): Step 1 confirm lock → Step 2 choose sharing method → Step 3 success. Final step includes clear text: "Od tohoto momentu můžete seznam pouze prohlížet, přidávat nová přání, přidat moderátora nebo seznam sdílet."
Why: The sharing-locks-editing consequence is important enough to warrant explicit confirmation and clear post-share guidance.
Reference: `designs/sharing-flow/variant-2.html`.
Rejected: Single modal (variant 1), side sheet (variant 3), tabbed card (variant 4), bottom sheet (variant 5).

### Wishlist Page: E-commerce grid (variant 2) as base

Decided: 2026-05-30
What: Wishlist page uses the E-commerce grid layout (variant 2) as the starting point. Uniform card grid, 3-way view toggle (Card/List/Compact), sort/filter button in toolbar. Variant 3's priority-based featured layout (top gift large, then tier 2, then rest) is a candidate 4th view mode for the future.
Why: Simpler to implement, familiar e-commerce pattern, covers the core use cases. Priority layout from variant 3 adds visual interest but can be added later.
Reference: `designs/wishlist-page/variant-2.html` (primary), `variant-3.html` (future 4th view ref).

### Wishlist Page: Owner reorders gifts via drag-and-drop

Decided: 2026-05-30
What: The owner can set the display order of gifts by dragging them. This order is the default "Pořadí vlastníka" sort for visitors. Different from priority — this is manual visual ordering.
Why: Owner knows which gifts matter most to them. Manual ordering gives full control over presentation.

### Wishlist Page: Visitor view is the primary design target

Decided: 2026-05-30
What: The visitor view (seeing gifts, reserving, liking) is the primary design focus. Owner view (editing, reordering) and moderator view (full state) are secondary refinement targets.
Why: Most users of any given wishlist are visitors, not the owner. The visitor experience drives adoption.

### Dark mode toggle: Single cycling button

Decided: 2026-05-30
What: Dark mode toggle is a single ghost-style button that cycles through three states (light → dark → system). Uses a tooltip to show the current mode. NOT three separate icons displayed simultaneously.
Why: Saves horizontal space. Three separate icons are visually noisy for a simple preference toggle.

### General: Light mode is source of truth

Decided: 2026-05-30
What: All design mockups use light mode as the source of truth. Dark mode is auto-generated from design tokens — no need for manual dark variant designs.
Why: Reduces design work by 50%. OKLCH token system produces good dark mode automatically.

## V1 Scope & Routing

### V1: Single release, all features

Decided: 2026-05-30
What: All 16 core features ship in a single V1 release. No MVP/phased rollout within V1.
Why: Features are interconnected (sharing depends on gifts, notifications depend on reservations). Phasing would ship an incomplete product.
Rejected: MVP subset first (would leave holes in the core loop).

### English URL slugs

Decided: 2026-05-30
What: Routes use English slugs: `/login`, `/register`, `/magic-link`, `/reset-password`, `/my-lists`, `/moderated`, `/followed`, `/w/<short-id>`, `/settings`. Logged-in users visiting `/` redirect to `/my-lists`.
Why: Cleaner URLs, no encoding issues with Czech diacritics, consistent with tech conventions.
Rejected: Czech slugs (`/prihlaseni`, `/moje-seznamy`).

### Wishlist creation as modal

Decided: 2026-05-30
What: Creating a wishlist opens a modal with minimal fields: title (required), event date (optional), theme (optional, default preset). After creation, redirects to the wishlist page. Description, images, and custom theme are edited on the wishlist page itself.
Why: Fast creation flow — the modal keeps context, and most fields are optional at creation time.
Rejected: Separate page (`/new-list`), multi-step wizard (over-engineered for 1-3 fields).

## Authentication Flow

### Anonymous reservation: inline form in modal

Decided: 2026-05-30
What: When an anonymous visitor tries to reserve a gift, they see an inline form (display name required + email optional) within the reservation modal. Login/register options are also available in the same modal.
Why: Minimizes friction — the visitor is already in the reservation context. Separate auth page breaks flow.
Rejected: Auth page redirect (friction), prompt before viewing (blocks browsing).

### Anonymous → registered: auto-link by email

Decided: 2026-05-30
What: When a user registers with an email that matches anonymous reservations, those reservations are automatically linked to the new account.
Why: Preserves the anonymous user's actions without manual claim flow. Email is the natural linking key.
Rejected: Manual claim flow (too complex for V1), no linking (reservations orphaned).

### Magic link redirect to previous page

Decided: 2026-05-30
What: Magic link encodes a `redirect` param with the full URL the user was on. After clicking the magic link, they return to that page.
Why: Users typically arrive via a shared wishlist link — they should land back on that wishlist, not a dashboard.
Rejected: Always redirect to dashboard (breaks the context the user was in).

### Password reset in V1

Decided: 2026-05-30
What: Password reset via email is a V1 feature. BetterAuth handles the flow natively.
Why: Essential if offering email/password auth. Users forget passwords.

## Data & Technical

### Owner-never-sees-reservations enforcement: API + UI

Decided: 2026-05-30
What: Remote functions strip reservation data before returning to the owner (API-level). UI components also conditionally hide reservation elements for the owner role (defense-in-depth). Role is derived from the server session, not from the client.
Why: API is the security boundary. UI is defense-in-depth to prevent accidental leaks via component bugs.
Rejected: DB-level views (unnecessary complexity), UI-only (insecure).

### Client-side theme palette derivation

Decided: 2026-05-30
What: Server returns theme name + custom color. Presets are predefined CSS variable sets. Custom themes use a JS utility to derive an OKLCH palette from a single input color and set CSS variables on the page wrapper. Live preview during editing.
Why: Simpler than server-side computation, works reactively, enables live preview without round-trips.
Rejected: Server-side pre-computation (adds latency, no live preview), build-time generation (can't handle dynamic custom colors).

### Presigned R2 URLs for image uploads

Decided: 2026-05-30
What: Client requests a presigned upload URL via a command, uploads directly to R2, then sends the R2 key back to save on the gift/wishlist record.
Why: Avoids Workers body size limits on free tier, reduces server load, standard pattern for edge deployments.
Rejected: Server proxy (hits Workers body size limits on free tier).

### Currencies: CZK, EUR, USD

Decided: 2026-05-30
What: Three supported currencies: CZK (default), EUR, USD. UI is a select dropdown next to the price field.
Why: CZK for Czech audience, EUR/USD for international family. Minimal effort (just a dropdown + stored string).
Rejected: CZK-only (limits international use), more currencies like GBP (unnecessary scope).

### Priority levels: predefined defaults

Decided: 2026-05-30
What: Each wishlist gets predefined priority levels (Vysoká / Střední / Nízká) auto-created on wishlist creation. Owner can rename or add custom levels.
Why: Sensible defaults reduce setup friction. Custom labels allow personalization for power users.
Rejected: No defaults (owner must create from scratch), fixed labels (too rigid).

## UX Patterns

### V1 email set

Decided: 2026-05-30
What: V1 sends these emails via Resend: magic link, password reset, liked gift reserved by someone else, reserved gift edited by moderator, wishlist archived, owner self-promoted to moderator, moderator invite.
Why: Covers auth flows + critical notifications + moderator onboarding. No welcome email (low value).
Rejected: Welcome email (unnecessary), email verification (deferred — too much friction for a family app).

### Loading: skeleton + toast + inline errors

Decided: 2026-05-30
What: Content loading uses skeleton components. Action errors (reserve failed, etc.) use toasts. Form validation uses inline field errors.
Why: Skeleton loading provides perceived performance. Toasts are non-blocking for action feedback. Inline errors are the standard form pattern.
Rejected: Spinners (less polished), full-page error states (too disruptive).

### Mobile: responsive adaptations, no dedicated mobile design

Decided: 2026-05-30
What: V1 uses responsive CSS: hamburger menu with slide-out nav on mobile, stacked card grids, gift detail modal becomes full-screen sheet on small screens. No dedicated mobile sidebar redesign.
Why: Family app — links shared via WhatsApp must work on phones. Responsive adaptations are sufficient; dedicated mobile design is V2 scope.
Rejected: Desktop-only (unacceptable for target audience), dedicated mobile layout (too much scope for V1).

### Auto-follow on first visit

Decided: 2026-05-30
What: Logged-in users automatically become followers of a wishlist on their first visit to `/w/<short-id>`. "Přestat sledovat" option available. The Sledované page shows all followed lists.
Why: Ensures the user can find lists they've interacted with. Explicit follow button adds friction.
Rejected: Explicit follow button (friction), auto-follow on reservation only (misses visitors who only browse).

### Gift creation/editing as modal

Decided: 2026-05-30
What: Adding/editing a gift uses a modal — the same GiftDetailModal component in "edit mode." 2-column layout: image upload left, fields right. Stacks on mobile.
Why: Reuses the detail modal component, consistent pattern, keeps single-page feel.
Rejected: Inline form (noisy), separate page (breaks flow), drawer (less space for image).

### Moderator management via wishlist settings

Decided: 2026-05-30
What: A gear/settings icon on the wishlist page header opens a panel/modal for moderator management: list moderators, generate invite link, revoke access.
Why: Contextual — moderators belong to a specific wishlist. No need for a global moderator page.
Rejected: Global settings page (wrong level), inside sharing flow (conflates two concerns).

### OG meta tags for wishlist pages

Decided: 2026-05-30
What: Public wishlist pages (`/w/<short-id>`) include OpenGraph meta tags (title, owner name, thumbnail). Landing page gets standard meta. Auth/dashboard pages get `noindex`.
Why: Shared links in WhatsApp/Messenger show rich preview cards — critical for a sharing-driven app.
Rejected: No OG tags (missed opportunity for viral sharing).

### Storybook: Grovekeeper pattern with play functions

Decided: 2026-05-30
What: Components use `addon-svelte-csf` with `defineMeta`, play functions for interaction tests, autodocs, and "All Variants" grid stories. `tailwind-variants` (`tv()`) for all new derived and block components. Stories for every component with significant complexity.
Why: Proven pattern from Grovekeeper. Play functions provide interaction testing without separate test files.
Rejected: CSF3 JS format (less ergonomic for Svelte), no play functions (misses testing opportunity).

### app.css as canonical design token source

Decided: 2026-05-30
What: `src/app.css` is the single source of truth for design tokens. Missing tokens from `designs/tokens.css` (typography scale, motion, z-index, shadows) must be migrated in. `designs/tokens.css` remains as design reference only.
Why: Tokens must be in the Tailwind pipeline to be usable. Two sources of truth causes drift.
Rejected: Importing designs/tokens.css directly (not wired to Tailwind @theme), keeping both in sync manually (drift risk).

### createContext API for all new code

Decided: 2026-05-30
What: All new module contexts use the `createContext` API (Svelte 5.40+). The old `getContext`/`setContext` pattern in the showcase is legacy and will not be replicated.
Why: `createContext` provides type-safe, key-free context with better DX. Consistent with project rules.
Rejected: Old getContext/setContext (manual key management, type-unsafe).
