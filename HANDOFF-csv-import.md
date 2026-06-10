# Handoff — CSV / Google Sheets Import, Bulk Gift Entry, Enrichment, Multi-link Gifts, Gift Card v2

**Date:** 2026-06-03
**Branch:** `dev` (planning only — no code written yet)
**Status:** Requirements + architecture settled via grilling. Decisions written to `.mpx/DECISIONS.md` (§ "Import, Bulk Entry & Enrichment") and `.mpx/CONTEXT.md`. Design briefs generated under `designs/`. PRD (Phase 1+1b) and issue split are the next step.

> ⚠️ The repo's existing `HANDOFF.md` belongs to a **different** session (PRD #33 image-crop QA/fix). It is unrelated to this feature and was intentionally left untouched. This file (`HANDOFF-csv-import.md`) is the import-feature handoff.

---

## 1. Goal

Turn a table-like list of presents (CSV export, pasted spreadsheet cells, or a Google Sheets link) into a Přejeme si wishlist with **properly-filled gifts**, with minimal manual retyping. The same machinery (an editable "draft grid" + a metadata "enrichment" service + multi-link gifts) also powers **bulk manual gift entry** and a **per-gift auto-fill** button in the single-gift modal.

**Why:** The user's family currently keeps wishlists as shared Google Sheets. Three real exports were analyzed (below). Přejeme si aims to replace that workflow; a frictionless import is the on-ramp, so it must be robust against messy real-world sheets.

---

## 2. The three real sample CSVs (why robustness is non-negotiable)

| File            | Shape                                                      | Gotchas that shaped the design                                                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dárky Rosie** | Clean 4-col: `Name, Type/notes, Link, Vybráno(TRUE/FALSE)` | 2 preamble rows above the header; trailing empty row. **The ideal format.**                                                                                                                                                                     |
| **Maggie**      | Same 4-col                                                 | A **non-URL in the link column** ("Mají i v HM nebo Lindex"); a missing link; a **double-pasted URL** (`…388400https://…388400`); a footer note row.                                                                                            |
| **Rosie vše**   | Messy 2-col: `Name+notes, Link`                            | **Section-header rows** ("Hračky", "Knížky"); `nebo tohle:` = **alternate links for the same gift** across consecutive rows; many **link-only rows with no name**; "taken" was encoded as **red cell color** — which CSV export silently drops. |

**Consequences baked into the design:**

- Header is **not** always row 1 → smart preamble/footer skipping + header detection.
- A "link" column may contain non-URLs or two concatenated URLs → tolerant URL parsing, flag don't crash.
- Perfect auto-parsing of the messy file is impossible → the **editable draft grid is the escape hatch**; we do NOT build a bespoke parser for section-headers / alternate-link rows.
- Cell **color cannot be imported** (CSV drops it) → only an explicit status column can be honored, and we chose to ignore it anyway (see §6.13).

---

## 3. Scope decomposition — one epic, three shared primitives

Everything the user asked for decomposes into three reusable pieces:

1. **Draft grid** — editable multi-row table of gift drafts. _Powers: import Review step **and** standalone batch-add dialog._
2. **Enrichment service** — `enrichLink(url)` now, `enrichByName(name)` later. _Powers: import grid, batch dialog, **and** the single-gift modal ✨ button._
3. **Multi-link gifts** — data-model + card/modal change. _Powers: import rows with alternates, cards, the gift modal._

---

## 4. Phasing (agreed)

| Phase               | Contents                                                                                                                                                                                                             | Why this order                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **1 — Import core** | parse (file/paste/link) → smart-detect → editable **draft grid** → dedup-compare vs existing → commit (new list **or** append). **No enrichment.**                                                                   | Ship the robust headline import first; keep fragile scraping off the critical path.                     |
| **1b — Multi-link** | `gift.links[]` data model + card/modal display (incl. piece-count redesign = Gift Card v2). **Batch-add dialog shell** (manual-only, empty grid → `importGifts`) ships here too — the grid primitive already exists. | Bundles naturally — import rows carry alternate links; manual batch entry is useful without enrichment. |
| **2 — Enrichment**  | Microlink/LinkPeek link→metadata, progressive per-item ✨; wired into draft grid, **batch dialog (the ✨ action added here)**, single-gift modal.                                                                    | External-quota + reliability risk isolated to its own phase.                                            |
| **3 — Name search** | best-effort link-less lookup with candidate confirmation. Optional.                                                                                                                                                  | Lowest reliability; never silent.                                                                       |

---

## 5. Detailed requirements (with rationale)

### 5.1 Entry points & icon

- **New-wishlist-from-import:** an "Importovat" option inside the existing `CreateWishlistModal`, **plus** a lower-intensity **outline button with the Lucide `FileUp` icon** next to the navbar "Vytvořit" button (collapses to icon-only on narrow widths). _Why: import is a secondary path to creation — visible but not competing with the primary CTA._
- **Append-to-existing:** an "Importovat" action next to "Add gift" on the wishlist toolbar (`WishlistDetailToolbar`). _Why: "I forgot a few" / migrating an existing list._
- Both entry points open the **same wizard**; the entry point pre-sets the destination (new vs. this wishlist).

### 5.2 Import wizard — 3 steps (`Zdroj → Kontrola → Potvrzení`)

1. **Zdroj (Source):** choose one of three inputs (§5.3).
2. **Kontrola (Review):** the **draft grid** (§5.5) with mapping controls on top; new-list flow shows an editable **title** pre-filled from the filename (e.g. `"Dárky Rosie sdílená tabulka - Dárky Rosie.csv"` → "Dárky Rosie"); append flow shows the destination list's **existing items alongside** for duplicate comparison.
3. **Potvrzení (Confirm):** summary line ("Vytvořit seznam _Dárky Rosie_ s 21 dárky" / "Přidat 8 dárků do …") → commit → progress → success.

- _Why a wizard:_ the user wants to **review exactly which items will be imported and select/deselect** before anything is created, and to **spot duplicates** against what's already in the app.
- _Why map+edit merged into one step:_ keeps it 3 steps, not 4.

### 5.3 Input methods & parsing

- **① File upload** `.csv` / `.tsv` (drag-drop zone, model on `derived/image-upload`).
- **② Paste cells** into a smart textarea. Copying a range from Excel/Google Sheets pastes as **TSV** (tab-separated) → parseable. The paste handler also reads the **`text/html` clipboard flavor** (Sheets/Excel put a `<table>` there) to robustly preserve columns **and any hyperlink hidden behind cell text**, falling back to plain TSV. _Why: lowest-friction "directly from Sheets" with zero auth; HTML flavor rescues hyperlinks + structure._
- **③ Paste a Google Sheets share/published link.** Server converts to `https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=<gid>` and **fetches server-side** (no CORS). Requires the sheet to be "anyone with link can view" or published. A private sheet returns Google login HTML → detect and show a **friendly error**; a Google **Docs** (non-tabular) link → friendly error. _Why: the "magic" path; server fetch avoids CORS._
- **Parser:** **PapaParse** (RFC-4180 quotes / embedded commas / embedded newlines, BOM strip, **delimiter auto-detect** for the comma-vs-tab cases). Framework-agnostic, pure JS → runs in browser and Cloudflare Worker. _Why: hand-rolled CSV breaks on the quoted-comma / embedded-newline cells already present in the samples._
- **No Google OAuth / Drive Picker.** _Why: disproportionate for a family app (GCP app, consent-screen verification, API keys); paste-cells already covers private sheets with zero auth._

### 5.4 Smart column detection (with manual override)

- Auto-skip preamble/footer rows; auto-detect the header row; auto-classify columns: URL-looking values → **Odkaz**, TRUE/FALSE-ish → **Stav**, numeric+currency → **Cena**, the longest free-text col → **Název**, secondary text → **Poznámka**.
- Every column has a **role dropdown** to override: `Název / Poznámka / Odkaz / Cena / Stav / Ignorovat`.
- _Why smart-with-override:_ nails the clean files (#1/#2) to near-zero effort; the chaotic file (#3) falls back to manual edits in the same grid. We explicitly do **not** special-case section-headers / `nebo tohle:` alternate-link rows. **Price is a detectable/mappable column** even though the 3 samples have none (other CSVs may).

### 5.5 Draft grid (the shared primitive — biggest new UI surface)

- Editable multi-row table of **gift drafts**. Composed from `input` / `select` / `checkbox` / `button` (no `Table` primitive exists).
- **Columns:** select checkbox · **Název** (required; blank = invalid → row excluded until filled) · **Poznámka** (description) · **Odkazy** (one _or more_ links per row; "+ odkaz" up to 10; **each link clickable, opens new tab**) · **Cena** (numeric + currency select, default CZK) · _(Phase 2: ✨ enrich + per-row state)_ · remove-row.
- **Blank-name rows:** stay blank (no domain auto-fill). Their **links are clickable** so the user opens them, sees the product, and types the name manually. _Why: the user explicitly rejected domain-as-name; the clickable link is the manual-naming affordance._
- **Row states:** valid / invalid(blank name) / possible-duplicate(badge, import context) / excluded / _(Phase 2: enriching / enriched / enrich-failed)_.
- **Bulk:** select all/none, delete selected, _(Phase 2) enrich selected_.
- Two hosts: the **wizard Review step** and the **batch-add large dialog** (§5.11).
- Must handle up to ~200 rows acceptably (virtualization is design freedom).

### 5.6 Dedup comparison

- Flag an incoming row as **"možný duplikát"** if its **normalized name** (case/diacritics-insensitive) **OR** any of its **link host+path** matches an existing gift in the destination wishlist. User decides per row. _Why: avoid re-adding items the list already has; name-or-link covers both "same product, different link" and "same link, reworded"._

### 5.7 Commit / backend

- New `guardedCommand` (e.g. `importGifts` / `createWishlistFromImport`) that bulk-inserts gifts in one transaction, assigning sequential `sortOrder`, following the existing `createGift` pattern (`verifyOwnerOrModerator`, `assertWishlistMutable`). New-list variant also creates the wishlist (+ default priority levels, as today). _Why: one round-trip, atomic, reuses settled auth/lock rules._

### 5.8 Multi-link gifts (Phase 1b — data model)

- **Replace `gift.url` (single text) with `gift.links: { url, label? }[]`** (jsonb), **max 10**. `links[0]` is **primary** (drives the domain chip, OpenGraph tags, "Bez odkazu"). Label optional, defaults to the domain. Reservations & likes stay **per-gift** (unaffected).
- _Why jsonb array (not a `giftLink` table):_ matches the existing `imageMeta`/`imageSlots` jsonb pattern, avoids a join on every gift fetch; app is in development so no back-compat shim is needed. Touch points to update: schema, gift create/update remote + valibot, all 3 card view modes, gift modal, the `withLinkOnly` filter, `extractGiftUrlDomain`, OG meta.

### 5.9 Gift Card v2 (Phase 1b — display)

- **Piece count moves next to the title**, larger + muted (e.g. "Ponožky z merino vlny · **3 kusy**"), **replacing the corner "x3" badge**. Czech pluralization (kus / kusy / kusů) via Paraglide.
- **Role-conditional reservation:** visitor/moderator see the reserved part appended ("3 kusy · 1 rezervováno"); the **owner sees the piece count only** ("3 kusy"). _Why: the core invariant — owner must never see reservation state._
- **Multiple links stacked at the bottom of the card** (each clickable, external-link icon + domain, e.g. "↗ alza.cz" / "↗ lidl.cz"); "Bez odkazu" grayed when none.
- "v2" because it supersedes the current card (the one screenshotted with emoji banner + green price + "x3").

### 5.10 Enrichment (Phase 2 — architecture is the important part)

- **Per-item, progressive, offloaded.** Each enrich is its **own remote request**, fired throttled (~4 concurrent) from the browser → each gets a fresh Cloudflare budget; cards "fill in one by one".
- **Provider:** a metadata API — **Microlink** (free 50/day, no key, real headless browser → handles JS-rendered sites, returns normalized OG/JSON-LD + image + brand colors) — behind an **`enrichLink()` abstraction** so LinkPeek (free 100/day) or self-host can swap in. **DIY OG/JSON-LD fetch fallback** for plain sites (saves quota). The provider may be called **client-side** (browser → Microlink) to bypass the Worker entirely → zero Cloudflare cost, zero SSRF on our infra.
- **Surfaces:** draft grid (per-row + bulk), batch dialog, single-gift modal ✨ "Načíst metadata".
- _Why NOT batch-scrape N pages in one Worker request:_ the Cloudflare **free-tier 10 ms CPU/request** budget is blown by parsing many HTML pages. _Why offload parsing:_ keeps the Worker at ~0 CPU (it just does 1 fetch + `JSON.parse`).

### 5.11 Batch-add gifts (dialog shell Phase 1b · enrichment Phase 2)

- A standalone "Hromadně přidat dárky" action opens a **large dialog** (`base/dialog` at wide size) hosting the **same draft grid** (starting empty, manual rows). _Why a large dialog (not a route):_ user preference; the single-gift modal is too cramped for an N-row grid; reuses the import grid primitive.
- **Phasing:** the **manual-only dialog shell ships in Phase 1b** (issue #67) since the draft grid primitive already exists and manual batch entry is useful with no enrichment; the **✨ enrichment action is added to it in Phase 2**.

### 5.12 Single-gift modal v2 (Phase 1b + 2 deltas)

- **Multi-link editor** in edit mode: add/remove/reorder up to 10 links, optional label each, primary = first. Display mode shows all links stacked.
- **✨ "Načíst metadata"** button (Phase 2) that fills image/price/title from a link (later: by name), with loading/success/failed states; non-destructive toward already-filled fields (confirm before overwrite — design freedom).
- Keeps all v1 behavior + invariants (owner never sees reservations; edit-lock after sharing; reserved gifts not force-removable).

### 5.13 The `Vybráno` / "taken" column & cell color

- **Ignored.** Import creates gifts only; the owner **deselects** unwanted rows in the wizard. Cell **color** (file #3's "taken" signal) is dropped by CSV and not supported.
- _Why:_ preserves owner-never-sees-reservations and yields a clean list for re-claiming in-app. _Rejected:_ importing taken rows as anonymous reservations (revisit only if mid-gifting migration is requested); mark-received (wrong semantics — "taken by a gifter" ≠ "owner received it").

### 5.14 Limits & defaults

- Max **200 rows**, max **1 MB** file → friendly error if exceeded. _Why: family lists are small; protects the Worker._
- **Price parse:** strip currency symbols + thousands separators; accept `1 299 Kč` / `1.299` / `1299,-` → **integer** (whole units, matches existing `price integer`); default currency **CZK**. Currencies: CZK / EUR / USD.

### 5.15 Invariant guards (must hold everywhere this epic touches)

- Owner **never** sees reservation counts — applies to Gift Card v2 piece-count line, the dedup "existing items" panel (if it ever showed reserved state — it must not for an owner), and the modal.

---

## 6. Cloudflare / enrichment feasibility (the facts the user asked for)

- **Free-tier limits:** **50 subrequests/request**, **10 ms CPU/request** — but **time waiting on `fetch()` does NOT count as CPU**; only computation (HTML parsing) does. 100k requests/day (irrelevant). ([limits docs](https://developers.cloudflare.com/workers/platform/limits/))
- **The unlock:** one-enrich-per-request → never approaches 50 subrequests or 10 ms CPU on realistic imports. **You will not hit Cloudflare limits.**
- **Real ceilings are external, not Cloudflare:** the metadata-API **daily quota** (Microlink 50/day, LinkPeek 100/day) and **target-site bot-blocking**. Alza actively blocks bots; Heureka sample links are **aggregator/comparison pages** (`…#prehled/`) so OG may be the category, not the exact product → enrichment quality varies per site.
- **⚠️ MCP correction:** MCP servers (the "Microlink MCP", Apify, etc.) run in the **dev/agent environment, not in the deployed Worker** serving end-users. Runtime enrichment must be an **HTTP API** (Microlink/LinkPeek/Apify REST) or DIY fetch. An "Alza MCP" cannot enrich gifts for users in production. (MCP _can_ help me build/test, just not ship.)
- **Name-based search** has no official Alza/Heureka API + bot protection → needs a search API (Brave free 2k/mo, or Firecrawl/Apify, metered), is ambiguous ("which result is _the_ product?"), so it's **best-effort, deferred, candidate-confirm only.**
- **SSRF note:** DIY fetching user-supplied URLs server-side is an SSRF surface → block private IP ranges + non-http(s) schemes. Using a metadata API moves that risk off our infra.

Sources: [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/) · [Microlink metadata](https://microlink.io/metadata) · [metadata-API alternatives](https://dev.to/eatyou_eatyou_d79d27e5622/free-alternatives-to-microlink-and-opengraphio-in-2026-1jn0) · [Apify Alza scraper (bot-protection context)](https://apify.com/bytepulselabs/alza-product-scraper/api)

---

## 7. Design briefs (generated this session)

| Surface                                                    | Brief                                                            |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| Import wizard (shell + Source + Confirm)                   | `designs/import-wizard/DESIGN_BRIEF_IMPORT_WIZARD.md`            |
| Gift draft grid (import Review + batch dialog)             | `designs/gift-draft-grid/DESIGN_BRIEF_GIFT_DRAFT_GRID.md`        |
| Gift Card v2 (piece count + multi-link + role-conditional) | `designs/gift-card-v2/DESIGN_BRIEF_GIFT_CARD_V2.md`              |
| Gift detail modal v2 (multi-link editor + ✨ enrich)       | `designs/gift-detail-modal/DESIGN_BRIEF_GIFT_DETAIL_MODAL_V2.md` |

Next design step: `sk-mockup` HTML variants per brief → `sk-design-refine`.

---

## 8. Open / deferred

- Phase 3 name-search reliability (provider choice, candidate-confirm UX) — unresolved by design.
- Enrichment **provider final pick** (Microlink vs LinkPeek vs self-host) — abstracted behind `enrichLink()`; decide at Phase 2 build.
- Whether the batch grid should accept a **paste block directly into the grid** (vs only the wizard textarea) — design freedom, nice-to-have.
- Whether enrichment runs **client-side** (browser→Microlink, zero Worker cost) or **server-side** (hides quota usage) — lean client-side; confirm at build.

---

## 9. Reference: settled decisions & code anchors

- **Decisions:** `.mpx/DECISIONS.md` → § "Import, Bulk Entry & Enrichment" (9 entries, dated 2026-06-03).
- **Context:** `.mpx/CONTEXT.md` → 4 new feature rows, 4 key constraints, 4 domain terms (Gift draft / Draft grid / Enrichment / Import wizard).
- **Schema:** `src/lib/server/db/gift.schema.ts` (`gift` — change `url`→`links` jsonb), `wishlist.schema.ts`.
- **Gift remote + valibot:** `src/lib/modules/gifts/gifts.remote.ts`, `src/lib/modules/gifts/types.ts` (`CreateGiftInputSchema`).
- **URL util:** `src/lib/modules/gifts/gift_url.ts` (`normalizeGiftUrl`, `extractGiftUrlDomain` — extend for arrays).
- **Remote wrappers:** `src/lib/server/remote.ts` (`guardedCommand`, etc.).
- **Entry points:** `blocks/navbar/Navbar.svelte` (Vytvořit), `blocks/wishlist/CreateWishlistModal.svelte`, `blocks/wishlist/WishlistDetailToolbar.svelte` (Add gift).
- **Gift modal:** `blocks/gift/GiftDetailModal.svelte` + `GiftDetailForm.svelte`.
- **i18n:** Paraglide, `messages/*.json`, `import * as m from '$lib/paraglide/messages.js'`.
