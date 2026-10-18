# AI Chatbot — Design Brief

> **Status**: Variants for review, none chosen
> **Comparison page**: `designs/ai-chatbot/index.html`
> **Variants**: `designs/ai-chatbot/variants/variant-{a,b,c}.html`

An in-app AI assistant that creates gifts, enriches them (product data, price references, images, review scores) and edits them in bulk from plain Czech. It is an ordinary API client acting as the signed-in user: every change becomes a proposal reviewed on the existing review page, unless the chat's fast-forward applies it directly.

**Source**: [#478](https://github.com/MartinoPolo/prejemesi/issues/478) G12–G21 (epic [#480](https://github.com/MartinoPolo/prejemesi/issues/480)); `.mpx/DECISIONS.md` § Agent access & AI automation.

---

## 1. Purpose

Turn "I have a few links and a vague idea" into a tidy, priced, illustrated wishlist without filling forms, while keeping the user in control of every change. The panel must make three things obvious: what the assistant is about to change, where to confirm it, and why it cannot help right now when it cannot.

**Key value**: describe the gift, get a complete gift card back for one-click review.

---

## 2. Surrounding Context

### Full Viewport Structure

1. **App navbar** (final state): 56 px, logo, Moje seznamy / Spravované / Sledované pills, bell and avatar right; mobile drawer trigger.
2. **Wishlist page** `/w/<id>` (final state) for a manager: notebook hero ("Pro: Babička", title "Vánoce pro babičku", Settings gear, More), then the toolbar (View, Display, Add gift rightmost), then gift cards (Card view, 3–4 columns desktop, 2 or 1 mobile).
3. **Pending banner** (exists, `PendingChangesBanner.svelte`): an `Alert` above the toolbar, key icon, title "Čekající změny (n)", description "Váš agent navrhl změny tohoto seznamu. Použijí se, až je zkontrolujete.", one row per proposal "3 změny přes token „Claude“ · platnost do 25. 10." with a secondary sm "Zkontrolovat" button linking to `/w/<id>/changes/<proposalId>`.
4. **Review page** `/w/<id>/changes/<proposalId>` (exists, `designs/agent-change-review/refined.html`): compact header, summary strip, change rows with a tinted header band, sticky "Použít vybrané (n)" bar.

**What parent provides**: navbar, wishlist page, review page, toasts.
**What this design fills**: the AI side panel, the "Vylepšit pomocí AI" entry points, the chat-to-review handoff, and the small additions to the pending banner and wishlist toolbar.

**Mockup rendering instructions**:

- Desktop ~1440×900 and mobile 390×844, light and dark, palette `sky`.
- Render the wishlist page behind/beside the panel at real fidelity (navbar, hero, toolbar, 6–8 gift cards) so the panel's footprint is honest.
- A visually separate review toolbar switches viewport, theme and scenario. The same state must be reachable by URL query: `?viewport=desktop|mobile&theme=light|dark&scenario=<id>` (scenario ids in §4).

---

## 3. Requirements

### 3.1 Placement and entry points (G12)

- **Side panel** opened from a wishlist-level "AI asistent" control (designer chooses: hero/toolbar button, navbar icon, or floating trigger) for managers and linked recipients of that wishlist. The panel is scoped to the current wishlist and says so ("Vánoce pro babičku").
- **"Vylepšit pomocí AI"** on a gift: in the gift More menu ("Další akce") and in the gift editor dialog. It opens the panel focused on that gift and starts the enrich flow immediately.
- Desktop: a right-side panel ~400–440 px; the designer decides whether it pushes the wishlist content or overlays it. Mobile: full-height sheet or full-screen view with a 40 px close target; the composer stays above the keyboard and safe area.
- Visitors never see any entry point.

### 3.2 Conversation basics

- Composer: multi-line input, send button, placeholder such as "Napište, co mám udělat…", attach-links affordance is optional (pasting links in text is enough).
- Assistant messages may contain: plain text, a progress/tool line ("Hledám na Heurece a Alze…", "Načítám odkaz…"), gift result cards, and a proposal card.
- Streaming state with a stop control ("Zastavit").
- Suggested starters for an empty chat: "Vylepšit dárek bez obrázku", "Přidat dárky z odkazů", "Upravit více dárků najednou".
- The assistant never claims a change happened before it is applied.

### 3.3 Flow: enrich one gift (G13)

Starting from "Vylepšit pomocí AI" on "Sluchátka Sony WH-1000XM5" (name + one link, no image, no price):

- Product data: corrected title (only before share; on a shared occasion list the name is frozen, so the assistant says it keeps the name), short description, brand/model.
- **Price references**: Heureka and Alza with prices and links, plus a foreign reference when relevant; the proposed gift price is a range or estimate ("7 990–8 490 Kč") and the references become additional links.
- **Images**: 3–4 candidate images; the user picks one (or none). The chosen image is fetched server-side (no hotlinking), so show it as "obrázek se uloží do Přejeme si".
- **Review score**: e.g. "4,7/5 · 2 315 hodnocení na Heurece". The gift has no rating field today; show it as a proposed description line and keep it visually separable (see open questions).
- Ends with a proposal of one gift edit with field diffs (name, description, price, links, image).

### 3.4 Flow: create gifts from links or text (G13)

- The user pastes 3 links and one line of free text ("a nějakou deskovku pro 2 hráče do 800 Kč").
- The assistant resolves each into a gift draft card (image, name, price, link) and asks about the vague one with 2–3 concrete candidates.
- Ends with a proposal of N new gifts. Show a failed link ("Odkaz se nepodařilo načíst") without blocking the rest.

### 3.5 Flow: bulk edit from plain language (G13)

- Example: "Všechno nad 3 000 Kč dej do nízké priority a smaž ty dva duplicitní Lego sety."
- The assistant restates the scope ("Změním 4 dárky, smažu 2") before proposing.
- Deletions are flagged as needing confirmation; a reserved gift cannot be deleted and the assistant explains it without revealing reservations to a recipient (for a recipient it simply says the gift cannot be deleted right now; for a správce it may say it is reserved).

### 3.6 Proposals, review handoff and fast-forward

- **Default (review)**: the chat submits a proposal and shows a proposal card: counts by kind ("2 úpravy, 3 nové dárky, 1 smazání"), validity "platnost 7 dní", primary "Zkontrolovat a použít" → `/w/<id>/changes/<proposalId>`. The wishlist page behind shows the pending banner; for chat proposals its row reads e.g. "3 změny z AI asistenta" instead of "přes token". Show how the review page is reached (navigation or a mini preview of the review page) and how the chat reflects the outcome afterwards ("Použito 5 z 6 změn").
- **Fast-forward per chat**: an explicit, clearly labelled toggle in the panel ("Použít změny bez kontroly"), off by default, with help text "Smazání, rezervace a pozvánky správců vždy potvrdíte." When on: ordinary edits and creations apply immediately with an applied card ("Použito · Vrátit") and the cards behind update; deletions, reservations and manager invitations are held in the same chat as a confirmation card (or routed to the review page) and never apply silently.
- Undo: applied batches offer "Vrátit" (whole batch), consistent with the review page's undo.

### 3.7 Access and limit states (G14, G18, G20, G21)

- **Allowlisted family member**: full panel.
- **Not allowlisted**: no working chat. Decide whether the entry point is hidden or shown as a locked teaser; mock the locked panel either way: "AI asistent je zatím jen pro pozvané testery." No pricing, no waitlist form, no bring-your-own-key field (G18). Point to Settings › Přístup pro AI a aplikace as the way to use one's own AI.
- **Per-user daily cap reached**: history readable, composer disabled, "Dnešní limit AI asistenta jste vyčerpali. Obnoví se zítra v 0:00." Pending proposals stay reviewable.
- **Global kill switch on**: "AI asistent je dočasně vypnutý." Composer disabled, history readable, no retry spinner. Entry points may show a muted disabled state.
- **Provider error**: the failed assistant turn shows an inline error with "Zkusit znovu"; the user's message is kept; nothing was changed.
- **Demo playground**: a fake chatbot with predefined actions only: tappable action chips ("Vylepšit sluchátka", "Přidat 3 dárky z odkazů", "Seřadit podle ceny"), no free-text composer (or a disabled one), a clear note "Ukázka: odpovědi jsou předpřipravené, nic se neposílá AI." Its proposals apply to the demo data like real ones.

### 3.8 History (G19)

- Past chats of the last 30 days are listed (per wishlist or global, designer's choice), each with a title, date and outcome ("3 změny použity"). Show "Konverzace se mažou po 30 dnech." Starting a new chat is one action.

---

## 4. States (scenario ids)

| Scenario id       | What it shows                                                                 |
| ----------------- | ----------------------------------------------------------------------------- |
| `chat`            | Allowlisted, panel open on an empty or fresh chat with starters               |
| `enrich`          | "Vylepšit pomocí AI" on the headphones: references, images, score, proposal   |
| `create`          | Gifts from 3 links + text, one ambiguous, one failed link, proposal           |
| `bulk`            | Plain-language bulk edit with restated scope and a confirmation-needed delete |
| `streaming`       | Assistant working: tool progress lines, streaming text, Zastavit              |
| `handoff`         | Proposal card, pending banner "Čekající změny (1)", path to the review page   |
| `fast-forward`    | Fast-forward on: applied card with Vrátit, a held deletion awaiting confirm   |
| `history`         | 30-day chat history list                                                      |
| `not-allowlisted` | Locked panel                                                                  |
| `daily-cap`       | Cap reached, composer disabled                                                |
| `kill-switch`     | Globally disabled                                                             |
| `provider-error`  | Failed turn with Zkusit znovu                                                 |
| `demo`            | Fake chatbot with predefined action chips                                     |

Plus hover/focus on every control and the gift More menu showing "Vylepšit pomocí AI" (reachable in `enrich` or as its own scenario).

---

## 5. Component Reuse Map

### Existing Components (MUST use)

| Component          | Path                                              | Usage                                        |
| ------------------ | ------------------------------------------------- | -------------------------------------------- |
| Button             | `src/lib/components/base/button/`                 | Send, Zkontrolovat a použít, Vrátit, chips   |
| Badge              | `src/lib/components/base/badge/`                  | Kind counts, "Vyžaduje potvrzení"            |
| Alert              | `src/lib/components/base/alert/`                  | Locked, cap, kill switch, provider error     |
| Switch             | `src/lib/components/base/switch/`                 | Fast-forward toggle                          |
| Textarea           | `src/lib/components/base/textarea/`               | Composer                                     |
| Sheet / Dialog     | `src/lib/components/base/sheet/`, `dialog/`       | Mobile panel, confirmation                   |
| DropdownMenu       | `src/lib/components/base/dropdown-menu/`          | Gift More menu entry                         |
| ImageFrame         | `src/lib/components/derived/image-frame/`         | Gift thumbs and candidate images             |
| GiftCard           | `src/lib/components/blocks/gift/GiftCard.svelte`  | Result previews (real geometry)              |
| FieldDiffList      | `src/lib/components/blocks/change-proposals/`     | Diffs inside proposal cards                  |
| ChangeKindTitle    | `src/lib/components/blocks/change-proposals/`     | Kind counts with the shared colour mapping   |
| PendingChangesBanner | `src/lib/components/blocks/change-proposals/`   | Wishlist banner (copy variant for chat)      |
| Skeleton           | `src/lib/components/base/skeleton/`               | History loading                              |

### Components to Design (new)

| Proposed Name   | Description                                              |
| --------------- | -------------------------------------------------------- |
| AssistantPanel  | Panel shell: header (scope, fast-forward, history, close), thread, composer |
| ChatMessage     | User/assistant turns, tool-progress lines, error turn    |
| EnrichmentCard  | Price references, image candidates, review score, picks  |
| ProposalCard    | Kind counts, validity, handoff or applied/undo state     |

---

## 6. Layout Constraints

- Desktop panel 400–440 px, full height below the navbar; content container keeps its 16 px gutters. Mobile panel is full width with 12 px gutters.
- Rows under the panel close button reserve `--overlay-close-clearance`.
- Nested surfaces follow the nested-corner rule in `AGENTS.md`.
- Typography from `src/app.css`: panel title 17 px DynaPuff semibold; message text 14 px Geist; meta/help 12 px muted; tool lines 12–13 px.
- Controls: `md` 32 px desktop, `lg` 40 px mobile; composer send matches control height.

---

## 7. Design Tokens

From `src/app.css` (inline a mirrored subset; do not link `designs/tokens.css`):

- Fonts: `--font-head` DynaPuff Variable, `--font-body` Geist Variable (woff2 in `designs/unavailable-gift-comparison/assets/`).
- Type scale `--text-xs` 11 … `--text-3xl` 28; control heights 26/32/40/48.
- Surfaces and ink: `--ink`, `--card`, `--background`, `--tint`, `--panel-hover`, `--muted-foreground`, `--brand`, `--brand-link`, `--primary`, `--primary-foreground`, `--accent-loud`.
- Status text (AA): `--status-success-text`, `--status-warning-text`, `--status-danger-text`; solid danger fills `--status-danger-fill`; raw `--status-*` only for borders, icons and tints. Mix in **oklab**.
- Radii `--radius-panel` 16, `--radius-btn` 7, `--radius-badge` 12; 2–2.5 px ink borders; hard offset shadows via elevation tokens.

---

## 8. Design Constraints (Non-Negotiable)

- Czech copy with vykání, no em dashes in visible copy.
- Every mutation is a proposal or, under fast-forward, an applied batch with Vrátit. Deletions, reservations and manager invitations always need an explicit confirmation.
- No bring-your-own-key input, no credits or pricing UI.
- Role-filtered content: a recipient's chat never reveals reservations or reserver names.
- AI-made gifts carry no visitor-facing AI marker.
- Post-share rules hold: no name change on frozen gifts, description changes are appends on shared occasion lists.
- Light mode is the source of truth; dark is token-derived.
- Keyboard: panel traps nothing on desktop (it is not modal when docked), Escape closes, focus returns to the trigger.

---

## 9. Design Freedom

- Push vs overlay on desktop; sheet vs full screen on mobile.
- Conversation-first vs task-first vs gift-workbench emphasis.
- Where the panel trigger lives.
- How much of the review happens inside the chat versus on the review page.
- History per wishlist or global.

---

## 10. Visual References

- `designs/agent-change-review/refined.html`: review page, kind colours, field diffs, token mirror.
- `designs/access-tokens-settings/refined.html`: settings section and fast-forward wording.
- `designs/unavailable-gift-comparison/refined.html`: gift card markup.
- `designs/gift-viewer/refined.html`: dialog styling.

---

## 11. Not Included (Scope Exclusions)

- Provider, model and billing configuration (G14, G16, G17).
- Admin UI for the allowlist, global cap and kill switch.
- Linkless name search beyond what the create flow shows.
- Implementation of the review page itself (exists).
