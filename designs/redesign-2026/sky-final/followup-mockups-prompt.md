# Prompt: Redesign 2026 follow-up mockups (4 surfaces)

Copy everything below into a fresh session run from the repo root.

---

Create the four follow-up design mockups for the Redesign 2026 ("Anime Sky") effort of Přejeme si — a Czech family wishlist app where the owner must never see reservation state (core product invariant).

## Source of truth — read first

1. `designs/redesign-2026/anime-sky-final.html` — THE design base. Read it fully before writing anything. Copy its conventions verbatim: token system (palette primitives + derived tokens), header markup (palette/language/dark controls), fonts, motion keyframes, dark-mode derivation.
2. `.mpx/DECISIONS.md` → section "Redesign 2026 — Anime Sky" — the settled decisions these mockups must express.
3. `.mpx/CONTEXT.md` — domain language (Wishlist, Gift, Owner, Moderator, Visitor, Gifter, Reservation, statuses).

## Hard conventions (same as anime-sky-final)

- One self-contained HTML file per mockup, in `designs/redesign-2026/`. Only external resource: the Google Fonts link (DynaPuff + Geist). No CDN JS, no external images — placeholder art = emoji + CSS gradients.
- Copy the FULL token block from anime-sky-final: `:root`/`[data-palette="…"]` primitives (all 10 palettes), derived tokens, `[data-theme="dark"]` block. All color derivation via `color-mix(in oklab, …)` — NEVER `in oklch` (hue collapse when mixing over white).
- Include the same header controls (palette dropdown, language dropdown with text "CZ" trigger, 3-state-styled dark toggle) and the same localStorage keys (`psi-final-theme`, `psi-final-palette`) so theme/palette choices carry across all mockup files.
- All entrance/hover animation inside `@media (prefers-reduced-motion: no-preference)`. Reuse the existing keyframes (fadeUp/reveal cascade, popIn, emojiWiggle) and the spring lift `cubic-bezier(.34,1.56,.64,1)`.
- Czech copy throughout (diacritics correct). Reuse seed-style names: Martin, Jana, Anička, Babička, Petr.
- Product rules the content must respect:
  - Owner NEVER sees reservation state — owner-context cards show no progress bars, no reserved counts, no reserver names.
  - Visitors + moderators DO see reserver display names ("rezervovala Babička") and progress bars ("7/12 rezervováno").
  - Wishlist statuses: Koncept / Sdílený / Archivováno. Archived surfaces are dimmed/desaturated.
  - Reserved/received gifts are dimmed (see gift cards in anime-sky-final).

## Task 1 — iterate `anime-sky-final.html` in place

- **Taped polaroid**: add the wishlist photo as a polaroid-style print taped/pinned onto the notebook header (rotate slightly, white border, caption strip, tape like `.wl-sticky::before`). Placeholder: emoji scene or CSS gradient. It must coexist with the sticky note without crowding the title (polaroid left/right balance, sticky stays top-right).
- **Mobile countdown chip**: below ~960 px the sticky note currently disappears — replace that with a countdown chip in the `.wl-meta` row (next to the 🗓 absolute-date chip), e.g. `⏳ už za 67 dní`.
- **Loud trust-warning variant**: below the existing calm `.disclosure` (moderator reassurance), add the second variant — an accent sticky-note-style banner (tape, bold, warning tone) for visitors when the owner self-promoted to moderator: "⚠️ Martin (majitel) je zároveň správcem — vidí rezervace." Label both variants with small annotation tags so they read as two states, not two stacked banners.

## Task 2 — `anime-dashboard.html` (new)

Dashboard ("Moje seznamy" + a "Sledované" section) in the anime style:

- App navbar identical to the wishlist view (tabs Moje seznamy / Spravované / Sledované, pill active state, header controls, avatar).
- Page title row merged with toolbar (single row): explicit labeled sort buttons, card/list view toggle, "Zobrazit archivované" toggle chip.
- **Owner card grid** (sticker style — ink border, hard shadow, spring lift hover): banner image area with title inside, status chip (Sdílený/Koncept), gift count, "Vytvořeno 3. května · Upraveno včera", NO reservation info anywhere.
- One **dimmed archived card** (desaturated, "Archivováno" chip).
- **Sledované section**: followed-list cards WITH progress bar ("7/12 rezervováno") and owner name — annotate that progress appears only for non-owner contexts.
- **List view** variant of the same data (rows), plus one **empty state** ("Zatím žádné seznamy" + Vytvořit CTA) — can be a separate annotated strip at the bottom.
- "Vytvořit" primary CTA in the toolbar area.

## Task 3 — `anime-gift-detail-modal.html` (new)

Gift detail modal over a dimmed wishlist backdrop (reuse a simplified gift grid behind an overlay):

- Centered 2-column modal (sticker panel): image left (framed, polaroid-flavored), details right — title, piece count "3 kusy · 1 rezervováno", price (primary-colored), priority chip, description with an accent-colored appended segment + "✏️ Upraveno po sdílení" badge, stacked multi-link list (domain chips "↗ alza.cz", grey "Bez odkazu" case), like button, reserve area.
- Show the reserve-area states as annotated variants (side by side or stacked examples): available → primary "Rezervovat"; reserved by someone else → dimmed + "✓ Rezervováno · rezervovala Babička"; reserved by me → "Zrušit rezervaci" + purchased toggle ("Koupeno").
- **Mobile variant** (~390 px): modal becomes a full-screen stacked sheet — image top, details below, sticky action bar at bottom.

## Task 4 — `anime-auth.html` (new)

Split-screen auth pages:

- Left branding panel: notebook/sticker motifs, wordmark, doodles, 2–3 value bullets ("Babička rezervuje jedním klikem", surprise-protection line).
- Right form card (sticker panel): **login** — email + password inputs (ink-border style), primary submit, "Poslat kouzelný odkaz" magic-link button, Google button (official Google logo colors allowed), link to registration.
- **Register variant** on the same page (second section or tab-style toggle): name/email/password + password-strength bar in palette colors.
- Mobile: stacked — condensed branding header above the form.

## Verification (required)

Use the Chrome DevTools CLI (`chrome-devtools new_page/resize_page/take_screenshot/evaluate_script`; the MCP server may not be connected — the `chrome-devtools` shell command works). Verify EVERY file:

- Desktop 1440×900 and mobile 390×844 (no horizontal overflow: `document.documentElement.scrollWidth <= window.innerWidth`).
- Light AND dark mode; at least 2 non-default palettes (e.g. Máta, Med — Med has an accent override).
- Hover states on cards/buttons; `list_console_messages --types error --types warn` clean.
- Fix what you find; screenshot evidence in the scratchpad.

## Deliverables

- Updated `anime-sky-final.html` + 3 new files in `designs/redesign-2026/`.
- Short summary of design choices made where the brief left room (polaroid placement, modal state presentation, etc.).
