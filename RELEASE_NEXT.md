# Next release: dev → production

Steps the next release needs on top of the standard runbook in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#production-release-checklist). Reset this file after the release.

## Manual steps

1. Set the `CHAT_RUNNER_SECRET` (a long random value, e.g. `openssl rand -base64 32`) and `CHAT_RUNNER_EMAILS` Worker secrets in production and staging, e.g. `wrangler secret put CHAT_RUNNER_SECRET`, adding `--env staging` for staging. Until they are set, the chat runner endpoints answer 404 and every user keeps the provider assistant.

## Contract migrations

Ship once no older app version serves traffic:

1. Drop the `gift_category_ids_legacy_mirror` trigger and function, `gift.category_id` and `gift_wishlist_category_fk` (#529); remove the deprecated category settings save fields and the `readGiftCategorySettingsRows` agent operation (#534).
2. Drop the `gift_ingestion_*` tables of the retired gift ingestion.
3. Drop the `gift_image_cover_mirror` trigger and function (#591), after every app write of the `gift.image_*` cover columns also writes `gift_image` (demo provisioning in `src/lib/server/demo/provision.ts` still relies on the trigger).
