# Decisions

Settled architectural and design decisions for Darecky.

## Product & Domain

### Owner never sees reservation state

Decided: 2026-05-29
What: The wishlist owner cannot see which gifts are reserved, who reserved them, or any reservation counts.
Why: The surprise element is the core product differentiator — the owner should be genuinely surprised by their gifts.
Rejected: Partial visibility (e.g., showing counts but not names) — still leaks info and weakens the surprise.

### Sharing locks owner editing

Decided: 2026-05-29 — **Revised 2026-06-07** by "Post-share editing: per-field" below (blanket lock → per-field).
What: Once a wishlist is shared, the owner can only add new gifts. Edit and remove are locked for existing gifts.
Why: Prevents the owner from accidentally removing a reserved gift or inferring reservation state from blocked actions.
Rejected: Soft-delete approach (owner thinks they removed it but it persists) — too deceptive, confusing edge cases.

### Post-share editing: per-field, name is the identity anchor

Decided: 2026-06-07 (revises "Sharing locks owner editing")
What: After sharing, the owner can still edit existing gifts' presentation/info fields — image (add/replace/remove/recrop), links (add/edit/remove), price/currency, priority, and description (append-only, see below). `name` is frozen — it is the gift's identity, what the gifter reserved against. Delete stays blocked. `quantity` is raise-only relative to its current value (never lowered). Unlocked fields are editable for ALL pre-share gifts uniformly — never conditional on reservation state.
Why: Owners legitimately need to add/fix an image, add alternative links, correct a price, or clarify details after sharing — none of these change what was reserved (the name). Uniform per-field unlock keeps the no-inference invariant intact. Lowering quantity is forbidden because clamping it to the reserved count would itself leak that count.
Rejected: Blanket lock (too rigid); reservation-conditional editing (leaks reservation state); editable name (gifter mismatch); quantity lowered with silent server clamp (the clamp leaks the reserved count); raise-only relative to reserved count rather than current value (same leak).

### Append-only description after sharing

Decided: 2026-06-07
What: At share time the existing `description` freezes (read-only). Post-share clarifications are added as immutable appended segments (`{ text, addedAt }`), rendered in an accent color with their date. The gifter always sees the original text they reserved against plus what changed since. If `description` was empty at share time, the first post-share text goes into the main field instead (nothing to preserve). Segments cannot be edited/deleted afterward — except within the grace window below.
Why: Description is the field a gifter actually relies on; preserving the original + showing additions transparently protects them without forbidding clarification.
Rejected: Free editing with just an "edited" badge (loses the original the gifter relied on); structured revision history (over-engineered).

### Post-share grace window: 2-min debounced reversibility

Decided: 2026-06-07
What: Every transition to read-only is fully reversible for 2 minutes after the LAST edit to that thing (debounced — the timer resets on each edit; continued editing keeps it open, then it freezes 2 min after the last change). Applies to (a) sharing itself — during the window the owner has full edit incl. `name` + delete, as if unshared — (b) each appended description segment, and (c) the wishlist event date. A countdown communicates the remaining time.
Why: Owners share, then immediately spot a typo or the wrong item. A short debounced window allows last-minute corrections / undoing a premature lock without a separate undo flow.
Rejected: Hard lock at the instant of sharing (no recovery from a premature share); fixed non-debounced window (cuts an owner off mid-correction).

### Post-share edit transparency: uniform indicators, no notification

Decided: 2026-06-07
What: Edits made after sharing are surfaced to ALL visitors uniformly (never reservation-conditional): a per-gift "Upraveno po sdílení" badge driven by a dedicated `editedAfterShareAt` timestamp (not `updatedAt`, which reorder/mark-received also bump), plus the accent-colored description appends. No push/email notification fires — the scaffolded `RESERVED_GIFT_EDITED` type stays unused for owner edits. Per-field markers (e.g. price old→new) deferred.
Why: Gifters should notice a gift changed, but a notification per edit is noise; uniform visual indicators leak nothing and the owner sees identical UI whether or not the gift is reserved.
Rejected: Reservation-conditional indicators (inference leak); notifying gifters on every owner edit (noise); per-field diffs now (deferred).

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

### ~~Separate banner and thumbnail uploads per wishlist~~ (superseded)

Decided: 2026-05-29 — **Superseded 2026-06-02** by "Single image_key + image_slots per wishlist" below.
~~What: Owner uploads a hero banner (wishlist page) and a thumbnail (dashboard cards) separately.~~
Replaced because: separate `banner_image_key` / `thumbnail_image_key` columns were removed; wishlists now use a single `image_key` with per-slot crop metadata in `image_slots` JSON.

### Single image_key + image_slots per wishlist (replaces separate banner/thumbnail)

Decided: 2026-06-02
What: Wishlists store one uploaded image (`image_key`) plus a JSON `image_slots` column that holds independent crop metadata for each named slot (`card`, `thumbnail`, `banner`, `social`). `banner_image_key` and `thumbnail_image_key` columns are removed.
Why: A single upload with per-slot cropping covers all display contexts without requiring the owner to manage multiple files. Each slot's crop is fully independent, so banner and card framings can differ.
Rejected: Keeping separate upload columns (upload friction, storage duplication).

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

### Server proxy for image uploads (revised from presigned R2 URLs)

Decided: 2026-06-01 (revised from 2026-05-30)
What: Client uploads via a same-origin PUT to `/api/upload/[objectKey]`, which proxies to R2. HMAC token (signed `{objectKey, userId, expiresAt}`, derived from AUTH_SECRET) authorizes each upload/delete. Token passed as `X-Upload-Token` header, verified server-side before storage.
Why: Presigned R2 URLs require `aws4fetch` signing, R2 CORS config, and free-tier support verification. The proxy is simpler: session cookie auth works natively, content-type/size validation happens server-side, and HMAC binding prevents unauthorized overwrites. Acceptable for images (max 10 MB). The PRD's Known Risks section anticipated this: "R2 presigned URL support on free tier needs verification during implementation."
Rejected: Presigned R2 URLs (CORS complexity, unverified free-tier support, requires separate signing library). Reconsider if video/large-file uploads are added.

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

## Component Library

### Base components carried over from Grovekeeper

Decided: 2026-05-31
What: Upgrade base component library using Grovekeeper's mature implementations. Carry over GK versions for Button, Badge, Card, Input, Textarea, Alert, Tooltip. Keep Darecky versions for Dialog, Select, DropdownMenu, Sheet, Switch, Checkbox, Separator, Skeleton. Merge Label (GK typography + Darecky flex layout). Add 14 new components from GK: HelpText, SearchField, Toggle, ToggleGroup, Tabs, Accordion, Collapsible, Popover, Kbd, InputGroup, Progress, RadioGroup, Toast, Calendar/RangeCalendar.
Why: Grovekeeper has production-tested components with better variant systems, testing, and stories. Standardizing across projects reduces maintenance.
Rejected: Keeping Darecky's simpler components (missing error states, no variant files, fewer stories).

### Component naming: intent/tone instead of variant

Decided: 2026-05-31
What: Button uses `intent` prop (primary, secondary, ghost, ghost-overlay, danger, primary-destructive, outline, link). Badge and Alert use `tone` prop. Input/Textarea/Card use `state` prop.
Why: Semantic naming — `intent` describes what the button means to do, `tone` describes informational quality, `state` describes component condition. Avoids "everything is variant" ambiguity.
Rejected: Universal `variant` prop (ambiguous, conflicts between components).

### Separate \*-variants.ts files for tv() definitions

Decided: 2026-05-31
What: Components with `tv()` definitions extract them into a `*-variants.ts` file. Types and constants derived from the tv() config. Components without tv() variants (Dialog, Sheet, Select) don't need a variants file.
Why: Single source of truth for styling. Types stay in sync with variants. Index.ts re-exports from variants file, not from `<script module>`.
Rejected: Inline `<script module>` exports (couples types to component, harder to reuse).

### Design tokens: merge GK tokens into Darecky

Decided: 2026-05-31
What: Add GK surface/text/border tokens as aliases or new values: `--surface` (→ background), `--surface-2` (→ secondary), `--surface-3` (→ muted), `--surface-hover`, `--foreground-subtle`, `--border-strong`, `--primary-soft`. Keep all existing Darecky tokens. Keep `.light`/`.dark` class selector (not GK's `[data-theme]`). Keep Darecky fonts and spacing base.
Why: GK components reference these tokens. Aliases avoid duplicating values while maintaining compatibility with both naming conventions.
Rejected: Full GK token system replacement (would break existing Darecky code), translating every GK class to Darecky tokens (too much manual work, loses GK consistency).

### PascalCase component file naming

Decided: 2026-05-31
What: Folders lowercase (`button/`). Main component PascalCase (`Button.svelte`). Sub-components lowercase-prefixed (`dialog-content.svelte`). Variants lowercase (`button-variants.ts`). Stories PascalCase (`Button.stories.svelte`).
Why: Matches Grovekeeper convention. PascalCase for components is the Svelte community standard.
Rejected: All lowercase (harder to distinguish component files from sub-components).

### No native select — custom-only

Decided: 2026-05-31
What: The Select component uses only the custom bits-ui implementation. No native `<select>` fallback.
Why: Consistent styling and behavior. Native select cannot be styled to match the design system.
Rejected: GK's dual native + custom approach (unnecessary complexity, native select looks out of place).

### Select and DropdownMenu: merge best of both projects

Decided: 2026-05-31
What: Keep Darecky's styling and UX features (scroll buttons, size prop, bold focus, cursor-default, dark mode destructive). Add GK's structural improvements (state prop on Select trigger, SubContent defaults on DropdownMenu, destructive shortcut coloring). Create comprehensive stories with play tests from GK.
Why: Darecky's UX decisions (bold focus, OS-convention cursor) are better. GK's structural completeness (error states, proper defaults, testing) fills gaps.
Rejected: Taking either project's version wholesale (both have genuine strengths the other lacks).

## Import, Bulk Entry & Enrichment

### CSV / Google Sheets import via 3-step wizard

Decided: 2026-06-03
What: Import builds gifts through a shared wizard — Source (upload .csv/.tsv · paste cells · paste Google Sheets link) → Review (editable draft grid with smart column detection + manual role override, auto-skipped preamble/footer rows, per-row select/deselect, "možný duplikát" badges matched by normalized name OR link host+path) → Confirm. Two entry points reuse it: create-new-wishlist (title pre-filled from filename, editable) and append-to-existing. Parsing via PapaParse.
Why: One robust core covers clean exports (near-zero effort) and messy sheets (manual grid fixes). Family lists are small; a wizard makes the suggested gifts reviewable and dedupable before commit.
Rejected: Manual-only column mapping (tedious for clean files); a single cramped modal; a bespoke parser for one messy sheet's section-headers / alternate-link rows (the editable grid covers it).

### Import input methods; no Google OAuth

Decided: 2026-06-03
What: File upload (.csv/.tsv), paste-cells (textarea with HTML-table-aware paste + TSV/CSV fallback — copying a range from Excel/Sheets pastes as parseable TSV), and paste a Google Sheets share/published link (server converts to `export?format=csv` and fetches server-side; a private sheet or a Google Docs link yields a friendly error). Limits: 200 rows, 1 MB.
Why: Covers already-exported files + the lowest-friction "direct from Sheets". Server-side fetch avoids CORS; OAuth + Drive Picker is disproportionate for a family app and paste-cells already handles private sheets with zero auth.
Rejected: OAuth + Drive Picker (heavy: GCP app, consent-screen verification, API keys); Google Docs (non-tabular).

### Taken/"Vybráno" column and cell color ignored on import

Decided: 2026-06-03
What: Import creates gifts only. Any reservation/"taken" column is ignored; the owner instead deselects unwanted rows in the wizard. Cell background color (file #3's "taken" signal) is dropped by CSV export and is not supported.
Why: Preserves owner-never-sees-reservations and yields a clean list for re-claiming in-app. CSV cannot carry color.
Rejected: Importing taken rows as anonymous reservations (revisit only if mid-gifting migration is requested); mark-received (wrong semantics — "taken by a gifter" ≠ "owner received it").

### Multiple links per gift

Decided: 2026-06-03
What: Replace `gift.url` with `gift.links: { url, label? }[]` (jsonb), max 10 per gift. `links[0]` is primary (drives the domain chip, OG tags, "Bez odkazu"). Label optional, defaults to the domain. Reservations and likes remain per-gift.
Why: Real wishlists offer alternatives ("nebo tohle"). jsonb matches the existing imageMeta/imageSlots pattern and avoids a join on every gift fetch. App is in development → no back-compat shim.
Rejected: Separate `giftLink` table (join per fetch, heavier); keeping a single `url` (too limiting).

### Gift card: piece count beside title (role-conditional), links stacked at bottom

Decided: 2026-06-03
What: Piece count moves next to the title in a larger, muted style ("3 kusy"). The reserved portion is appended only for visitor/moderator ("3 kusy · 1 rezervováno"); the owner sees the piece count alone. Multiple links render stacked at the card bottom. Replaces the corner "x3" badge. Czech pluralization (kus/kusy/kusů) via Paraglide.
Why: Clearer than a badge, scales to multi-link, and keeps the owner-surprise invariant intact.
Rejected: The "x3" corner badge (cramped, doesn't scale to multi-link); showing the reserved count to the owner (breaks the core invariant).

### Metadata enrichment: per-item, progressive, offloaded

Decided: 2026-06-03
What: Gift drafts (and the single-gift modal) get a ✨ enrich action that fills image/price/title from a link. Each enrich is its OWN remote request, fired throttled from the browser, so each gets a fresh Cloudflare budget (free tier: 50 subrequests + 10 ms CPU per request — HTML parsing must NOT run in-Worker). Provider: a metadata API (Microlink free 50/day, callable client-side) behind an `enrichLink()` abstraction, with a DIY OG/JSON-LD fallback for plain sites. Available in the import grid, batch-add dialog, and single-gift modal.
Why: Progressive "cards fill in one by one" UX; stays in the free tier; offloads JS-rendering, bot-bypass, and parsing. (Reliability caveat: Alza actively blocks bots and Heureka links are aggregator pages, so quality varies; the provider's free daily quota — not Cloudflare — is the real ceiling.)
Rejected: Batch-scraping N pages in one Worker request (blows the 10 ms CPU limit); parsing HTML in-Worker; MCP servers (they run in the dev/agent environment, never in the production Worker serving end-users).

### Name-based enrichment deferred; blank names stay blank

Decided: 2026-06-03
What: Enriching link-less items by searching Alza/Heureka by name is a later, best-effort phase that presents candidate matches for the user to confirm — never silent auto-fill. Import rows with no name stay blank; their links are rendered clickable in the grid so the user opens them and types the name manually.
Why: No official product API + active bot protection make name→product matching unreliable and ambiguous.
Rejected: Silent name→product auto-fill; auto-filling the name from the URL domain (user rejected — prefers blank + clickable link).

### Bulk gift entry via large dialog

Decided: 2026-06-03
What: A standalone "batch add gifts" action opens a large dialog hosting the same editable draft grid as the import Review step (starting empty, manual rows) plus enrichment.
Why: The single-gift modal is too cramped for an N-row grid; reuse the import grid primitive.
Rejected: A dedicated full-width route (user prefers a dialog); extending the single-gift modal.

### Delivery phasing

Decided: 2026-06-03
What: Phase 1 — import core (parse → editable draft grid → dedup → commit; no enrichment). Phase 1b — multiple-links data model + card/modal display, plus the **manual-only batch-add dialog shell** (empty grid → `importGifts`; the draft-grid primitive already exists, so manual batch entry ships now). Phase 2 — enrichment (import grid, the batch-add dialog's ✨ action, single-gift modal). Phase 3 — name-based search (optional).
Why: Ship the robust headline import first; keep enrichment's external-quota and scraping-reliability risk off the critical path.
Rejected: Enrichment inside V1 proper (couples a robust import to fragile scraping).

## Image Fitting & Cropping

### Single shared ImageFrame renderer for all image presentation

Decided: 2026-06-02
What: One `ImageFrame` component handles all fixed-size image boxes across gifts, wishlist cards, and avatars. It accepts a fit mode and focal-point crop and applies them consistently.
Why: Avoids divergent crop/fit behavior across surfaces; one place to update rendering logic.
Rejected: Parallel per-surface image components (drift risk, duplicated crop logic).

### Focal point + zoom as canonical crop representation; cropRect persisted for editor restore only

Decided: 2026-06-02
What: The persisted crop value for any image slot is `{ x, y, zoom }` (focal point in percent + zoom ≥ 1). A normalized `cropRect` (0–1) is also persisted alongside it, but solely so the crop editor can restore the exact region the user drew. Only focal point + zoom is used for rendering.
Why: Focal point + zoom is resolution- and aspect-ratio-independent — it produces correct framing regardless of which slot ratio is being rendered. A raw cropRect breaks when rendered at a different aspect ratio.
Rejected: Persisting cropRect only (breaks rendering at different slot aspect ratios).

### One-crop-all-slots for gifts; independent per-slot crops for wishlists

Decided: 2026-06-02
What: A gift's `image_meta` stores a single crop (focal point + zoom) applied to all display surfaces. Wishlists use `image_slots` with independent crop metadata per named slot (`card`, `thumbnail`, `banner`, `social`).
Why: Gift surfaces (card thumbnail, detail modal) share the same framing — one crop is sufficient. Wishlist slots have very different aspect ratios and need distinct framings.
Rejected: Per-slot crops for gifts (unnecessary complexity), single crop for wishlist slots (poor results across divergent aspect ratios).

### Separated token responsibilities: bg-theme / wishlist tokens / frame-fill

Decided: 2026-06-02
What: Three distinct token layers — `data-bg-theme` attribute controls app-shell background tint; `--wishlist-*` tokens express wishlist color identity on the wishlist page; `--frame-fill` controls the background behind letterboxed images. Each is set and scoped independently.
Why: Each concern is independently themeable and must not leak into the others (e.g., wishlist accent color must not affect the app shell).
Rejected: Shared token namespace (cross-contamination between app shell and wishlist themes).

### App background theme applied server-side via data-bg-theme on <html>

Decided: 2026-06-02
What: The user's `app_background_theme` preference (`default` / `golden-hour` / `twilight`) is read in `hooks.server.ts` and written as a `data-bg-theme` attribute on `<html>` before the first byte is sent.
Why: Setting it server-side eliminates flash-of-wrong-theme on first paint — the correct theme is present in the initial HTML.
Rejected: Client-only `onMount` application (causes visible flash of the default theme on load).

### Native <input type=range> instead of bits-ui Slider for crop zoom control

Decided: 2026-06-02
What: The zoom slider in the crop editor uses a plain `<input type="range">` styled with Tailwind, not the bits-ui `Slider` component.
Why: bits-ui Slider threw a runtime error on single-value usage — its internal `ticksPropsArr` reads `value` as an array, which crashes when a scalar is passed. Native range input has no such issue and is sufficient for a single continuous value.
Rejected: bits-ui Slider (runtime crash on scalar value), patching bits-ui (not worth the maintenance overhead for this use case).

### Accepted a11y exception: gift crop canvas is pointer-only (WCAG 2.1.1)

Decided: 2026-06-03
What: `GiftImageCropCanvas` exposes a focusable `role="button"` crop region driven only by pointer events, with resize handles nested inside it. Keyboard move/resize and resolving the nested-interactive structure are deliberately NOT implemented. Issue #50, which scoped this work, was closed NOT_PLANNED.
Why: Keyboard crop operation was deprioritized for v1; the gap was reviewed and consciously accepted rather than silently shipped. Documented here and inline in the component so it is not mistaken for an oversight.
Rejected: Implementing keyboard nudge/resize now (deferred); silently leaving it undocumented (would read as a bug).
Revisit: If the crop editor becomes a primary owner workflow or an accessibility audit requires AA, reopen #50 and implement keyboard operation + fix the nested-interactive handles.
