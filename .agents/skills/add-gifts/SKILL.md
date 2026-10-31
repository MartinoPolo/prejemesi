---
name: add-gifts
description: "Research product metadata and reference prices (Heureka, Alza, category stores such as Steam), then add new gifts or update existing ones on the user's wishlists through the Přejeme si CLI or MCP server, as change proposals the user reviews."
argument-hint: '<product URLs or gifts to update...> [wishlist URL or name]'
allowed-tools: Read, Write, WebFetch, WebSearch, Bash(npx prejemesi *), Bash(prejemesi *), Bash(node packages/cli/dist/bin.js *), Bash(node scripts/gift-research-browser.mjs *), mcp__prejemesi
metadata:
    version: '2.0'
    category: operations
---

# Add gifts

Accept product URLs for new gifts, existing gifts to enrich (for example with review data, prices or links), and an optional wishlist URL or name. This workflow is evidence-only: **Never guess** a product identity, brand, model, price, currency, image, gift, or wishlist target.

## Connection

Act as the user with **their own personal access token**, through either:

- **CLI:** `npx prejemesi …` (`packages/cli/README.md`). Inside this repository before the package is published, run `pnpm --filter prejemesi build` once and use `node packages/cli/dist/bin.js …`. Output is JSON; failures go to standard error.
- **MCP:** the `prejemesi` server (`docs/API.md#mcp`), whose tools mirror the API: `listWishlists`, `readWishlistGifts`, `readGiftCategories`, `readPriorityLevels`, `uploadImage`, `submitChangeProposal`, `getChangeProposal`.

The skill **never reads, asks for, or prints** the token. Do not open the CLI config file, echo `PREJEMESI_TOKEN`, or pass a token argument. When the CLI answers `NOT_LOGGED_IN` or a 401 code, stop and ask the user to run `npx prejemesi login` themselves. The token needs `gifts:write`; on `AGENT_SCOPE_MISSING` or `AGENT_WISHLIST_NOT_ALLOWED`, tell the user which scope or wishlist it lacks. Only the user changes tokens, in Settings.

## Target wishlist

List the wishlists the token reaches (`prejemesi wishlists` or `listWishlists`). Pick the one whose `shortId` matches a `/w/<shortId>` URL, or whose title matches the given name exactly; ask when none or several match. Gifts can be changed only where the user's role allows it; report the wishlist title and recipient.

Before proposing, read the wishlist's state:

- gifts: `prejemesi gifts list --wishlist <shortId>` or `readWishlistGifts` (`{ "wishlistShortId" }`), for gift ids and to spot duplicates;
- categories: `prejemesi read readGiftCategories --input '{"wishlistId":"<id>"}'` or the tool of the same name;
- priority levels: `readPriorityLevels` with the same input.

## Extraction order

For every supplied URL, use this order:

1. Fetch the page and inspect product JSON-LD.
2. Inspect OpenGraph fields, the canonical URL, and ordinary page metadata.
3. Only when direct extraction is incomplete, perform an **exact brand/model** web search. Accept a search result only when its identity is unambiguous and matches the source evidence exactly.

Keep every user-supplied URL as a link even when a canonical URL is recorded as metadata; the link order is set under **Links** below. Leave uncertain fields empty and ask a targeted question rather than inferring them.

## Price references

Always research reference prices, even when the source page shows one. Search by EAN/GTIN or exact brand + model + edition/platform, and accept only exact matches: a different edition, platform, size, colour, language, or a used/unpacked offer is a different product.

| Gift kind | References to try |
| --- | --- |
| Physical goods sold in Czechia (default) | **Heureka.cz** and **Alza.cz**, always both |
| PC games | **Steam** (`store.steampowered.com/api/appdetails?appids=<id>&cc=cz&l=czech`), plus Heureka |
| Console games | Heureka and Alza for boxed editions; the platform store for digital |
| Other categories (books, board games, LEGO, …) | Heureka and Alza, plus the category's authoritative store or database |
| Products not sold in Czechia | The manufacturer's store or the main retailer of its home market |

Also record a foreign reference (manufacturer store, Steam, or a major foreign retailer) whenever the product is sold internationally. When the gift has several plausible formats (boxed vs. digital key, Czech vs. English edition, platform), ask which the user prefers instead of choosing.

- **Price fields:** use the lowest–highest **new, in-stock** exact-match Heureka offer range in CZK, widened to include the Alza price; a single value when they agree. Without a Czech reference, use the category reference: for Steam, `price` is the current final price and `priceMax` the regular price when on sale. Keep the currency shown (`CZK`, `EUR`, or `USD`) and never convert; other currencies are reported only.
- **Links:** add each exact-match reference page with a short label (`Heureka`, `Alza`, `Steam`, or an edition qualifier such as `Heureka – PS5`), skip duplicates and respect the link limit. `links[0]` is the gift's primary link, so it must be a page where the gift can be bought: the exact-match Heureka page first, then shops (Alza, the source shop, Steam), then pages that sell nothing (BoardGameGeek, reviews, manufacturer info) last. When no Czech reference exists, a shop selling the product comes first.

### Bot-protected sites

Heureka and Alza sit behind Cloudflare; do not use WebFetch for them. Batch every Heureka/Alza search and product URL for the round into one run:

```bash
node scripts/gift-research-browser.mjs "<url>" ... --out <scratch>/round-1.json
```

Search URLs: `https://www.heureka.cz/?h%5Bfraze%5D=<query>` and `https://www.alza.cz/search.htm?exps=<query>`. The script opens a visible Chrome window; most challenges clear on their own. Before running it, tell the user a Chrome window will open and they may need to complete a verification there; the script waits for them and continues on its own. Pick product pages from the search results' `links`, then read them in a second run. Prices often appear only in `text`, not in JSON-LD: Heureka lists shop offers under `Doporučené nabídky` and `Nejlevnější nabídky`; Alza shows the regular new price next to `Nový`, while `Rozbalený` and `S kódem` (discount-code) prices are not the reference price. Report a page that stays blocked as unresolved instead of falling back to guesses.

## Evidence

Keep a research record per gift in the scratch directory: for each field, the extraction method (`json-ld`, `opengraph`, `page-metadata`, `exact-search`) and the evidence, such as `exact-search: Heureka new offers 1108–1571 CZK, Alza 1369 CZK`; the selected image's HTTPS URL and method. If several products or images plausibly match, do not choose one silently: list every unresolved decision with the affected gift, field, and evidence-backed reason. **Any open ambiguity is a HITL stop**: submit nothing until the user resolves it.

Gift fields follow the `createGift` and `updateGift` inputs in the API reference (`GET /api/v1/openapi.json`):

- Every new gift has at least one link, ordered as in **Links** above, and includes every URL the user supplied for that gift.
- `categoryIds` is optional: up to five of the wishlist's existing categories, the primary first, each matched by `customLabel` or by the preset (`presetKey`) the user or the evidence names. Unknown categories are HITL; never create one.
- `priorityLevelId` and `quantity` only when the user gave them.
- Images: compare the source's OpenGraph image with the Product JSON-LD `image` entries of the exact-match Heureka and Alza pages (the first entry is the main packshot), view the candidates, and pick the sharpest clean product or box shot of the exact edition, preferring the highest resolution; a small `og:image` is usually a thumbnail. Store the selected image with `prejemesi images add --wishlist <shortId> --url <image URL> --idempotency-key <key>` or `uploadImage`, then set `"imageReference": "<reference>"` on the gift. Report a refused image (`AGENT_IMAGE_*`) and propose the gift without it.
- Image framing: after viewing the stored image, always set `imageMeta` beside its `imageReference`, as in `"imageMeta": { "fitMode": "contain-padded", "bgColor": "#ffffff" }`.
    - `fitMode`: `contain-padded` (Fit, whole image visible) for product and box shots whose edges must stay visible, such as a board game, LEGO or book box, or an isolated product on a plain background; `cover-crop` (Fill) only for full-bleed photos such as scenes or textures, where cropping the edges loses nothing.
    - `bgColor` matches the image's background where the frame letterboxes it: `"#ffffff"` for white or near-white, `"#000000"` for black, otherwise `null` (the transparent, dotted mat).
    - An `updateGift` row with `imageMeta` and no `imageReference` reframes the gift's current image.

## Proposing changes

Every change is a proposal: nothing changes until the user applies it on its review page, unless their token has fast-forward. Send each batch with an **`Idempotency-Key`** made from the batch's purpose and content (for example `add-gifts-<shortId>-<date>-<n>`), and resend the identical body with the same key when a call fails or times out; a changed body needs a new key (`AGENT_IDEMPOTENCY_KEY_REUSED`).

- **New gifts:** one proposal per wishlist: `prejemesi gifts create --wishlist <shortId> --input @<scratch>/gifts.json --idempotency-key <key>` with an array of gift inputs, or `submitChangeProposal` with `createGift` rows and `idempotencyKey`. Skip a product whose source URL is already a link of a gift on the wishlist and report it as a duplicate.
- **Updating existing gifts:** take the gift id from the gift list; when names are similar, ask which gift is meant. Add review data and other research with `appendGiftDescription` (`{ "giftId", "text" }`), which on a shared wishlist adds a dated addition and keeps the original description for gifters. Change prices, links or the image with `updateGift` (`{ "id", … }`); `links` replaces the whole list, so send the existing links followed by the new ones. Several updates go in one proposal: `prejemesi proposals submit --input @<scratch>/proposal.json --idempotency-key <key>` with `{ "wishlistShortId", "operations": [{ "operation", "input" }] }`, or `submitChangeProposal`. A single update can use `prejemesi gifts update <giftId> --wishlist <shortId> --input '<json>'`.
- Delete or reorder gifts only when the user asked; deletions always wait for confirmation on the review page.

After submitting, check every row's status: `ready`; `rejected` with its `error`; `needsConfirmation`; `conflict`. Give the user the **review link** (`reviewLink` from the CLI, the absolute link in the MCP result) for every pending proposal. Status `applied` means a fast-forward token applied it at once. Never use `proposals apply` to skip a review; it only retries a fast-forward apply. On `AGENT_RATE_LIMITED`, wait `retryAfterSeconds` and resend with the same key; on a daily budget code, stop and report.

## Report

For each wishlist: its title, each proposal's id, status and review link, and per row the gift, whether it is created or updated, and its status or error. Report skipped duplicates, omitted metadata, and image provenance and framing. Include a per-gift price table with each reference's price, currency, and availability, and list references that were blocked or had no exact match. Never expose access tokens, cookies, or other credentials.
