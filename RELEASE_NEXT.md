# Next release: dev → production

Steps this release needs on top of the standard runbook in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#production-release-checklist). It covers everything merged to `dev` since the last production release: agent access (tokens, JSON API, MCP, OAuth connectors, CLI), the in-app AI assistant, permanent wishlists and the UI fixes. Reset this file after the release.

## 1. Before the release (any time, harmless early)

1. **AI assistant settings** (Workers → `prejemesi` → Settings → Variables and Secrets; see [docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md)):
    - Secret `ANTHROPIC_API_KEY`: `pnpm exec wrangler secret put ANTHROPIC_API_KEY`. Without it, allowlisted users' turns fail with 503.
    - Variable `CHAT_ALLOWED_EMAILS`: comma-separated family emails. Empty hides the assistant from everyone, so leave it empty until model access is decided.
    - Optional: `CHAT_MODEL` (default `claude-sonnet-5-5`), `CHAT_DISABLED=true` as the kill switch.
2. **WAF rate-limit rule** `Protect dynamic Worker traffic` (Security → WAF → Rate limiting rules): replace its expression with the one in [docs/PRODUCTION_OPERATIONS.md](docs/PRODUCTION_OPERATIONS.md#one-free-rate-limit-rule), which excludes `/api/v1/` and `/api/auth/oauth2/`. Otherwise agents and Claude/ChatGPT connectors get challenged and fail.

## 2. Release PR

1. Open the PR `dev` → `production`, run `update-branch`, wait for green checks, merge with a merge commit (not squash).

## 3. Database (from a clean checkout at the exact production SHA)

1. `pnpm db:verify:prod`. Expect **PENDING** with `0022`–`0029`; anything else (or DRIFT) stops the release.
2. Review the listed SQL. All eight are additive expand migrations (none is in `drizzle/contract-migrations.json`), so the running app keeps working against them. Order matters for the new app: `0025` backfills `first_shared_at`, `0028` holds the OAuth tables that better-auth validates at runtime (sign-in breaks without it), `0029` holds the chat tables.
3. `pnpm db:migrate:prod -- --yes`, then `pnpm db:verify:prod` again and record **EXACT**.

## 4. Deploy

1. Approve the `production` environment gate for the exact SHA.
2. `pnpm exec wrangler versions view <id>`: the new binding `AGENT_API_RATE_LIMIT` (120 per 60 s) is present; the old `GIFT_INGESTION_RATE_LIMIT` is gone. Without the binding the agent API answers 503.
3. `pnpm exec wrangler tail` shows no errors while you smoke test.

Rollback is app-only (`wrangler rollback`): every migration in this release is additive.

## 5. Smoke test

1. https://prejemesi.cz loads; password and Google sign-in work; open a wishlist and reserve/unreserve a test gift.
2. Settings → access tokens: create a short-lived token, then `curl -H "Authorization: Bearer pjs_…" https://prejemesi.cz/api/v1/me`. Revoke it afterwards.
3. OAuth discovery answers: `https://prejemesi.cz/.well-known/oauth-protected-resource/mcp`. Add `https://prejemesi.cz/mcp` as a custom connector in Claude or ChatGPT, sign in, consent, list wishlists, propose a change and review it on its page.
4. Permanent wishlists: create one, share it, check the recipient warning on the first gift change.
5. If the assistant is enabled: open the panel as an allowlisted user, run one turn, apply a proposal.
6. Image upload of a large phone photo succeeds; gift images look sharp (Cloudflare image transformations are production-only).

## 6. After the release

1. **Link previews**: re-scrape `https://prejemesi.cz/`, `/en` and already shared wishlist links in the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/); details in [docs/SHARING_PREVIEWS.md](docs/SHARING_PREVIEWS.md).
2. **Retired gift ingestion**: delete secrets `GIFT_INGESTION_TOKEN`, `GIFT_INGESTION_ACTOR_ID` and variable `GIFT_INGESTION_TARGET_SHORT_IDS` (`pnpm exec wrangler secret delete <name>`; the variable in the dashboard). Dropping the `gift_ingestion_*` tables is a later contract migration, not part of this release.
3. **Publish the CLI** (needs the production API live): `npm login`, then `pnpm --filter prejemesi publish --access public`. Bump `packages/cli/package.json` first for every later publish.
4. Watch **Security → Events** for challenges on `/api/` and `/mcp` during the first days.
