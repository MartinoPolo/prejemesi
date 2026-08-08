# Home Overview (Přehled) — Design Brief

> **Status**: Refined (Variant A)
> **Refined mockup**: `designs/home-overview/refined.html`
> **Summary**: `designs/home-overview/SUMMARY.md`
> **Refinements**: 3.5-card peek layout (320px cards), counts in „Zobrazit vše (N)" links, lucide chevrons, horizontal-only wheel scroll

The logged-in home page at `/home` (cs „Přehled", en "Overview"). Horizontal carousel rows
surface every wishlist the user can reach — recently visited first, then followed, managed, and
own lists — so the dominant real-world flow ("open the one followed list I care about and
reserve a gift") takes one glance and one click instead of a nav hunt. Becomes the target of
`/`, the post-login default, and the logo.

**Source**: issue #225; `.mpx/DECISIONS.md` → "Logged-in home: Přehled overview at /home" +
"Nedávné row: visit-recency tracking" (2026-08-07, grill session)

---

## 1. Purpose

Field observation showed most logged-in users are gifters: they arrive to open a specific
wishlist someone shared with them, not to manage their own. Yet every entry point landed on
Moje seznamy. Přehled answers **"which wishlist do I want to open right now?"** with all
categories visible at once and vertically compact — each category is one horizontal row, so
even four populated categories fit a laptop viewport. The page has no management ambition: no
sort controls, no view toggles, no archive toggle. It is a launchpad; the three existing pages
keep all management affordances.

**Key value**: every wishlist you can reach, one glance, one click — with the one you were
just looking at first.

---

## 2. Surrounding Context

The mockup **must** show the full viewport with all chrome at correct proportions.

### Full viewport structure

Top to bottom (desktop ~1440×900):

1. **Topbar — FINAL, reproduce faithfully.** Sticky, `height: 56px` (`--nav-height`), solid
   `--card` background, `2.5px` solid `--ink` bottom border (`.topbar` in `Navbar.svelte`).
   Left → right: logo (custom icon + „prejemesi" + dimmed „.cz", links to home), nav pills
   „Moje seznamy | Spravované | Sledované" (background-pill hover/active, **no** „Přehled"
   item — none of the three is active on this page), then right group: „Vytvořit" primary
   sticker button, notification bell, palette switcher, „CZ" language trigger, dark-mode
   toggle, avatar. All ghost buttons except the primary „Vytvořit".
2. **Content area** — the rest of the viewport, vertically scrollable. Inner container
   `max-width: 1200px` (`--content-max-width`), centered, `24px` (`--space-6`) inline and
   block padding.

**What the parent provides**: topbar, scroll container, 1200px centered content column.
**What this component fills**: the entire content column — stacked carousel rows.
**Excluded — belongs to the parent**: topbar and everything in it; the mobile drawer (its new
„Přehled" entry is an implementation detail, not part of this mockup).

**Mockup rendering instructions**:

- Full viewport at ~1440×900; topbar at full fidelity, content column dominant (~85% height).
- Populate all four rows with realistic Czech data so proportions are honest: e.g. Nedávné
  (4 cards), Sledované (6+ cards, overflow visible), Spravované (2 cards), Moje seznamy
  (3 cards). Cards carry believable titles (Vánoce 2026, Narozeniny — Rosie, Svatba Petra a
  Jany…), event dates, and role-correct meta.
- The right edge of each row MUST show a partially cut-off card — the peek is the scroll
  affordance and is load-bearing.
- A second artboard (or media query) at ~390px width showing the mobile treatment: same rows,
  card ≈75vw with next-card peek, topbar collapsed to logo + hamburger + bell + avatar.

---

## 3. Requirements

### 3.1 Row structure (fixed order, empty rows collapse)

| # | Row | Cap | Content | Sort |
| - | --- | --- | ------- | ---- |
| 1 | „Nedávné" | 6 | wishlists across ALL roles (followed + managed + own) | last visit desc; follow date fallback |
| 2 | „Sledované" | 10 + trailing „Zobrazit vše" card | followed lists | upcoming event date asc → undated by recently opened (created fallback) → past-dated last |
| 3 | „Spravované" | 10 + trailing card | managed (správce) lists | same as Sledované |
| 4 | „Moje seznamy" | 10 + trailing card | own (recipient) lists | same as Sledované |

- A row with zero wishlists is **not rendered** — no empty-row placeholder.
- No dedup: a list may legitimately appear in Nedávné AND its category row.
- Archived wishlists never appear anywhere on this page.
- Each category row has a heading and a „Zobrazit vše" affordance linking to its full page
  (`/followed`, `/moderated`, `/my-lists`); shown both as a text link near the heading AND as
  the trailing card when the cap is hit (designer may propose one or both — see §9).
- „Nedávné" has a heading but NO „Zobrazit vše" (there is no full recents page).

### 3.2 Cards

- Reuse `WishlistCard` **unchanged in structure**, rendered at a narrower fixed width
  (320px desktop; existing grid renders it at ~360px). Role-conditional meta exactly as
  today:
    - Sledované/Nedávné-followed: `recipientDisplayName` chip + available-gifts count +
      my-reservations chip; managed cards also show the reservation progress bar.
    - Moje seznamy: gift count + event date chips, created/updated meta text. **Never any
      reservation data — hard product invariant.**
- Click target: whole card → wishlist page (existing behavior, hover lift + sticker shadow).

### 3.3 Carousel interaction

- Horizontal scroll per row; desktop: drag + prev/next arrow buttons + horizontal wheel;
  mobile: native touch swipe (arrows hidden or de-emphasized).
- Next card always peeks at the container's right edge at every width (partial card visible,
  never a clean edge when overflow exists).
- Arrows disabled (not hidden) at the respective end on desktop.
- Keyboard: cards are links (natural tab order); arrows focusable.

### 3.4 Empty states

- **Category row empty** → row collapses (not rendered).
- **Brand-new user, zero lists in every category** → single onboarding hero instead of rows:
  emoji/illustration, heading „Vytvořte první seznam", one sentence explaining that followed
  lists appear here automatically after opening a shared link, primary CTA opening the
  create-list modal + secondary outline CTA for import (mirrors the `EmptyState` on
  `/my-lists`).
- **Some rows exist, others not** → only existing rows, no hero.

### 3.5 Loading

- Rows are SSR-awaited; the default state arrives populated. A skeleton variant (per-row
  heading + 3–4 card-shaped `Skeleton` blocks) exists for client-side navigation fallback.

### 3.6 Copy (Czech primary, vykání)

- Row headings: „Nedávné", „Sledované", „Spravované", „Moje seznamy". Link/card: „Zobrazit vše".
- Optional page heading „Přehled" (designer's call — rows are self-labelling; see §9).

---

## 4. States

| State | Visual Treatment | Trigger |
| ----- | ---------------- | ------- |
| Default | 1–4 rows, cards at rest with sticker shadow | page load, data present |
| Row overflow | partial card cut at right edge; desktop arrows active | more cards than fit viewport |
| Row start/end | left/right arrow disabled | scroll position at edge |
| Card hover/focus | existing lift: `-translate-y-1`, `shadow-sticker-lift` (motion-safe) | pointer/keyboard |
| Row empty | row not rendered | category has no lists |
| All empty | onboarding hero (§3.4) | user has zero lists anywhere |
| Loading | skeleton rows (§3.5) | client-side nav before data |
| Cap hit | trailing „Zobrazit vše" card as last slide | >10 category items (>6 Nedávné: simply truncated) |

---

## 5. Component Reuse Map

### Existing components (use these)

| Component | Variant/Props | Usage in this design |
| --------- | ------------- | -------------------- |
| `WishlistCard` (`blocks/dashboard/`) | role props: `giftCount` / `reservationProgress` / `availableGifts` + `myReservations` / `recipientDisplayName` | every slide; structure untouched, width constrained by the slide |
| `WishlistSlotImage` | rendered inside `WishlistCard` | card banner (photo or theme-tint + dot pattern fallback) |
| `EmptyState` (`blocks/dashboard/`) | `emoji`, `title`, `description`, `actions` snippet | base for the onboarding hero |
| `Button` (`base/button/`) | primary sticker + `intent="outline"`; icon sizes per four-step scale | hero CTAs, carousel arrows |
| `Skeleton` (`base/`) | card-sized blocks | loading state |
| `Navbar` / `LogoMark` / `MobileNav` | as implemented | surrounding chrome only |

### Components to adopt

| Component | Source | Rationale |
| --------- | ------ | --------- |
| `Carousel` (embla-based) | shadcn-svelte CLI: `pnpm dlx shadcn-svelte@latest add carousel` | no horizontal-scroll/carousel primitive exists in the repo. Parts: `Carousel.Root` (`opts={{ align: 'start' }}`, `setApi` for edge-state), `Carousel.Content`, `Carousel.Item` (slide width via `basis-*`/fixed width + `ps-*` spacing, peek falls out of `align: 'start'` + item width), `Carousel.Previous`/`Carousel.Next`. Install deferred to refine/implementation. |

### Components to design

| Component | Description | Why new |
| --------- | ----------- | ------- |
| `WishlistCarouselRow` (`blocks/home/`) | section heading + „Zobrazit vše" affordance + Carousel of `WishlistCard` slides + trailing view-all card | new composition; nothing similar exists |
| `ViewAllCard` | trailing slide linking to the category page | new pattern (card-shaped link, visually lighter than a wishlist card) |
| Onboarding hero | `EmptyState`-derived, larger, with follow-explainer copy | home-specific empty state |

---

## 6. Layout Constraints

- Content column: `max-width 1200px`, `24px` padding — rows span the column; the carousel
  viewport may bleed to the padding edge so the cut-off peek card touches the container edge.
- Card/slide width: fixed per breakpoint, 320px desktop (3 full + half-cut fourth card at the
  1200px column — the permanent peek), ~75vw (max ~320px) mobile; peek ≥ 24px of the next card
  at all widths whenever the row overflows.
- Heading ladder (issue #159): optional page heading = page step (clamp 26–34px); row
  headings = `text-2xl` 22px step, semibold, `font-heading`; card internals unchanged.
- Controls: carousel arrows and „Zobrazit vše" affordances use the `sm` 26px or `md` 32px
  step; neighboring controls in one row share a step.
- Vertical rhythm: consistent gap between rows (~32–48px); rows never wrap to a second line.
- Mobile (≤768px): identical row structure; arrows yield to touch scroll; no layout switch to
  vertical lists.

---

## 7. Design Tokens

From `src/app.css` (canonical token source — `designs/tokens.css` is legacy, do NOT use it):

- Fonts: `--font-head` DynaPuff (headings, row titles), `--font-body` Geist (everything else).
- Ink system: `--ink` borders at `--border-w` 2.5px, `--ink-faint` dividers,
  `--pattern-dot` notebook dots.
- Sticker language: `--shadow-sticker` / `-sm` / `-lift`, `--radius-panel` 16px,
  `--ease-spring` for hover/press motion.
- Brand: `--brand` → `--brand-deep` gradient (progress fill), `--primary` chips.
- Semantic: `--card`, `--surface`, `--muted-foreground`, `--border`.
- Must hold in all 10 app palettes + dark mode (light is source of truth, dark derives).

---

## 8. Design Constraints (non-negotiable)

- `WishlistCard` visual identity is settled — narrow it, never redesign it.
- Own-list cards show **zero reservation information** (core product invariant).
- Fixed row order Nedávné → Sledované → Spravované → Moje seznamy; no adaptive reordering.
- The peek affordance must exist at every breakpoint whenever a row overflows.
- Rows are horizontal carousels on mobile too — no vertical fallback.
- Czech copy uses vykání; no em-dashes in visible copy (comma, colon, or spaced en-dash).
- Topbar is final chrome — reproduce, do not restyle; no fourth desktop nav item.
- Anime-sky sticker language throughout (ink borders, hard shadows, spring motion).

---

## 9. Design Freedom

- Row heading treatment: plain `font-heading` vs. small rotated sticker label (as on card
  banners) vs. washi-tape accent; whether „Nedávné" gets a subtle differentiator (e.g. clock
  icon).
- „Zobrazit vše": text link beside heading, trailing card, or both.
- Optional page heading „Přehled" above the rows — include or let rows self-label.
- Arrow buttons: placement (heading row right-aligned vs. overlaid on carousel edges), shape,
  visibility timing (always vs. hover).
- Exact slide width, peek amount, inter-row spacing within §6 bounds.
- `ViewAllCard` look (dashed border? arrow glyph? count badge „+7 dalších"?).
- Scrollbar: hidden vs. styled thin; scroll-snap alignment choice.
- Onboarding hero illustration and layout.

---

## 10. Visual References

- **Internal**: `designs/redesign-2026/sky-final/anime-dashboard.html` — settled dashboard
  card language this page must feel native to; `src/lib/components/blocks/dashboard/WishlistCard.svelte`
  + `wishlist_card_variants.ts` — the exact card being reused; `/my-lists` page for
  heading/toolbar rhythm.
- **External**: streaming-service home rows (Netflix-style shelf pattern) — category shelves
  with peek scroll; keep the density of a family app, not a media wall.

---

## 11. Not Included (scope exclusions)

- `lastVisitedAt` schema, upsert timing, and query changes — implementation (issue #225).
- Redirect changes (`/` → `/home`, auth callback, logo target) — implementation.
- Mobile drawer „Přehled" entry — trivial list item, no design needed.
- Changes to the three category pages, nav dropdowns, or archive toggles — explicitly none.
- Anonymous/logged-out landing page — unchanged.
