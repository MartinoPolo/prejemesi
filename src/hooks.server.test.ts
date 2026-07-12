import { vi, describe, it, expect, beforeEach } from 'vitest';

/**
 * Preference-read budget for the server hooks (issue #108, REQ-1/REQ-2).
 *
 * The viewer's stable presentation preferences (preferred locale + app palette)
 * may cost at most ONE database statement per HTML document request — and none
 * at all for remote function calls, SvelteKit data requests, uploads, or API
 * routes, whose responses do not depend on those values.
 */

vi.mock('$app/environment', () => ({
	dev: true,
	building: false,
}));

// Kit's real sequence() requires the internal request store (unavailable in unit
// tests). This equivalent composition chains handles and merges the
// transformPageChunk options they pass to resolve.
vi.mock('@sveltejs/kit/hooks', () => {
	interface ResolveOpts {
		transformPageChunk?: (input: { html: string; done: boolean }) => string | undefined;
	}
	type TestHandle = (input: {
		event: unknown;
		resolve: (event: unknown, opts?: ResolveOpts) => Promise<Response>;
	}) => Promise<Response> | Response;

	function mergeOpts(outer?: ResolveOpts, inner?: ResolveOpts): ResolveOpts | undefined {
		if (!outer) {
			return inner;
		}
		if (!inner) {
			return outer;
		}
		return {
			...outer,
			...inner,
			transformPageChunk: ({ html, done }) => {
				const outerHtml = outer.transformPageChunk?.({ html, done }) ?? html;
				return inner.transformPageChunk?.({ html: outerHtml, done }) ?? outerHtml;
			},
		};
	}

	return {
		sequence:
			(...handles: TestHandle[]): TestHandle =>
			({ event, resolve }) => {
				const run = (
					index: number,
					currentEvent: unknown,
					opts?: ResolveOpts,
				): Promise<Response> => {
					if (index === handles.length) {
						return resolve(currentEvent, opts);
					}
					return Promise.resolve(
						handles[index]!({
							event: currentEvent,
							resolve: (nextEvent, nextOpts) =>
								run(index + 1, nextEvent, mergeOpts(opts, nextOpts)),
						}),
					);
				};
				return run(0, event);
			},
	};
});

vi.mock('$lib/paraglide/server', () => ({
	paraglideMiddleware: vi.fn(
		(
			request: Request,
			callback: (input: { request: Request; locale: string }) => Promise<Response>,
		) => callback({ request, locale: 'cs' }),
	),
}));

vi.mock('$lib/paraglide/runtime', () => ({
	cookieName: 'PARAGLIDE_LOCALE',
	getTextDirection: vi.fn(() => 'ltr'),
}));

const { mockGetDb, mockIsDatabaseConfigured, mockSelect } = vi.hoisted(() => {
	const mockSelect = vi.fn();
	return {
		mockSelect,
		mockGetDb: vi.fn(() => ({ select: mockSelect })),
		mockIsDatabaseConfigured: vi.fn(() => true),
	};
});

vi.mock('$lib/server/db/index.js', () => ({
	getDb: mockGetDb,
	isDatabaseConfigured: mockIsDatabaseConfigured,
	rememberDatabaseBinding: vi.fn(),
}));

vi.mock('$lib/server/db/auth.schema.js', () => ({
	user: { id: 'user.id', preferredLocale: 'user.preferredLocale', palette: 'user.palette' },
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(),
}));

// Auth is exercised through the mocked BetterAuth surface: getSession supplies
// `locals.user`, svelteKitHandler just resolves.
const { mockGetSession } = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
}));

vi.mock('$lib/server/auth.js', () => ({
	createAuth: vi.fn(() => ({ api: { getSession: mockGetSession } })),
}));

vi.mock('better-auth/svelte-kit', () => ({
	svelteKitHandler: vi.fn(
		({ event, resolve }: { event: unknown; resolve: (event: unknown) => Promise<Response> }) =>
			resolve(event),
	),
}));

import { handle } from './hooks.server.js';

const SESSION_USER = { id: 'user-1', email: 'user@example.com' };

function setPreferenceRow(row: { preferredLocale: string | null; palette: string | null }) {
	mockSelect.mockReturnValue({
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				limit: vi.fn(() => Promise.resolve([row])),
			})),
		})),
	});
}

interface EventOptions {
	path?: string;
	method?: string;
	accept?: string;
	cookies?: Record<string, string>;
	isDataRequest?: boolean;
	isRemoteRequest?: boolean;
}

function createEvent({
	path = '/my-lists',
	method = 'GET',
	accept = 'text/html,application/xhtml+xml',
	cookies = {},
	isDataRequest = false,
	isRemoteRequest = false,
}: EventOptions = {}) {
	const url = new URL(`https://prejemesi.cz${path}`);
	return {
		url,
		request: new Request(url, { method, headers: { accept } }),
		cookies: { get: (name: string) => cookies[name] },
		locals: {} as Record<string, unknown>,
		platform: undefined,
		isDataRequest,
		isRemoteRequest,
		isSubRequest: false,
		setHeaders: vi.fn(),
	};
}

/** Runs the full hook chain; the terminal resolve applies transformPageChunk to a probe page. */
async function runHandle(event: ReturnType<typeof createEvent>): Promise<{
	response: Response;
	html: string;
	resolvedRequest: Request;
}> {
	let resolvedRequest: Request = event.request;
	const resolve = vi.fn(
		async (
			resolvedEvent: { request: Request },
			opts?: { transformPageChunk?: (input: { html: string; done: boolean }) => string },
		) => {
			resolvedRequest = resolvedEvent.request;
			let html = '<html data-palette-probe="%app.palette%"></html>';
			if (opts?.transformPageChunk) {
				html = opts.transformPageChunk({ html, done: true }) ?? html;
			}
			return new Response(html, { headers: { 'content-type': 'text/html' } });
		},
	);

	const response = await (handle as unknown as (input: unknown) => Promise<Response>)({
		event,
		resolve,
	});
	return { response, html: await response.text(), resolvedRequest };
}

beforeEach(() => {
	vi.clearAllMocks();
	mockIsDatabaseConfigured.mockReturnValue(true);
	mockGetSession.mockResolvedValue({ session: { id: 'session-1' }, user: SESSION_USER });
	setPreferenceRow({ preferredLocale: 'en', palette: 'grape' });
});

describe('user preference reads (issue #108, REQ-1/REQ-2)', () => {
	it('remote function requests never read preferences', async () => {
		await runHandle(
			createEvent({
				path: '/_app/remote/abc123/createGift',
				method: 'POST',
				accept: '*/*',
				isRemoteRequest: true,
			}),
		);

		expect(mockGetDb).not.toHaveBeenCalled();
	});

	it('SvelteKit data requests never read preferences', async () => {
		await runHandle(
			createEvent({ path: '/my-lists/__data.json', accept: '*/*', isDataRequest: true }),
		);

		expect(mockGetDb).not.toHaveBeenCalled();
	});

	it('upload/API requests never read preferences', async () => {
		await runHandle(
			createEvent({ path: '/api/upload/gifts/abc.jpg', method: 'PUT', accept: '*/*' }),
		);

		expect(mockGetDb).not.toHaveBeenCalled();
	});

	it('an HTML document request for a logged-in user costs exactly one statement (locale + palette combined)', async () => {
		const { html, resolvedRequest } = await runHandle(createEvent());

		expect(mockGetDb).toHaveBeenCalledTimes(1);
		expect(mockSelect).toHaveBeenCalledTimes(1);
		// The single row serves both concerns: palette lands in the shell...
		expect(html).toContain('data-palette-probe="grape"');
		// ...and the account locale overrides the request cookie for paraglide.
		expect(resolvedRequest.headers.get('cookie')).toContain('PARAGLIDE_LOCALE=en');
	});

	it('skips the read entirely when the palette cookie exists and the URL carries an explicit locale', async () => {
		const { html } = await runHandle(
			createEvent({ path: '/en/my-lists', cookies: { 'app-palette': 'mint' } }),
		);

		expect(mockGetDb).not.toHaveBeenCalled();
		expect(html).toContain('data-palette-probe="mint"');
	});

	it('anonymous HTML requests never read preferences and fall back to the default palette', async () => {
		mockGetSession.mockResolvedValue(null);

		const { html } = await runHandle(createEvent());

		expect(mockGetDb).not.toHaveBeenCalled();
		expect(html).toContain('data-palette-probe="sky"');
	});
});
