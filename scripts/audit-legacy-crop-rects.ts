/**
 * Read-only audit for issue #123: finds `imageMeta`/`imageSlots` rows (gifts +
 * wishlist slots, base-level AND per-target/per-slot) that carry a legacy
 * `focal`/`zoom` pair but no `cropRect`. Opening the crop editor for such a row
 * used to seed the crop rectangle from `FULL_CROP_RECT` (the always-centered
 * identity rect) instead of the real persisted focal point, silently
 * discarding the framing the moment the row was next edited and saved (fixed
 * in `seedCropRectFromLegacyMeta`, `src/lib/modules/images/crop.ts`). This
 * script does NOT write anything — it only reports counts + row ids so a
 * backfill/accept decision can be made deliberately.
 *
 * Usage:
 *   pnpm tsx scripts/audit-legacy-crop-rects.ts            # local DB (.env)
 *   pnpm tsx scripts/audit-legacy-crop-rects.ts --prod      # prod DB (.env.production)
 *   pnpm tsx scripts/audit-legacy-crop-rects.ts --verbose   # also list affected row ids
 */

import { readFileSync, existsSync } from 'node:fs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { isNull, isNotNull, and, sql } from 'drizzle-orm';
import { gift } from '../src/lib/server/db/gift.schema.js';
import { wishlist } from '../src/lib/server/db/wishlist.schema.js';
import {
	GIFT_CROP_TARGET_VALUES,
	WISHLIST_IMAGE_SLOTS,
	type GiftCropTarget,
} from '../src/lib/modules/images/types.js';

const args = process.argv.slice(2);
const useProd = args.includes('--prod');
const verbose = args.includes('--verbose');

function loadEnvFile(path: string): Record<string, string> {
	if (!existsSync(path)) {
		return {};
	}
	const vars: Record<string, string> = {};
	for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}
		const eq = trimmed.indexOf('=');
		if (eq === -1) {
			continue;
		}
		const key = trimmed.slice(0, eq).trim();
		const value = trimmed
			.slice(eq + 1)
			.trim()
			.replace(/^['"]|['"]$/g, '');
		vars[key] = value;
	}
	return vars;
}

const envFile = useProd ? '.env.production' : '.env';
const vars = loadEnvFile(envFile);
const connectionString = vars['DATABASE_URL'] ?? process.env['DATABASE_URL'];

if (connectionString === undefined || connectionString === '') {
	console.error(`Error: DATABASE_URL not found in ${envFile} or the environment.`);
	process.exit(1);
}

// A row "has focal/zoom but no cropRect" at a given JSON path when the path's
// `focal` AND `zoom` keys both exist but `cropRect` is absent or JSON null.
function legacyGapCondition(column: string) {
	return sql<boolean>`
		(${sql.raw(column)} -> 'focal') IS NOT NULL
		AND (${sql.raw(column)} -> 'zoom') IS NOT NULL
		AND (
			(${sql.raw(column)} -> 'cropRect') IS NULL
			OR (${sql.raw(column)} -> 'cropRect') = 'null'::jsonb
		)
	`;
}

async function main() {
	const client = postgres(connectionString!, { prepare: false, fetch_types: false, max: 1 });
	const db = drizzle(client);

	console.log(`Auditing legacy imageMeta rows (issue #123)`);
	console.log(`  DB: ${new URL(connectionString!).host} (${useProd ? 'production' : 'local'})`);
	console.log();

	try {
		// --- Gifts: base-level imageMeta -------------------------------------
		const giftBaseRows = await db
			.select({ id: gift.id, wishlistId: gift.wishlistId })
			.from(gift)
			.where(
				and(
					isNull(gift.deletedAt),
					isNotNull(gift.imageMeta),
					legacyGapCondition('image_meta'),
				),
			);

		console.log(
			`Gifts – base imageMeta with focal/zoom but no cropRect: ${giftBaseRows.length}`,
		);
		if (verbose && giftBaseRows.length > 0) {
			for (const row of giftBaseRows) {
				console.log(`  gift ${row.id} (wishlist ${row.wishlistId})`);
			}
		}

		// --- Gifts: per-target crops (image_meta.targets.<target>) -----------
		let giftTargetTotal = 0;
		for (const target of GIFT_CROP_TARGET_VALUES as readonly GiftCropTarget[]) {
			const column = `image_meta -> 'targets' -> '${target}'`;
			const rows = await db
				.select({ id: gift.id, wishlistId: gift.wishlistId })
				.from(gift)
				.where(
					and(
						isNull(gift.deletedAt),
						isNotNull(gift.imageMeta),
						sql`(image_meta -> 'targets' -> ${target}) IS NOT NULL`,
						legacyGapCondition(column),
					),
				);
			giftTargetTotal += rows.length;
			console.log(
				`Gifts – target "${target}" with focal/zoom but no cropRect: ${rows.length}`,
			);
			if (verbose && rows.length > 0) {
				for (const row of rows) {
					console.log(`  gift ${row.id} (wishlist ${row.wishlistId})`);
				}
			}
		}

		// --- Wishlists: per-slot imageSlots -----------------------------------
		let wishlistSlotTotal = 0;
		for (const slot of Object.values(WISHLIST_IMAGE_SLOTS)) {
			const column = `image_slots -> '${slot}'`;
			const rows = await db
				.select({ id: wishlist.id, shortId: wishlist.shortId })
				.from(wishlist)
				.where(
					and(
						isNull(wishlist.deletedAt),
						isNotNull(wishlist.imageSlots),
						sql`(image_slots -> ${slot}) IS NOT NULL`,
						legacyGapCondition(column),
					),
				);
			wishlistSlotTotal += rows.length;
			console.log(
				`Wishlists – slot "${slot}" with focal/zoom but no cropRect: ${rows.length}`,
			);
			if (verbose && rows.length > 0) {
				for (const row of rows) {
					console.log(`  wishlist ${row.id} (${row.shortId})`);
				}
			}
		}

		console.log();
		console.log('Summary:');
		console.log(`  Gift base imageMeta affected:   ${giftBaseRows.length}`);
		console.log(`  Gift per-target crops affected: ${giftTargetTotal}`);
		console.log(`  Wishlist slots affected:        ${wishlistSlotTotal}`);
		console.log(
			`  Total affected rows:            ${giftBaseRows.length + giftTargetTotal + wishlistSlotTotal}`,
		);
	} finally {
		await client.end();
	}
}

main().catch((error: unknown) => {
	console.error('Audit failed:', error);
	process.exit(1);
});
