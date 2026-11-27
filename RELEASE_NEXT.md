# Next release: dev → production

Steps the next release needs on top of the standard runbook in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#production-release-checklist). Reset this file after the release.

## Secrets

- Set the production Worker secret `BROWSER_RENDERING_API_TOKEN` (`docs/CLOUDFLARE_SETUP.md` §E), before or after the deploy: the assistant's `browse_page` tool stays hidden until it is set.

## After deploy

1. Link the owner's existing family-list gift copies once with `scripts/link-existing-gift-copies.ts` (usage in its header), after the #742 migration is in production: run `propose --prod --owner <owner email> --out <plan outside the repository>`, have the agent review the plan and confirm each pair's matches, run `apply --prod --plan <plan>` as the dry run, then `apply --prod --plan <plan> --execute`, and record the outcome (linked, skipped, reported double reservations) on #742.

## Contract migrations

Ship once no older app version serves traffic:

1. Drop the `gift_category_ids_legacy_mirror` trigger and function, `gift.category_id` and `gift_wishlist_category_fk` (#529); remove the deprecated category settings save fields and the `readGiftCategorySettingsRows` agent operation (#534).
2. Drop the `gift_ingestion_*` tables of the retired gift ingestion.
3. Drop the `gift_image_cover_mirror` trigger and function (#591), after every app write of the `gift.image_*` cover columns also writes `gift_image` (demo provisioning in `src/lib/server/demo/provision.ts` still relies on the trigger).
