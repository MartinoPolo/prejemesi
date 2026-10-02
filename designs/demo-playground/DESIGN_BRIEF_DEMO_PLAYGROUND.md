# Demo playground — Design Brief

> **Status**: Approved scoped refinement (Variant A) · [refined prototype](refined.html). Approval covers the demo strip/buttons and reset/lifecycle interactions only. Surrounding navigation, cards, and landing are schematic context, not approved replacements. Hierarchy: user constraints → existing design system/components → interaction prototype. No further design approval is needed for this scoped work.

A visitor can enter an isolated, editable sample of Přejeme si without registering. Persistent, calm context makes it clear that this is temporary fictional data, how long it remains available, and how to reset, exit, or register. The HTML demonstrates interaction, not an implemented product or a security/permissions design.

**Source**: [#433](https://github.com/MartinoPolo/prejemesi/issues/433), `.mpx/DECISIONS.md` § Public demo playground

---

## 1. Purpose

Let visitors try the ordinary recipient, manager, and follower workflows without mistaking a demo for a shared real account. At a glance the bar answers “Am I in a demo, when does it expire, and how do I leave?” Reset is an explicit, reversible decision until confirmation, while account creation states that edits will not transfer.

**Key value**: A credible hands-on preview with unmistakable temporary-data boundaries.

---

## 2. Surrounding Context

The prototype shows the full viewport to demonstrate placement and interactions, not to specify app chrome. Prototype-only controls precede schematic navigation, cards and landing content; the actual app's `Navbar`, `/(app)/home` overview, `HomeShelf`, `WishlistCard`, landing hero and embedded example remain unchanged. The unrotated demo bar belongs below app navigation and outside the main scroller. On narrow screens it uses two rows above the independently scrolling overview. No sidebar or persona switcher is proposed.

**What the existing app provides**: app/landing nav, overview shelf and cards, modal/Select primitives, localized routing. **What this design adds**: one persistent strip below app nav and small landing CTA additions; reset, expiry and registration handoff overlays use existing dialogs. **Not approved as replacements**: prototype navbar buttons, drawer, carousel/cards, landing hero illustration and interactive example.

**Mockup rendering instructions**: inspect both landing and demo at 1440 × 900 and 390 × 844; test 320 px width. Demo strip must not mask content or steal the overview's scroll area. Prototype controls outside simulated chrome allow switching locale, session type and lifecycle states.

---

## 3. Requirements

### 3.1 Entry and overview

- Secondary “Vyzkoušet demo” / “Try demo” alongside primary registration in landing hero and after the existing interactive example. Existing how-it-works link becomes quieter, not removed. One click starts a playground on Přehled; pending and retry states handle slow/failed creation without duplicate submissions.
- Fictional person sees eight curated starting wishlists: three own, two managed, three followed; each has fifteen gifts in the actual seeded implementation. Include ongoing, birthday and Christmas, one draft and one archived list, plausible reservation/received mix. The mockup shows representative cards only, not the complete catalog. Existing dashboard role visibility still applies: own cards do not reveal reservations, managed cards may show aggregate reservation progress, followed cards show availability and own reservations.
- Ordinary wishlist/gift edits, reservation, received state, archive and appearance changes stay inside the private demo. Prepared images and ordinary product links remain usable. Uploads, imports, enrichment, account-security operations, real sharing and invitations are disabled with inline explanations.

### 3.2 Persistent context and lifecycle

- Notice (not `role="alert"`) displays demo identity, an absolute expiry date/time and short remaining time, with Reset, Exit and registration access. Fixed expiry is 24 hours from creation, not a sliding countdown; no seconds ticker. Do not use decorative tape, rotation or warning colors on the normal notice.
- Reset opens confirmation detailing that only demo edits are discarded and lets visitors select Czech or English sample content before the destructive action. Cancel retains data. Language switch changes interface only, not curated content or visitor edits; creation/reset chooses catalog language. Prevent duplicate submits while pending; show retry on failure.
- Expired sessions cannot interact with old content and offer Start new demo and Exit. Exit returns signed-in users to their real dashboard and anonymous users to landing without replacing real sign-in. Registration is a clean real account; demo edits and fictional content do not transfer.

---

## 4. States

| State | Visual treatment | Trigger |
| --- | --- | --- |
| Landing | Existing primary registration and quieter how-it-works plus secondary demo CTA; second entry after embedded example | Before entry / anonymous exit |
| Creating | Pending copy and disabled Start control | First start or fresh start |
| Active | Calm persistent bar and normal overview | Playground ready |
| Edited | Same bar and overview; reset dialog explains removal of edits | Local example edit |
| Reset open | Centered small dialog, content-language Select, Cancel, destructive Reset | Reset click |
| Reset pending | Confirm disabled, in-progress label; no second submit | Confirm |
| Reset failure | Inline error and retry in dialog; edits preserved | Failed reset |
| Expired | Old content inert beneath prominent expiry message; Start new demo and Exit | Fixed TTL elapsed |
| Creation failure | Retry/Exit in error panel | Start failed |
| Restricted action | Disabled control with inline, readable reason | Upload/import/enrichment/security/sharing/invite attempted |
| Registration handoff | Clear non-transfer notice and explicit Continue/Cancel | Register click |
| Exit | Landing for anonymous, real-dashboard destination for signed-in | Exit click |
| Hover/focus/disabled | Existing button affordances; visible keyboard focus, native disabled state | Pointer/keyboard/pending |

---

## 5. Component Reuse Map

### Existing components (use these)

| Component | Variant/Props | Usage in this design |
| --- | --- | --- |
| `Navbar`, `MobileNav` | Existing | App chrome; no new demo navigation |
| `HomeShelf`, `WishlistCard` | Existing | Four normal overview rows and role-gated summary |
| `Button` | `intent="primary"`, `secondary`, `outline`, `ghost`, `primary-destructive`; responsive/default `md` desktop and `lg` mobile, `xl` landing | Entries and lifecycle actions |
| `Dialog.Content` | `size="lg"` default, `showCloseButton` | Reset, handoff |
| Existing `Select.Root`, `Select.Trigger`, `Select.Content`, `Select.Item` | `type="single"`, selected value, `size="lg"` trigger | Catalog language at reset; no new production primitive |

### Components to adopt

None. The preview uses plain HTML for portability; implementation should use the existing Svelte primitives above.

### Components to design

| Component | Description | Why new |
| --- | --- | --- |
| DemoNotice | Persistent status and aligned lifecycle actions | No existing passive lifecycle strip |
| DemoExpiredState | Start-again/exit decision blocking old content | Expiry is distinct from ordinary error/empty state |

---

## 6. Layout Constraints

- Center content and bar internals on `--content-max-width: 1200px`. Inline gutters are `--page-gutter: 12px` mobile and 16 px desktop. Header remains 56 px; banner is in the flex shell, outside the independently scrolling main region.
- Desktop bar has one compact line, status/expiry on the left and actions right with 8 px adjacent gaps; mobile has two compact rows with all three actions visible, 40 px hit targets and 8 px gaps, including at 320 px. Let expiry detail wrap rather than horizontal-scroll the bar.
- Do not change existing slide widths/peek behavior or add a fifth shelf. Archived lists remain off the overview and belong in normal section views; the preview does not reproduce those pages.
- The modal fits a narrow viewport with safe-area clearance and visible footer actions.

---

## 7. Design Tokens

`src/app.css` is canonical; `designs/tokens.css` is legacy, not loaded. Self-hosted DynaPuff Variable for headings, Geist Variable for body; `--background`, `--card`, `--foreground`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--ink`, `--status-danger`, `--radius-panel`, `--radius-btn`, `--border-w`, `--elevation-ordinary`, `--size-control-md/lg`, `--nav-height`, `--content-max-width`, `--page-gutter`. Sky's cool backgrounds and white panels dominate; brand blue marks the primary entry, destructive red only marks confirmed Reset. Informational demo strip is not an alert or taped artifact.

---

## 8. Design Constraints (non-negotiable)

- Server permissions and reservation surprise protection remain authoritative; client-demo appearance is no security boundary.
- Real sessions/data, outbound emails, usable share/invite links and external upload/import/enrichment/security capabilities cannot leak into demo.
- Notice must persist on every playground route, be perceivable without assertive announcement, and not cover content or intercept the main scroller. Dialogs must trap focus and restore it in implementation; the HTML prototype offers native dialog semantics but is not an accessibility certification.
- Formal Czech address, English parity, absolute expiry, explicit non-transfer copy, no second ticker.

---

## 9. Design Freedom

Exact icon choice and compact notice copy, spacing within the two-row mobile bar, subtle borders and status chips; keep hierarchy and fixed shell intact. The scoped refinement is not a landing redesign; schematic surroundings are not styling specifications.

---

## 10. Visual References

- **Internal**: `src/lib/components/blocks/navbar/Navbar.svelte`, `src/routes/(app)/+layout.svelte`, `src/routes/(app)/home/+page.svelte`, `src/lib/components/blocks/dashboard/{HomeShelf,WishlistCard}.svelte`, `src/lib/components/blocks/landing/{LandingHero,LandingDemo,LandingNav}.svelte`, `src/lib/components/base/button/button_variants.ts`, `src/lib/components/base/dialog/dialog_variants.ts`, `src/app.css`.

---

## 11. Not Included

- Application routes, data model, permissions/session isolation, data seeding or reviewed product-image sourcing.
- Full eight-list/fifteen-gift catalog and research; the preview contains representative list cards.
- Shipping/editing real lists, test fixtures, issue edits, design decision updates, commits or deployment.
