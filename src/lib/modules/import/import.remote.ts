import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { guardedCommand } from '$lib/server/remote.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	buildSheetsCsvExportUrl,
	classifySheetCsvResponse,
	MAX_SHEET_BYTES,
} from './sheets_link.js';

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
		});
	} catch {
		error(502, SERVER_ERROR.SHEETS_FETCH_FAILED);
	}

	const verdict = classifySheetCsvResponse(response.status, response.headers.get('content-type'));
	if (!verdict.ok) {
		const status = verdict.code === SERVER_ERROR.SHEETS_PRIVATE ? 403 : 502;
		error(status, verdict.code);
	}

	const declaredLength = Number(response.headers.get('content-length') ?? '0');
	if (declaredLength > MAX_SHEET_BYTES) {
		error(502, SERVER_ERROR.SHEETS_FETCH_FAILED);
	}

	const csv = await response.text();
	if (csv.length > MAX_SHEET_BYTES) {
		error(502, SERVER_ERROR.SHEETS_FETCH_FAILED);
	}

	return csv;
});
