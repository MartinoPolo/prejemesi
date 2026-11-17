# Gift Editor Rebuild — Design Brief

Rebuild the gift create/edit dialog from scratch for desktop and mobile. The owner has struggled with this dialog for a long time: the image workshop needs scrolling, the scroll gesture collides with drag-to-reposition, the two crop views feel secretly connected, the link rows are noisy, and the dialog chrome is inconsistent. Everything in the current layout may be questioned.

**Source**: owner request of 2026-11-16 (conversation), `.mpx/DECISIONS.md` sections "Images & cropping" and design/layout entries dated 2026-07-18 and 2026-09-19, which this exploration may propose to replace.

---

## 1. Purpose

A recipient or manager edits one gift: name, description, ordered shop links, price, priority, categories, quantity, and a gallery of up to eight images, each framed for two views. The dialog must answer at a glance: "what will other people see?"

**Key value**: edit every part of a gift without scrolling to hunt for controls, and see the result as visitors see it.

---

## 2. Surrounding Context

A centered modal dialog over the wishlist page (`src/routes/(app)/w/[id]/+page.svelte`). Gift editing stays in a dialog, not a route.

**Mockup rendering instructions**

- One HTML file per variant containing a presentation board with: a desktop frame (1440×900 viewport, dimmed wishlist page behind, dialog at real proportions) and mobile frames (390×844 phone, dialog full-screen).
- Show at least these states, each as its own frame with a short caption: (1) desktop default, (2) desktop while framing an image, (3) desktop with a link being edited, (4) mobile default, (5) mobile image framing, (6) mobile preview "as others see it" (whatever the variant proposes).
- Light mode. Link `../assets/app.css` (compiled from `src/app.css`); never `designs/tokens.css`. Use its tokens (`var(--primary)`, `var(--text-sm)`, `var(--font-heading)` …) and utilities; component-specific CSS only in `<style>`.
- Czech UI copy with vykání. Images: `../../../static/demo/v1/backpack.jpg` (cover) and `../../../static/demo/v1/gallery/hiking-backpack-{2,3,4}.jpg`.
- Small inline JS for tab/segment switching is welcome; no frameworks or CDNs.

**Mock data**: gift "Turistický batoh Osprey Talon 22" · description two sentences · links `https://www.hudy.cz/osprey-talon-22-…` (label "Hudy", main) and `https://www.heureka.cz/…` (label "Heureka") · price 3 290 Kč · priority "Moc chci" · category "Outdoor" · quantity 1 · four images.

---

## 3. Requirements

### 3.1 Dialog chrome (same structure on both breakpoints)

- Fixed header row: title "Upravit dárek" (or "Přidat dárek") in the heading font, and a 40 px close target, vertically centered on one line. The header never scrolls.
- The close button must sit inside the header, clear of the body scrollbar. Today the desktop dialog has no title and its floating X touches the scrollbar; mobile has a title that is misaligned with the rest.
- Fixed footer: "Smazat dárek" (destructive, left, edit only), "Zrušit", "Uložit". Only the body between header and footer may scroll.

### 3.2 No scrolling to reach the image

- On desktop at 1440×900 the image area and the primary fields are visible together without scrolling.
- On mobile the user reaches images through a switcher (tabs, segmented control, or drill-down), not by scrolling past the form.
- A pannable crop surface must never sit inside a region the user scrolls with the same gesture.

### 3.3 Image section order

1. First: the gallery strip, all images (max 8) with cover marker, reorder grip, remove, and the add tile ("Přidat obrázek": upload or paste URL) at its end. Adding is never placed between a preview and its controls.
2. Then: the selected image and its two views.
3. Then: per-image background fill (tečkované / bílé / černé).

### 3.4 Independent views

Each image is framed for two views: **Karta** (4:3 grid card) and **Seznam** (1:1, also used by reservation and carousel). They are independent:

- Pan and zoom on one view never moves the other.
- The old global mode (Vyplnit / Přizpůsobit / Ručně) is replaced by per-view presets: **Vyplnit** (cover, centered) and **Celý** (whole image), plus free pan/zoom. A view shows its state as a small status ("Vyplnit", "Celý", "Vlastní").
- One explicit action copies framing between views ("Použít i pro Seznam" / "Použít i pro Kartu"). Variants may instead explore a clearly visible chain toggle that links both views; whichever is used, the linked or unlinked state must be obvious at all times.
- Zoom slider, 3×3 alignment pad or recenter, and keyboard operation stay available (arrows pan, +/− zoom, 0 recenters).

### 3.5 Preview as others see it

- Desktop: instead of a large abstract crop stage, show the real gift card (image with current framing, title, main link, price, priority, category, action footer) and the real list row. Ideally framing is done directly on that real card. Reproduce `GiftCard.svelte` and `GiftListItem.svelte` faithfully (read them).
- The preview updates live with every field (name, price, links).
- Mobile: propose a solution (third tab, peek sheet, drill-down, …).

### 3.6 Links

Today each link takes two rows (URL input with up/down/delete icons, then "Viditelný popisek" label + input). Target: one line per link.

- The owner's idea: show the URL with the visible label highlighted inside it (for example **hudy** in `www.hudy.cz/osprey…`), and hide the editable label behind an accordion, popover, or edit state.
- Keep: ordered links, the first is the main link shown on the card, reorder, delete, "Přidat odkaz", optional custom label (default derived from the domain).
- Pasting a URL should be the whole add flow.

### 3.7 Other fields

Název (required), Popis (rows-driven textarea), Cena with optional range (od–do) and Měna, Priorita (select), Kategorie (multi chips with a primary), Počet kusů. Group and size them so they do not waste space; controls are `md` (32 px) on desktop and `lg` (40 px) on mobile.

---

## 4. States

| State | Visual treatment | Trigger |
| --- | --- | --- |
| Default | Fields filled, cover image selected | Open edit |
| No image | Gallery strip shows only the add tile; preview shows the placeholder | New gift |
| Framing | Selected view highlighted, zoom and presets visible | Click a view |
| View status | "Vyplnit" / "Celý" / "Vlastní" chip per view | After preset or pan/zoom |
| Link collapsed | One-line row | Default |
| Link editing | URL and label editable | Click row or edit icon |
| Uploading | Progress on the strip tile, Save disabled | Upload |
| Dirty close | Existing unsaved-changes guard | Close with edits |

---

## 5. Component Reuse Map

Read APIs under `src/lib/components/base/` and `src/lib/components/derived/` and mirror their look: `Button` (intents primary / outline / ghost / destructive, sizes sm / md / lg), `Input`, `Textarea`, `Select`, `ToggleGroup` (segmented), `Tabs`, `Badge`, `Popover`, `Dialog`, `ImageFrame`, `ImageCropStage`, `GiftImageStrip`, `GiftLinkEditor`, `GiftCard`, `GiftListItem`.

Current implementation to question: `src/lib/components/blocks/gift/GiftDetailForm.svelte`, `GiftDetailModal.svelte`, `GiftImagePreviewSlots.svelte`.

---

## 6. Layout Constraints

- Desktop dialog: up to about 1100 px wide and 90 vh tall; mobile: full screen.
- Control heights 26 / 32 / 40 / 48 px (`sm` / `md` / `lg` / `xl`).
- Nested rounded corners: inner radius = outer radius − border − padding.
- Touch targets at least 40 px on mobile.

## 7. Design Tokens

Only tokens from `assets/app.css`: DynaPuff headings, Geist body, the hard-shadow elevation style, semantic colors. No raw hex colors except image mats.

## 8. Design Constraints (Non-Negotiable)

- Dialog, not a route. Fixed header and footer.
- Two targets only (Karta 4:3, Seznam 1:1); no new crop targets.
- Gallery max 8, first is the cover.
- Save and Cancel always reachable.

## 9. Design Freedom

Everything else: column arrangement, tabs versus panes versus drill-down, where the preview lives, how links collapse, how the two views are presented and manipulated.

## 10. Visual References

`src/lib/components/blocks/gift/GiftCard.svelte`, `GiftListItem.svelte`, `src/lib/components/base/dialog/`, the wishlist settings dialog tabs (fixed tab row above body-only scrolling).

## 11. Not Included

Persistence format changes, the gift viewer, the reserve modal, wishlist image editor.
