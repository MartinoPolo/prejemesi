# prejemesi

Command-line client for [Přejeme si](https://prejemesi.cz) wishlists. It reads your wishlists and gifts and proposes gift changes with your personal access token, so you and your AI agents can script them. Every change becomes a proposal you review on its page before it applies, unless the token has fast-forward.

## Setup

Create an access token in Settings on prejemesi.cz, then:

```bash
npx prejemesi login
```

Paste the token at the hidden prompt, or pipe it in (`prejemesi login < token.txt`). The CLI checks it with the server and stores it in your user config: `%APPDATA%\prejemesi\config.json` on Windows, `~/.config/prejemesi/config.json` elsewhere. It never prints the token. `prejemesi logout` forgets it. For CI or agents, `PREJEMESI_TOKEN` and `PREJEMESI_URL` override the stored login.

## Commands

```bash
prejemesi whoami
prejemesi wishlists
prejemesi read readGiftCategories --input '{"wishlistId":"…"}'
prejemesi gifts list --wishlist <shortId>
prejemesi gifts create --wishlist <shortId> --name "Kolo"
prejemesi gifts create --wishlist <shortId> --input @gifts.json --idempotency-key add-2026-10-18
prejemesi gifts update <giftId> --wishlist <shortId> --input '{"description":"…"}'
prejemesi gifts delete <giftId> --wishlist <shortId>
prejemesi gifts reorder <giftId> <giftId>... --wishlist <shortId>
prejemesi images add --wishlist <shortId> --url https://shop.example/kolo.webp
prejemesi proposals submit --input @proposal.json
prejemesi proposals show <proposalId>
prejemesi proposals apply <proposalId>
```

- `--wishlist` takes the short id from the wishlist's link, or its id.
- `--input` takes JSON, `@file` or `-` for standard input. Its fields are the operation inputs documented in the [API reference](https://prejemesi.cz/api/v1/openapi.json). `gifts create` takes an array to propose several gifts in one proposal.
- `read` runs any agent read operation listed in the API reference.
- `images add` has the server store a copy of an image and prints its `reference`; a gift's `--input` attaches it with `"imageReference": "<reference>"`.
- `--idempotency-key` makes a retried change or image safe: the same key and input return the first result.
- `proposals apply` applies a waiting proposal only for the fast-forward token that submitted it; otherwise it fails with the `reviewLink` where you review it.

Output is JSON. Results go to standard output; failures go to standard error as the API's `{ "error": … }` body. Exit codes: `0` success, `1` request failure, `2` usage error. Proposal results carry a `reviewLink` to the review page.
