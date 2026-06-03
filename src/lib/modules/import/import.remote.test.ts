import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';

// ── Suppress SvelteKit's remote-function validator injected by the Vite transform
vi.mock('@sveltejs/kit/internal', () => ({
	init_remote_functions: vi.fn(),
}));

vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(),
	command: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
}));

function wrapWithRemoteMarker(
	handler: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
	(handler as unknown as Record<string, unknown>).__ = {};
	return handler;
}

vi.mock('$lib/server/remote.js', () => ({
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
}));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

const { fetchGoogleSheetCsv } = await import('./import.remote.js');

// The mocked guardedCommand returns the raw (authContext, arg) handler; cast to it.
type FetchHandler = (authContext: { user: { id: string } }, link: string) => Promise<string>;
const callFetch = fetchGoogleSheetCsv as unknown as FetchHandler;

const AUTH = { user: { id: 'u1' }, session: {} };

function mockFetchResponse(options: {
	status?: number;
	contentType?: string | null;
	body?: string;
	contentLength?: string | null;
}): void {
	const headers = new Map<string, string>();
	if (options.contentType !== null && options.contentType !== undefined) {
		headers.set('content-type', options.contentType);
	}
	if (options.contentLength !== undefined && options.contentLength !== null) {
		headers.set('content-length', options.contentLength);
	}
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({
			status: options.status ?? 200,
			headers: { get: (key: string) => headers.get(key.toLowerCase()) ?? null },
			text: async () => options.body ?? '',
		})),
	);
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('fetchGoogleSheetCsv', () => {
	it('returns CSV text for a valid sheet and fetches the pinned export URL', async () => {
		mockFetchResponse({ contentType: 'text/csv', body: 'Name,Link\nBoty,https://x.test' });
		const csv = await callFetch(
			AUTH,
			'https://docs.google.com/spreadsheets/d/ABC123/edit#gid=7',
		);
		expect(csv).toBe('Name,Link\nBoty,https://x.test');
		const fetchMock = vi.mocked(globalThis.fetch);
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock.mock.calls[0][0]).toBe(
			'https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=7',
		);
	});

	it('rejects an invalid / non-sheets link before fetching', async () => {
		mockFetchResponse({ contentType: 'text/csv', body: 'x' });
		await expect(
			callFetch(AUTH, 'https://evil.example.com/spreadsheets/d/ABC/edit'),
		).rejects.toThrow(SERVER_ERROR.SHEETS_LINK_INVALID);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it('returns a not-a-sheet error for a Google Docs link before fetching', async () => {
		mockFetchResponse({ contentType: 'text/csv', body: 'x' });
		await expect(
			callFetch(AUTH, 'https://docs.google.com/document/d/ABC/edit'),
		).rejects.toThrow(SERVER_ERROR.SHEETS_LINK_NOT_A_SHEET);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it('maps a private sheet (HTML response) to a friendly typed error', async () => {
		mockFetchResponse({ contentType: 'text/html', body: '<html>sign in</html>' });
		await expect(
			callFetch(AUTH, 'https://docs.google.com/spreadsheets/d/ABC/edit'),
		).rejects.toThrow(SERVER_ERROR.SHEETS_PRIVATE);
	});

	it('maps a 500 response to a fetch-failed error', async () => {
		mockFetchResponse({ status: 500, contentType: null });
		await expect(
			callFetch(AUTH, 'https://docs.google.com/spreadsheets/d/ABC/edit'),
		).rejects.toThrow(SERVER_ERROR.SHEETS_FETCH_FAILED);
	});

	it('maps a network failure to a fetch-failed error', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('network down');
			}),
		);
		await expect(
			callFetch(AUTH, 'https://docs.google.com/spreadsheets/d/ABC/edit'),
		).rejects.toThrow(SERVER_ERROR.SHEETS_FETCH_FAILED);
	});

	it('rejects an over-large response by declared content-length', async () => {
		mockFetchResponse({ contentType: 'text/csv', contentLength: '99999999', body: 'x' });
		await expect(
			callFetch(AUTH, 'https://docs.google.com/spreadsheets/d/ABC/edit'),
		).rejects.toThrow(SERVER_ERROR.SHEETS_FETCH_FAILED);
	});

	it('rejects an over-large response by actual body length', async () => {
		const huge = 'a'.repeat(2_000_001);
		mockFetchResponse({ contentType: 'text/csv', body: huge });
		await expect(
			callFetch(AUTH, 'https://docs.google.com/spreadsheets/d/ABC/edit'),
		).rejects.toThrow(SERVER_ERROR.SHEETS_FETCH_FAILED);
	});
});
