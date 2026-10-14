import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { guardedCommand, singleFlightRefresh } from '$lib/server/remote.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { getGiftCategorySettingsRows } from '$lib/modules/gift-categories/gift_category_queries.remote.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import {
	createWishlistFromImportOperation,
	importGiftsOperation,
} from '$lib/server/operations/import_operations.js';
import {
	buildSheetsCsvExportUrl,
	classifySheetCsvResponse,
	MAX_SHEET_BYTES,
} from './sheets_link.js';
import { ImportGiftsInputSchema, CreateWishlistFromImportInputSchema } from './import_types.js';

import { rejectDemoOperation } from '$lib/server/demo/scope.js';

export type { ImportGiftsResult } from '$lib/server/operations/import_operations.js';

const SheetLinkSchema = v.pipe(v.string(), v.trim(), v.minLength(1));

/**
 * Fetch a Google Sheet as CSV, server-side. The raw user URL is never fetched –
 * {@link buildSheetsCsvExportUrl} reconstructs a pinned `docs.google.com` export
 * URL or returns a typed error (invalid / not-a-sheet). The fetched response is
 * classified for private-sheet / failure cases before the CSV text is returned.
 *
 * Auth-gated (any signed-in user) so the server isn't an open fetch proxy.
 * Returns the raw CSV string; parsing happens client-side to keep the Worker thin.
 */
export const fetchGoogleSheetCsv = guardedCommand(SheetLinkSchema, async (_authContext, link) => {
	rejectDemoOperation();
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

/**
 * Append imported/batch drafts to an existing wishlist. Managers (recipient or správce) only;
 * rejected on archived wishlists. New gifts are appended after the current max
 * sortOrder so existing ordering is preserved; the whole batch inserts in one
 * transaction. Returns the created gift rows.
 */
export const importGifts = guardedCommand(ImportGiftsInputSchema, async ({ user }, input) => {
	const { outcome, wishlistShortId } = await executeOperation(
		userInterfaceActor(user),
		importGiftsOperation,
		input,
	);
	if (outcome.status === 'created' && outcome.gifts.length > 0) {
		singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);
		singleFlightRefresh(getGiftCategorySettingsRows, input.wishlistId);
	}
	return outcome;
});

/**
 * Create a new wishlist owned by the caller, seed its default priority levels,
 * and insert the imported drafts (sortOrder sequential from 0) – all atomically
 * in one transaction. Returns the created wishlist row.
 */
export const createWishlistFromImport = guardedCommand(
	CreateWishlistFromImportInputSchema,
	async ({ user }, input) =>
		executeOperation(userInterfaceActor(user), createWishlistFromImportOperation, input),
);
