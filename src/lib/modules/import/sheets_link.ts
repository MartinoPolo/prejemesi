import { SERVER_ERROR, type ServerErrorCode } from '$lib/modules/errors/server_error_codes.js';

/**
 * Pure logic for turning a user-supplied Google Sheets share/published link into
 * a safe CSV-export URL, and for classifying the fetch response.
 *
 * SSRF defence: the export URL is ALWAYS reconstructed against the pinned host
 * {@link DOCS_HOST}. The raw user URL is never fetched. Any non-http(s) scheme,
 * IP-literal/private host, or non-`docs.google.com` host is rejected before a
 * spreadsheet id is even extracted, so the server can only ever talk to Google.
 */

/** The only host the server is ever allowed to fetch a sheet from. */
export const DOCS_HOST = 'docs.google.com';

/** Hard cap on the CSV body the server will accept, protecting the Worker. */
export const MAX_SHEET_BYTES = 2_000_000;

export interface SheetsCsvTarget {
	exportUrl: string;
	spreadsheetId: string;
	gid: string | null;
}

export type SheetsLinkResult =
	| { ok: true; target: SheetsCsvTarget }
	| { ok: false; code: ServerErrorCode };

export type SheetsResponseVerdict = { ok: true } | { ok: false; code: ServerErrorCode };

const STANDARD_ID_RE = /\/spreadsheets\/d\/([\w-]+)/;
const PUBLISHED_ID_RE = /\/spreadsheets\/d\/e\/([\w-]+)/;
const GID_RE = /[?&#]gid=(\d+)/;
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Reject IP literals and non-public hostnames outright (defence in depth). */
function isBlockedHost(hostname: string): boolean {
	const host = hostname.toLowerCase();
	if (host.includes(':')) {
		return true; // IPv6 literal
	}
	if (IPV4_RE.test(host)) {
		return true; // IPv4 literal
	}
	return (
		host === 'localhost' ||
		host.endsWith('.localhost') ||
		host.endsWith('.local') ||
		host.endsWith('.internal')
	);
}

function extractGid(rawUrl: string): string | null {
	const match = GID_RE.exec(rawUrl);
	return match !== null ? match[1] : null;
}

/**
 * Validate a Google Sheets link and build a pinned CSV-export URL.
 *
 * Returns a typed error for: an unparseable/non-http(s)/IP/private link
 * ({@link SERVER_ERROR.SHEETS_LINK_INVALID}); a Google Docs/Slides or other
 * non-spreadsheet `docs.google.com` link ({@link SERVER_ERROR.SHEETS_LINK_NOT_A_SHEET}).
 */
export function buildSheetsCsvExportUrl(input: string): SheetsLinkResult {
	const trimmed = input.trim();

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return { ok: false, code: SERVER_ERROR.SHEETS_LINK_INVALID };
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return { ok: false, code: SERVER_ERROR.SHEETS_LINK_INVALID };
	}
	if (isBlockedHost(url.hostname)) {
		return { ok: false, code: SERVER_ERROR.SHEETS_LINK_INVALID };
	}
	if (url.hostname.toLowerCase() !== DOCS_HOST) {
		return { ok: false, code: SERVER_ERROR.SHEETS_LINK_INVALID };
	}

	const path = url.pathname;
	if (path.startsWith('/document/') || path.startsWith('/presentation/')) {
		return { ok: false, code: SERVER_ERROR.SHEETS_LINK_NOT_A_SHEET };
	}

	const gid = extractGid(trimmed);

	// Published sheet (`/spreadsheets/d/e/<token>/pubhtml`): export via /pub?output=csv.
	const published = PUBLISHED_ID_RE.exec(path);
	if (published !== null) {
		const token = published[1];
		let exportUrl = `https://${DOCS_HOST}/spreadsheets/d/e/${token}/pub?output=csv`;
		if (gid !== null) {
			exportUrl += `&single=true&gid=${gid}`;
		}
		return { ok: true, target: { exportUrl, spreadsheetId: token, gid } };
	}

	// Standard sheet (`/spreadsheets/d/<id>/edit#gid=<gid>`): export via /export?format=csv.
	const standard = STANDARD_ID_RE.exec(path);
	if (standard !== null) {
		const id = standard[1];
		let exportUrl = `https://${DOCS_HOST}/spreadsheets/d/${id}/export?format=csv`;
		if (gid !== null) {
			exportUrl += `&gid=${gid}`;
		}
		return { ok: true, target: { exportUrl, spreadsheetId: id, gid } };
	}

	return { ok: false, code: SERVER_ERROR.SHEETS_LINK_NOT_A_SHEET };
}

/**
 * Classify the response of a CSV-export fetch. A private sheet redirects to a
 * Google sign-in page (HTML), or returns 401/403; a missing sheet returns 404.
 */
export function classifySheetCsvResponse(
	status: number,
	contentType: string | null,
): SheetsResponseVerdict {
	if (status === 401 || status === 403) {
		return { ok: false, code: SERVER_ERROR.SHEETS_PRIVATE };
	}
	if (status === 404) {
		return { ok: false, code: SERVER_ERROR.SHEETS_LINK_NOT_A_SHEET };
	}
	if (status < 200 || status >= 400) {
		return { ok: false, code: SERVER_ERROR.SHEETS_FETCH_FAILED };
	}
	if ((contentType ?? '').toLowerCase().includes('text/html')) {
		// A 2xx HTML body for a CSV export means Google served a sign-in page.
		return { ok: false, code: SERVER_ERROR.SHEETS_PRIVATE };
	}
	return { ok: true };
}
