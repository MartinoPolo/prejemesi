import { describe, it, expect } from 'vitest';
import { buildSheetsCsvExportUrl, classifySheetCsvResponse, DOCS_HOST } from './sheets_link.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';

describe('buildSheetsCsvExportUrl — valid sheets', () => {
	it('builds a pinned CSV export URL from a standard share link with gid', () => {
		const result = buildSheetsCsvExportUrl(
			'https://docs.google.com/spreadsheets/d/1AbCdEf_123-XYZ/edit#gid=42',
		);
		expect(result).toEqual({
			ok: true,
			target: {
				exportUrl:
					'https://docs.google.com/spreadsheets/d/1AbCdEf_123-XYZ/export?format=csv&gid=42',
				spreadsheetId: '1AbCdEf_123-XYZ',
				gid: '42',
			},
		});
	});

	it('omits gid when the link has none', () => {
		const result = buildSheetsCsvExportUrl(
			'https://docs.google.com/spreadsheets/d/ABC123/edit',
		);
		expect(result).toEqual({
			ok: true,
			target: {
				exportUrl: 'https://docs.google.com/spreadsheets/d/ABC123/export?format=csv',
				spreadsheetId: 'ABC123',
				gid: null,
			},
		});
	});

	it('builds a /pub?output=csv URL for a published sheet', () => {
		const result = buildSheetsCsvExportUrl(
			'https://docs.google.com/spreadsheets/d/e/2PACX-tok_en/pubhtml',
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.target.exportUrl).toBe(
				'https://docs.google.com/spreadsheets/d/e/2PACX-tok_en/pub?output=csv',
			);
		}
	});

	it('pins the host even if the input uses a different (spoofed) host', () => {
		// A would-be attacker host is rejected before any id extraction.
		const result = buildSheetsCsvExportUrl(
			'https://evil.example.com/spreadsheets/d/ABC123/edit',
		);
		expect(result).toEqual({ ok: false, code: SERVER_ERROR.SHEETS_LINK_INVALID });
	});

	it('always reconstructs against the pinned docs host', () => {
		const result = buildSheetsCsvExportUrl(
			'https://docs.google.com/spreadsheets/d/ABC123/edit',
		);
		expect(result.ok && new URL(result.target.exportUrl).hostname).toBe(DOCS_HOST);
	});
});

describe('buildSheetsCsvExportUrl — rejections (SSRF + typed errors)', () => {
	it('rejects a non-http(s) scheme', () => {
		expect(buildSheetsCsvExportUrl('file:///etc/passwd')).toEqual({
			ok: false,
			code: SERVER_ERROR.SHEETS_LINK_INVALID,
		});
		expect(buildSheetsCsvExportUrl('javascript:alert(1)')).toEqual({
			ok: false,
			code: SERVER_ERROR.SHEETS_LINK_INVALID,
		});
	});

	it('rejects a private-IP / loopback target', () => {
		expect(buildSheetsCsvExportUrl('http://127.0.0.1/spreadsheets/d/ABC/edit').ok).toBe(false);
		expect(buildSheetsCsvExportUrl('http://192.168.1.10/spreadsheets/d/ABC/edit')).toEqual({
			ok: false,
			code: SERVER_ERROR.SHEETS_LINK_INVALID,
		});
		expect(buildSheetsCsvExportUrl('http://localhost/spreadsheets/d/ABC/edit').ok).toBe(false);
		expect(buildSheetsCsvExportUrl('http://[::1]/spreadsheets/d/ABC/edit').ok).toBe(false);
	});

	it('rejects an unparseable URL', () => {
		expect(buildSheetsCsvExportUrl('not a url at all')).toEqual({
			ok: false,
			code: SERVER_ERROR.SHEETS_LINK_INVALID,
		});
	});

	it('returns NOT_A_SHEET for a Google Docs link', () => {
		expect(buildSheetsCsvExportUrl('https://docs.google.com/document/d/ABC123/edit')).toEqual({
			ok: false,
			code: SERVER_ERROR.SHEETS_LINK_NOT_A_SHEET,
		});
	});

	it('returns NOT_A_SHEET for a Google Slides link', () => {
		expect(
			buildSheetsCsvExportUrl('https://docs.google.com/presentation/d/ABC123/edit'),
		).toEqual({ ok: false, code: SERVER_ERROR.SHEETS_LINK_NOT_A_SHEET });
	});

	it('returns NOT_A_SHEET for a docs.google.com link with no spreadsheet id', () => {
		expect(buildSheetsCsvExportUrl('https://docs.google.com/forms/d/ABC/viewform')).toEqual({
			ok: false,
			code: SERVER_ERROR.SHEETS_LINK_NOT_A_SHEET,
		});
	});
});

describe('classifySheetCsvResponse', () => {
	it('accepts a 200 text/csv response', () => {
		expect(classifySheetCsvResponse(200, 'text/csv; charset=utf-8')).toEqual({ ok: true });
	});

	it('accepts a 200 text/plain response', () => {
		expect(classifySheetCsvResponse(200, 'text/plain')).toEqual({ ok: true });
	});

	it('treats a 200 HTML body as a private sheet (sign-in page)', () => {
		expect(classifySheetCsvResponse(200, 'text/html; charset=utf-8')).toEqual({
			ok: false,
			code: SERVER_ERROR.SHEETS_PRIVATE,
		});
	});

	it('treats 401/403 as private', () => {
		expect(classifySheetCsvResponse(401, null)).toEqual({
			ok: false,
			code: SERVER_ERROR.SHEETS_PRIVATE,
		});
		expect(classifySheetCsvResponse(403, 'text/html')).toEqual({
			ok: false,
			code: SERVER_ERROR.SHEETS_PRIVATE,
		});
	});

	it('treats 404 as not-a-sheet', () => {
		expect(classifySheetCsvResponse(404, null)).toEqual({
			ok: false,
			code: SERVER_ERROR.SHEETS_LINK_NOT_A_SHEET,
		});
	});

	it('treats other non-2xx statuses as a fetch failure', () => {
		expect(classifySheetCsvResponse(500, null)).toEqual({
			ok: false,
			code: SERVER_ERROR.SHEETS_FETCH_FAILED,
		});
	});
});
