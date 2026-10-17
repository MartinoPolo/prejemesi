# Agent API

The versioned JSON API at `/api/v1` lets a user's own agent act as that user. The complete, current reference is the public OpenAPI 3.1 document at `GET /api/v1/openapi.json`, generated from the operation registry and agent policies (`src/lib/server/agent_access/`); it lists every agent operation with its input schema, scope and confirmation rule.

## Authentication

Send a personal access token as `Authorization: Bearer pjs_…`. Cookies never authenticate the API.

- The account owner creates, rolls and revokes tokens in Settings. The value is shown once; only its SHA-256 hash is stored.
- Expiry: 30, 90, 365 (default), 1825 or 3650 days. No token is non-expiring.
- Rolling issues a new value for the same token (name, scopes, wishlist restriction and fast-forward kept). The old value fails at once with `AGENT_TOKEN_INVALID`. The new expiry is chosen like at creation; it defaults to the token's current lifetime counted from the roll. Revoked tokens cannot be rolled.
- Deleting the account deletes its tokens. Demo sessions cannot create tokens or call the API.

## Scopes and rights

| Scope | Allows |
| --- | --- |
| `read` | Reads; always granted |
| `gifts:write` | Gift, category, priority-level and wishlist-detail changes, imports and undo |
| `reservations:write` | Reserving, cancelling own reservations and marking them purchased, where the user may |
| `managers:invite` | Inviting správci |
| `reservations:identities` | Reserver names in reads; anonymous gifters' emails are never returned |

Every call acts with the user's current role: losing a role takes effect on the next call. A token may be limited to chosen wishlists. Recipients' reads never contain reservation or like data.

## Endpoints

- `GET /api/v1/me` returns the token user and the token (name, prefix, scopes, wishlist restriction, expiry, fast-forward).
- `GET /api/v1/wishlists` returns the wishlists the token reaches, with the user's role and the wishlist kind.
- `POST /api/v1/operations/{operationName}` runs an agent read; the JSON body is the operation input and the answer is `{ "result": … }`. Change operations answer 409 `AGENT_MUTATION_REQUIRES_PROPOSAL`, because changes are submitted as proposals the user reviews.
- `POST /api/v1/proposals` submits changes as a proposal and answers 201 `{ "proposal": … }`; `GET /api/v1/proposals/{proposalId}` reads one with its current status.
- `POST /api/v1/images` stores an image from a URL for a gift and answers 201 `{ "image": … }` with its `reference`.
- `GET /api/v1/openapi.json` returns the reference document without authentication.

## Change proposals

The body is `{ "wishlistShortId" | "wishlistId", "operations": [{ "operation", "input" }] }`, where each row is a change operation with the input `POST /operations/{operation}` would take. Rows are numbered `r1`, `r2`, … in order.

- Every row is authorized with the token, must change the named wishlist (400 `AGENT_PROPOSAL_WISHLIST_MISMATCH` with `rowId`) and is dry-run in order, so later rows see earlier ones. Rows cannot refer to ids an earlier row creates; preview results carry placeholder ids.
- A row is `ready`, `rejected` (with the core's `error`), `needsConfirmation` (gift deletions, reservations, manager invitations, copying that removes sources) or, once a gift it depends on changes, `conflict`. Its conflict baseline is the gifts it names plus the existing gifts its dry run changed, as they were at submission; ordering is ignored and a gift that is gone conflicts.
- The submitter reviews the proposal at `reviewUrl` (`/w/<shortId>/changes/<id>`) until `expiresAt`, selects rows and applies them in one transaction; unselected rows are discarded and a proposal applies once. Nobody else can see it, and the submitter only while they can read the wishlist (404 otherwise). A revoked token's pending proposals stay applicable. Expired and discarded proposals stay readable for a grace period, applied ones while undo is possible.
- With fast-forward, a proposal whose rows are all `ready` applies at once (status `applied`); otherwise, or when that apply fails, it waits for review.
- Wishlist creation (`createWishlist`, `createWishlistFromImport`) needs an unrestricted fast-forward token and a proposal naming no wishlist, which applies at once or is discarded; otherwise 400 `AGENT_WISHLIST_CREATION_REQUIRES_FAST_FORWARD`.
- Undo, from the review page, reverts the whole applied batch. It refuses with 409 `AGENT_PROPOSAL_UNDO_UNSUPPORTED` when the batch reordered gifts, changed categories, priority levels or wishlist details, cancelled or marked a reservation purchased, created a wishlist, or sent an invitation that was since accepted; a gift changed since apply blocks it too.
- An optional `Idempotency-Key` header (1–255 printable ASCII characters, kept per token for a limited time) makes retries safe: the same key and body replay the stored 201 with `Idempotent-Replayed: true`; the same key with another body answers 422 `AGENT_IDEMPOTENCY_KEY_REUSED`, and 409 `AGENT_IDEMPOTENCY_IN_PROGRESS` while the first request runs. Failures free the key.

## Gift images

Agents set a gift image by URL in two steps; gifts never keep an external URL. Image URLs or storage keys in an input, and an `imageReference` on an operation that takes none, answer 400 `AGENT_IMAGE_INPUT_UNSUPPORTED`.

- `POST /api/v1/images` with `{ "wishlistShortId" | "wishlistId", "url" }` needs `gifts:write` and a wishlist the user manages and the token reaches. The server downloads the image and stores a copy, answering `reference`, the copy's `url`, `contentType`, `byteLength`, `width`, `height` and `expiresAt`. It takes the optional `Idempotency-Key` header; a replay returns the same reference without downloading again.
- The URL and every redirect (a capped number) must be HTTPS on the default port to a public host name; IP addresses and local names are refused. The image must be JPEG, PNG, WebP or GIF, its bytes must match the declared type, and it must fit the gift image size cap with positive dimensions within a maximum side and pixel count. A storage failure answers 503 `AGENT_IMAGE_STORAGE_UNAVAILABLE`.
- A `createGift` or `updateGift` row sets `"imageReference": "<reference>"`; the gift gets the stored copy with automatic framing unless the row gives `imageMeta`. A reference is valid only for its user and wishlist, attaches to one gift once, and must be attached by an applied change before `expiresAt`; it is checked at submission and again at apply. Undo restores a previous image link or no image; an uploaded image the change replaced was deleted, so the gift then keeps the new one.
- Unattached images are deleted after expiry. Wishlist covers and import drafts take no image references.

## Errors

Every failure answers `{ "error": { "code": "…", "message": "…", …details } }`.

| Status | Codes |
| --- | --- |
| 400 | `AGENT_REQUEST_INVALID`, `INVALID_OPERATION_INPUT`, `AGENT_BATCH_TOO_LARGE` (with `maxItems`), `AGENT_PROPOSAL_INVALID`, `AGENT_PROPOSAL_NOT_A_CHANGE`, `AGENT_PROPOSAL_WISHLIST_MISMATCH`, `AGENT_WISHLIST_CREATION_REQUIRES_FAST_FORWARD`, `AGENT_IDEMPOTENCY_KEY_INVALID` (with `maxLength`), `AGENT_IMAGE_INPUT_UNSUPPORTED`, `AGENT_IMAGE_REQUEST_INVALID`, `AGENT_IMAGE_URL_INVALID`, `AGENT_IMAGE_HOST_BLOCKED`, `AGENT_IMAGE_REFERENCE_INVALID` (unknown, another user's or wishlist's, or repeated in one proposal) |
| 401 | `AGENT_TOKEN_INVALID`, `AGENT_TOKEN_EXPIRED`, `AGENT_TOKEN_REVOKED` |
| 403 | `AGENT_SCOPE_MISSING`, `AGENT_WISHLIST_NOT_ALLOWED`, `AGENT_DEMO_NOT_ALLOWED` |
| 404 | `AGENT_OPERATION_NOT_FOUND` (unknown and human-only operations alike), `WISHLIST_NOT_FOUND`, `AGENT_PROPOSAL_NOT_FOUND` (also for other users' proposals) |
| 409 | `AGENT_MUTATION_REQUIRES_PROPOSAL`, `AGENT_AUTHORIZATION_OUTDATED`, `AGENT_IDEMPOTENCY_IN_PROGRESS`, `AGENT_IMAGE_REFERENCE_USED` |
| 410 | `AGENT_IMAGE_REFERENCE_EXPIRED` |
| 413 | `AGENT_REQUEST_TOO_LARGE` (with `maxBytes`) |
| 415 | `AGENT_UNSUPPORTED_MEDIA_TYPE`: bodies must be `application/json` |
| 422 | `AGENT_IDEMPOTENCY_KEY_REUSED`, `AGENT_IMAGE_TOO_LARGE` (with `maxBytes`), `AGENT_IMAGE_UNSUPPORTED_TYPE`, `AGENT_IMAGE_SIGNATURE_MISMATCH`, `AGENT_IMAGE_DIMENSIONS_INVALID` |
| 429 | `AGENT_RATE_LIMITED`, with a `Retry-After` header and `retryAfterSeconds`; `AGENT_DAILY_CHANGE_BUDGET_EXCEEDED`, also with `budgetRows` and `windowSeconds`; `AGENT_DAILY_IMAGE_BUDGET_EXCEEDED`, also with `budgetImages` and `windowSeconds` |
| 502 | `AGENT_IMAGE_FETCH_FAILED`: the image host failed, timed out, answered an error or redirected too often |
| 503 | `AGENT_RATE_LIMIT_UNAVAILABLE`, `AGENT_IMAGE_STORAGE_UNAVAILABLE` |
| 5xx | `AGENT_INTERNAL_ERROR`, without internals |

A client error without a specific code answers a generic one such as `NOT_FOUND` or `CONFLICT`, with its message.

## Limits

All limits live in `src/lib/server/agent_access/limits.ts`; the OpenAPI document states their current values.

- Requests per token are counted by the `AGENT_API_RATE_LIMIT` Workers rate-limit binding, whose `wrangler.jsonc` configuration a unit test keeps equal to the constants. Without the binding, production fails closed with 503; the Vite dev server allows requests.
- A batch is capped at the operation core's own step limit; request bodies have a size cap.
- The daily change budget bounds the proposal rows one user submits over a trailing window across all tokens, counting every row whatever its outcome.
- The daily image budget bounds the images one user stores by URL over a trailing window across all tokens, attached or not. Each download hop has a timeout.
