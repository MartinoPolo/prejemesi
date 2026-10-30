# Next release: dev → production

Steps the next release needs on top of the standard runbook in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#production-release-checklist). Reset this file after the release.

## Open from the agent-access release

Production settings that release left to the owner; none blocks a deploy.

1. **Automatic deploys**: remove the one-off manual reviewer from the `production` environment (from a checkout of `production`):

    ```bash
    gh api -X PUT repos/MartinoPolo/prejemesi/environments/production --input .github/production-environment.json
    ```

2. **AI assistant** (see [docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md)): secret `ANTHROPIC_API_KEY` (`pnpm exec wrangler secret put ANTHROPIC_API_KEY`) and variable `CHAT_ALLOWED_EMAILS`; the assistant stays hidden while the variable is empty.
3. **Retired gift ingestion**: delete secrets `GIFT_INGESTION_TOKEN`, `GIFT_INGESTION_ACTOR_ID` (`pnpm exec wrangler secret delete <name>`) and variable `GIFT_INGESTION_TARGET_SHORT_IDS` in the dashboard.
4. **Link previews**: re-scrape `https://prejemesi.cz/`, `/en` and already shared wishlist links in the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/); details in [docs/SHARING_PREVIEWS.md](docs/SHARING_PREVIEWS.md).

## Contract migrations

Ship once no older app version serves traffic:

1. Drop the `gift_category_ids_legacy_mirror` trigger and function, `gift.category_id` and `gift_wishlist_category_fk` (#529); remove the deprecated category settings save fields and the `readGiftCategorySettingsRows` agent operation (#534).
2. Drop the `gift_ingestion_*` tables of the retired gift ingestion.
