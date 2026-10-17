# Agent API

The versioned JSON API at `/api/v1` lets a user's own agent act as that user. The complete, current reference is the public OpenAPI 3.1 document at `GET /api/v1/openapi.json`, generated from the operation registry and agent policies (`src/lib/server/agent_access/`); it lists every agent operation with its input schema, scope and confirmation rule.

## Authentication

Send a personal access token as `Authorization: Bearer pjs_…`. Cookies never authenticate the API.

- The account owner creates, rolls and revokes tokens in Settings. The value is shown once; only its SHA-256 hash is stored.
- Expiry: 30, 90, 365 (default), 1825 or 3650 days, or a custom date at most 10 years ahead. No token is non-expiring.
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
- `GET /api/v1/openapi.json` returns the reference document without authentication.

## Errors

Every failure answers `{ "error": { "code": "…", "message": "…", …details } }`.

| Status | Codes |
| --- | --- |
| 400 | `AGENT_REQUEST_INVALID`, `INVALID_OPERATION_INPUT`, `AGENT_BATCH_TOO_LARGE` (with `maxItems`) |
| 401 | `AGENT_TOKEN_INVALID`, `AGENT_TOKEN_EXPIRED`, `AGENT_TOKEN_REVOKED` |
| 403 | `AGENT_SCOPE_MISSING`, `AGENT_WISHLIST_NOT_ALLOWED`, `AGENT_DEMO_NOT_ALLOWED` |
| 404 | `AGENT_OPERATION_NOT_FOUND` (unknown and human-only operations alike), `WISHLIST_NOT_FOUND` |
| 409 | `AGENT_MUTATION_REQUIRES_PROPOSAL`, `AGENT_AUTHORIZATION_OUTDATED` |
| 413 | `AGENT_REQUEST_TOO_LARGE` (with `maxBytes`) |
| 415 | `AGENT_UNSUPPORTED_MEDIA_TYPE`: bodies must be `application/json` |
| 429 | `AGENT_RATE_LIMITED`, with a `Retry-After` header and `retryAfterSeconds` |
| 503 | `AGENT_RATE_LIMIT_UNAVAILABLE` |
| 5xx | `AGENT_INTERNAL_ERROR`, without internals |

A client error without a specific code answers a generic one such as `NOT_FOUND` or `CONFLICT`, with its message.

## Limits

All limits live in `src/lib/server/agent_access/limits.ts`; the OpenAPI document states their current values.

- Requests per token are counted by the `AGENT_API_RATE_LIMIT` Workers rate-limit binding, whose `wrangler.jsonc` configuration a unit test keeps equal to the constants. Without the binding, production fails closed with 503; the Vite dev server allows requests.
- A batch is capped at the operation core's own step limit; request bodies have a size cap.
