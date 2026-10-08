---
name: add-gifts
description:
    'Gather reviewed product metadata and reference prices (Heureka, Alza, category stores such as
    Steam) into a gift ingestion manifest and safely dry-run or explicitly apply it to an
    allowlisted production wishlist.'
argument-hint: '<product URLs...> [wishlist URL or alias]'
allowed-tools:
    Read, Write, WebFetch, WebSearch, Bash(pnpm ingest:gifts *), Bash(pnpm.cmd ingest:gifts *),
    Bash(node scripts/gift-research-browser.mjs *)
metadata:
    version: '1.1'
    category: operations
---

# Add gifts

Accept one or more product URLs and an optional wishlist alias. This workflow is evidence-only:
**Never guess** a product identity, brand, model, price, currency, image, or wishlist target.

## Extraction order

For every supplied URL, use this order:

1. Fetch the page and inspect product JSON-LD.
2. Inspect OpenGraph fields, the canonical URL, and ordinary page metadata.
3. Only when direct extraction is incomplete, perform an **exact brand/model** web search. Accept a
   search result only when its identity is unambiguous and matches the source evidence exactly.

Preserve the user-supplied source URL as the primary link even when a canonical URL is recorded as
metadata. Never replace it with a searched retailer URL. Leave uncertain fields empty and ask a
targeted question rather than inferring them.

## Price references

Always research reference prices, even when the source page shows one. Search by EAN/GTIN or exact
brand + model + edition/platform, and accept only exact matches: a different edition, platform,
size, colour, language, or a used/unpacked offer is a different product.

| Gift kind                                      | References to try                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Physical goods sold in Czechia (default)       | **Heureka.cz** and **Alza.cz**, always both                                                 |
| PC games                                       | **Steam** (`store.steampowered.com/api/appdetails?appids=<id>&cc=cz&l=czech`), plus Heureka |
| Console games                                  | Heureka and Alza for boxed editions; the platform store for digital                         |
| Other categories (books, board games, LEGO, …) | Heureka and Alza, plus the category's authoritative store or database                       |
| Products not sold in Czechia                   | The manufacturer's store or the main retailer of its home market                            |

Also record a foreign reference (manufacturer store, Steam, or a major foreign retailer) whenever
the product is sold internationally. When the gift has several plausible formats (boxed vs. digital
key, Czech vs. English edition, platform), ask which the user prefers instead of choosing.

- **Price fields:** use the lowest–highest **new, in-stock** exact-match Heureka offer range in CZK,
  widened to include the Alza price; a single value when they agree. Without a Czech reference, use
  the category reference: for Steam, `price` is the current final price and `priceMax` the regular
  price when on sale. Keep the currency shown (`CZK`, `EUR`, or `USD`) and never convert; other
  currencies are reported only.
- **Links:** after the source link, add each exact-match reference page with a short label
  (`Heureka`, `Alza`, `Steam`, or an edition qualifier such as `Heureka – PS5`). Skip duplicates of
  the source and respect the link limit.
- **Provenance:** give `price`, `priceMax`, and `currency` their own `provenance.fields` entries
  naming the references and figures used, for example
  `exact-search: Heureka new offers 1108–1571 CZK, Alza 1369 CZK`. Entries are limited to 100
  characters.

### Bot-protected sites

Heureka and Alza sit behind Cloudflare; do not use WebFetch for them. Batch every Heureka/Alza
search and product URL for the round into one run:

```bash
node scripts/gift-research-browser.mjs "<url>" ... --out <scratch>/round-1.json
```

Search URLs: `https://www.heureka.cz/?h%5Bfraze%5D=<query>` and
`https://www.alza.cz/search.htm?exps=<query>`. The script opens a visible Chrome window; most
challenges clear on their own. Before running it, tell the user a Chrome window will open and they
may need to complete a verification there; the script waits for them and continues on its own. Pick
product pages from the search results' `links`, then read them in a second run. Prices often appear
only in `text`, not in JSON-LD: Heureka lists shop offers under `Doporučené nabídky` and
`Nejlevnější nabídky`; Alza shows the regular new price next to `Nový`, while `Rozbalený` and
`S kódem` (discount-code) prices are not the reference price. Report a page that stays blocked as
unresolved instead of falling back to guesses.

## Provenance and manifest

For each field, record the extraction method in `provenance.fields`. Record selected image
provenance in `provenance.imageSource` with its HTTPS URL and method (`json-ld`, `opengraph`,
`page-metadata`, or `exact-search`). If several images or products plausibly match, do not choose
one silently. Write every unresolved decision explicitly into the manifest's top-level `ambiguities`
array with the affected item (when known), field, and evidence-backed reason.

Write a schema-version-1 JSON manifest with a stable manifest ID, unique stable item IDs, exact
expected wishlist short ID/title/recipient, explicit quantity and priority, original source URL,
gathered timestamp, gift fields, and provenance. `gift.category` is optional and must be
evidence-backed or explicitly provided by the user; it must already be enabled on the target
wishlist and match an enabled custom label or either Czech/English label of an enabled preset.
Unknown or disabled category values are HITL, never guessed, and never silently create custom
categories. Every gift must have at least one link, and `gift.links[0].url` must exactly equal
`sourceUrl`; every other URL the user supplied for that gift follows it, before reference links. Do
not add update or delete instructions.

Take the short ID from a `/w/<shortId>` wishlist URL and its exact title and recipient from the
public page; ask when they cannot be read.

## Safety gate

Always run the fixed CLI in dry-run mode first:

```bash
pnpm ingest:gifts --manifest <manifest-path> --base-url <explicit-production-url>
```

The skill **never reads or prints** the ingestion token. Do not open the credential file, inspect
process credentials, echo environment values, or pass a token argument. Credential loading belongs
exclusively to `scripts/ingest-gifts.ts`.

Apply only when all of these are true:

- the user made an **explicit production** insertion request;
- the wishlist is allowlisted, its exact identity matches, and any supplied wishlist alias resolves
  without ambiguity;
- every product and selected image is unambiguous;
- dry-run reports no conflict, target mismatch, or ambiguity.

Production accepts only wishlists listed in the `GIFT_INGESTION_TARGET_SHORT_IDS` Worker variable. A
dry-run `target_not_allowed` error means the wishlist is not authorized: stop and ask the user
whether to authorize it. Only the user authorizes a wishlist; the skill never changes the allowlist
on its own. The allowlist is a GitHub `production` environment variable applied by a gated redeploy
(`docs/PRODUCTION_GIFT_INGESTION.md`). Rerun the dry-run once the authorized redeploy is live.

A nonempty dry-run `ambiguities` list is a mandatory HITL stop: do not download, prepare, upload, or
apply images or gifts until the user resolves every entry. Then invoke the same CLI with `--apply`
and the explicit production base URL. Otherwise stop for targeted HITL: identify the exact
item/field/image/target decision needed and present only the evidence-backed choices.

## Report

Report created gift IDs, skipped duplicates, conflicts, omitted metadata, and image provenance.
Include a per-gift price table with each reference's price, currency, and availability, and list
references that were blocked or had no exact match. Report preparation/download/upload/apply
failures by item and stage. Never expose signed PUT URLs, bearer tokens, R2 credentials, database
credentials, or cookies.
