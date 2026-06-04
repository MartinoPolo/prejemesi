import * as v from 'valibot';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { guardedCommand } from '$lib/server/remote.js';
import {
	verifyOwnerOrModerator,
	assertWishlistMutable,
} from '$lib/modules/wishlists/wishlist_access.js';
import { seedNewWishlist } from '$lib/modules/wishlists/wishlist_create.js';
import { DEFAULT_GIFT_CURRENCY, type GiftDraftInput } from '$lib/modules/gifts/types.js';
import { normalizeGiftLinks } from '$lib/modules/gifts/gift_url.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	buildSheetsCsvExportUrl,
	classifySheetCsvResponse,
	MAX_SHEET_BYTES,
} from './sheets_link.js';
import { ImportGiftsInputSchema, CreateWishlistFromImportInputSchema } from './import_types.js';

const SheetLinkSchema = v.pipe(v.string(), v.trim(), v.minLength(1));

/**
 * Fetch a Google Sheet as CSV, server-side. The raw user URL is never fetched —
 * {@link buildSheetsCsvExportUrl} reconstructs a pinned `docs.google.com` export
 * URL or returns a typed error (invalid / not-a-sheet). The fetched response is
 * classified for private-sheet / failure cases before the CSV text is returned.
 *
 * Auth-gated (any signed-in user) so the server isn't an open fetch proxy.
 * Returns the raw CSV string; parsing happens client-side to keep the Worker thin.
 */
export const fetchGoogleSheetCsv = guardedCommand(SheetLinkSchema, async (_authContext, link) => {
	const built = buildSheetsCsvExportUrl(link);
	if (!built.ok) {
		error(400, built.code);
	}

	let response: Response;
	try {
		response = await fetch(built.target.exportUrl, {
			redirect: 'follow',
			headers: { accept: 'text/csv,text/plain' },
			signal: AbortSignal.timeout(15_000),
		});
	} catch (err) {
		if (
			typeof err === 'object' &&
			err !== null &&
			(err as { name?: string }).name === 'TimeoutError'
		) {
			error(504, SERVER_ERROR.SHEETS_FETCH_FAILED);
		}
		error(502, SERVER_ERROR.SHEETS_FETCH_FAILED);
	}

	const verdict = classifySheetCsvResponse(response.status, response.headers.get('content-type'));
	if (!verdict.ok) {
		const status = verdict.code === SERVER_ERROR.SHEETS_PRIVATE ? 403 : 502;
		error(status, verdict.code);
	}

	const contentLength = response.headers.get('content-length');
	const declaredLength = contentLength !== null ? Number(contentLength) : null;
	if (declaredLength !== null && declaredLength > MAX_SHEET_BYTES) {
		error(502, SERVER_ERROR.SHEETS_FETCH_FAILED);
	}

	const csv = await response.text();
	if (csv.length > MAX_SHEET_BYTES) {
		error(502, SERVER_ERROR.SHEETS_FETCH_FAILED);
	}

	return csv;
});

/** Map a committed draft to a gift insert row at a fixed sortOrder position. */
function draftToGiftValues(wishlistId: string, draft: GiftDraftInput, sortOrder: number) {
	return {
		wishlistId,
		name: draft.name,
		description: draft.description ?? null,
		links: normalizeGiftLinks(draft.links),
		price: draft.price ?? null,
		currency: draft.currency ?? DEFAULT_GIFT_CURRENCY,
		sortOrder,
	};
}

/**
 * Append imported/batch drafts to an existing wishlist. Owner or moderator only;
 * rejected on archived wishlists. New gifts are appended after the current max
 * sortOrder so existing ordering is preserved; the whole batch inserts in one
 * transaction. Returns the created gift rows.
 */
export const importGifts = guardedCommand(ImportGiftsInputSchema, async ({ user }, input) => {
	const { wishlistRow } = await verifyOwnerOrModerator(user.id, input.wishlistId);
	assertWishlistMutable(wishlistRow);

	if (input.gifts.length === 0) {
		return [];
	}

	const database = getDb();

	return database.transaction(async (tx) => {
		const maxSortRows = await tx
			.select({ maxSort: sql<number>`COALESCE(MAX(${gift.sortOrder}), -1)` })
			.from(gift)
			.where(and(eq(gift.wishlistId, input.wishlistId), isNull(gift.deletedAt)));

		const base = Number(maxSortRows[0]?.maxSort ?? -1) + 1;

		return tx
			.insert(gift)
			.values(
				input.gifts.map((draft, i) => draftToGiftValues(input.wishlistId, draft, base + i)),
			)
			.returning();
	});
});

/**
 * Create a new wishlist owned by the caller, seed its default priority levels,
 * and insert the imported drafts (sortOrder sequential from 0) — all atomically
 * in one transaction. Returns the created wishlist row.
 */
export const createWishlistFromImport = guardedCommand(
	CreateWishlistFromImportInputSchema,
	async ({ user }, input) => {
		const database = getDb();

		return database.transaction(async (tx) => {
			const created = await seedNewWishlist(tx, user.id, input);

			if (input.gifts.length > 0) {
				await tx
					.insert(gift)
					.values(input.gifts.map((draft, i) => draftToGiftValues(created.id, draft, i)));
			}

			return created;
		});
	},
);
