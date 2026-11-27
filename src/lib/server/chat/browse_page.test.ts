import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	BROWSE_PAGE_ERROR,
	BROWSE_PAGE_LIMITS,
	browsePage,
	conversationUrls,
	type BrowsePageContext,
} from './browse_page.js';
import { CHAT_BLOCK, CHAT_ROLE, type ChatModelMessage } from './chat_model.js';

const CONFIG = { accountId: 'account-123', apiToken: 'secret-browser-token' };

const UNRESTRICTED: BrowsePageContext = { signal: undefined, conversationUrls: null };

const fetchStub = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

beforeEach(() => {
	fetchStub.mockReset();
	vi.stubGlobal('fetch', fetchStub);
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('browsePage', () => {
	it('asks the account’s Browser Run markdown action for the page with bounded loading', async () => {
		fetchStub.mockResolvedValue(jsonResponse({ success: true, result: '# Kolo' }));
		const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

		await browsePage(CONFIG, { url: 'https://shop.example.cz/kolo' }, UNRESTRICTED);

		expect(fetchStub).toHaveBeenCalledOnce();
		const [requestUrl, init] = fetchStub.mock.calls[0] ?? [];
		expect(requestUrl).toBe(
			'https://api.cloudflare.com/client/v4/accounts/account-123/browser-rendering/markdown',
		);
		expect(init?.method).toBe('POST');
		expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret-browser-token');
		const body = JSON.parse(String(init?.body)) as {
			url: string;
			gotoOptions: { timeout: number };
			rejectResourceTypes: string[];
		};
		expect(body.url).toBe('https://shop.example.cz/kolo');
		expect(body.gotoOptions.timeout).toBeGreaterThan(0);
		expect(body.gotoOptions.timeout).toBeLessThanOrEqual(60_000);
		expect(body.rejectResourceTypes).toEqual(
			expect.arrayContaining(['image', 'media', 'font', 'stylesheet']),
		);
		expect(timeoutSpy).toHaveBeenCalledWith(BROWSE_PAGE_LIMITS.requestTimeoutMs);
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it('returns the page’s markdown', async () => {
		fetchStub.mockResolvedValue(jsonResponse({ success: true, result: '# Kolo\n\n12 990 Kč' }));

		await expect(
			browsePage(CONFIG, { url: 'https://shop.example.cz/kolo' }, UNRESTRICTED),
		).resolves.toEqual({
			ok: true,
			page: {
				url: 'https://shop.example.cz/kolo',
				markdown: '# Kolo\n\n12 990 Kč',
				truncated: false,
			},
		});
	});

	it('cuts markdown over the cap and says so', async () => {
		const longMarkdown = 'a'.repeat(BROWSE_PAGE_LIMITS.markdownMaxLength + 10);
		fetchStub.mockResolvedValue(jsonResponse({ success: true, result: longMarkdown }));

		const result = await browsePage(
			CONFIG,
			{ url: 'https://shop.example.cz/kolo' },
			UNRESTRICTED,
		);

		expect(result.ok && result.page.truncated).toBe(true);
		expect(result.ok && result.page.markdown.length).toBe(BROWSE_PAGE_LIMITS.markdownMaxLength);
	});

	it.each([
		['a non-web protocol', 'ftp://shop.example.cz/kolo'],
		['a file URL', 'file:///etc/passwd'],
		['localhost', 'http://localhost:5173/'],
		['a localhost subdomain', 'http://app.localhost/'],
		['a host without a dot', 'http://intranet/'],
		['a loopback address', 'http://127.0.0.1/'],
		['a numeric loopback address', 'http://2130706433/'],
		['a private address', 'http://192.168.1.10/'],
		['a private 10/8 address', 'https://10.0.0.5/'],
		['a private 172.16/12 address', 'https://172.20.1.1/'],
		['the first 172.16/12 address', 'https://172.16.0.1/'],
		['the last 172.16/12 address', 'https://172.31.255.254/'],
		['a shared 100.64/10 address', 'https://100.64.0.1/'],
		['the unspecified address', 'http://0.0.0.0/'],
		['an address with credentials', 'https://user:secret@shop.example.cz/kolo'],
		['an address with a user name', 'https://user@shop.example.cz/kolo'],
		['a link-local address', 'http://169.254.169.254/latest/meta-data'],
		['an IPv6 loopback', 'http://[::1]/'],
		[
			'an over-long URL',
			`https://shop.example.cz/${'a'.repeat(BROWSE_PAGE_LIMITS.urlMaxLength)}`,
		],
		['an unparsable URL', 'not a url'],
	])('refuses %s without loading it', async (_label, url) => {
		await expect(browsePage(CONFIG, { url }, UNRESTRICTED)).resolves.toEqual({
			ok: false,
			error: BROWSE_PAGE_ERROR.urlNotAllowed,
		});
		expect(fetchStub).not.toHaveBeenCalled();
	});

	it('refuses a call without a URL', async () => {
		await expect(browsePage(CONFIG, {}, UNRESTRICTED)).resolves.toEqual({
			ok: false,
			error: BROWSE_PAGE_ERROR.urlNotAllowed,
		});
		expect(fetchStub).not.toHaveBeenCalled();
	});

	it.each([
		['a public address', 'http://93.184.216.34/'],
		['the address below 172.16/12', 'http://172.15.255.255/'],
		['the address above 172.16/12', 'http://172.32.0.1/'],
	])('opens %s', async (_label, url) => {
		fetchStub.mockResolvedValue(jsonResponse({ success: true, result: 'ok' }));

		const result = await browsePage(CONFIG, { url }, UNRESTRICTED);

		expect(result.ok).toBe(true);
	});

	describe('at a Browser Run limit', () => {
		const PAGE = { url: 'https://shop.example.cz/kolo' };

		function rateLimited(retryAfter?: number | string): Response {
			return new Response(
				JSON.stringify({
					success: false,
					errors: [{ code: 2001, message: 'Rate limit exceeded' }],
				}),
				{
					status: 429,
					headers: {
						'content-type': 'application/json',
						...(retryAfter === undefined ? {} : { 'retry-after': String(retryAfter) }),
					},
				},
			);
		}

		function dailyLimited(): Response {
			return jsonResponse(
				{
					success: false,
					errors: [{ code: 2001, message: 'Browser time limit exceeded for today' }],
				},
				429,
			);
		}

		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('waits as Cloudflare asks, then retries once and returns the page', async () => {
			fetchStub
				.mockResolvedValueOnce(rateLimited(3))
				.mockResolvedValueOnce(jsonResponse({ success: true, result: '# Kolo' }));

			const result = browsePage(CONFIG, PAGE, UNRESTRICTED);
			await vi.advanceTimersByTimeAsync(2_900);
			expect(fetchStub).toHaveBeenCalledOnce();
			await vi.advanceTimersByTimeAsync(100);

			await expect(result).resolves.toEqual({
				ok: true,
				page: { url: PAGE.url, markdown: '# Kolo', truncated: false },
			});
			expect(fetchStub).toHaveBeenCalledTimes(2);
			expect(console.warn).toHaveBeenCalledWith(
				'[chat] browse_page failed',
				429,
				expect.stringContaining('Rate limit exceeded'),
			);
			expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
				CONFIG.apiToken,
			);
		});

		it.each([
			{ case: 'without a Retry-After', response: () => rateLimited() },
			{ case: 'with an unparsable Retry-After', response: () => rateLimited('soon') },
		])('waits the default interval $case before its retry', async ({ response }) => {
			fetchStub
				.mockResolvedValueOnce(response())
				.mockResolvedValueOnce(jsonResponse({ success: true, result: '# Kolo' }));

			const result = browsePage(CONFIG, PAGE, UNRESTRICTED);
			await vi.advanceTimersByTimeAsync(BROWSE_PAGE_LIMITS.rateLimitDefaultWaitMs - 100);
			expect(fetchStub).toHaveBeenCalledOnce();
			await vi.advanceTimersByTimeAsync(100);

			await expect(result).resolves.toMatchObject({ ok: true });
			expect(fetchStub).toHaveBeenCalledTimes(2);
		});

		it('reports the rate limit at once when the wait leaves too little time to load a page', async () => {
			fetchStub.mockImplementation(async () => {
				vi.advanceTimersByTime(30_000);
				return rateLimited(10);
			});

			const result = await browsePage(CONFIG, PAGE, UNRESTRICTED);

			expect(result).toEqual({ ok: false, error: BROWSE_PAGE_ERROR.limitReached });
			expect(fetchStub).toHaveBeenCalledOnce();
		});

		it('reports the rate limit after exactly two rate-limited requests', async () => {
			fetchStub.mockImplementation(async () => rateLimited());

			const result = browsePage(CONFIG, PAGE, UNRESTRICTED);
			await vi.advanceTimersByTimeAsync(BROWSE_PAGE_LIMITS.rateLimitMaxWaitMs);

			await expect(result).resolves.toEqual({
				ok: false,
				error: BROWSE_PAGE_ERROR.limitReached,
			});
			expect(fetchStub).toHaveBeenCalledTimes(2);
			expect(console.warn).toHaveBeenCalledTimes(2);
		});

		it('never waits longer than its cap, whatever Cloudflare asks', async () => {
			fetchStub
				.mockResolvedValueOnce(rateLimited(3_600))
				.mockResolvedValueOnce(jsonResponse({ success: true, result: '# Kolo' }));

			const result = browsePage(CONFIG, PAGE, UNRESTRICTED);
			await vi.advanceTimersByTimeAsync(BROWSE_PAGE_LIMITS.rateLimitMaxWaitMs);

			await expect(result).resolves.toMatchObject({ ok: true });
			expect(fetchStub).toHaveBeenCalledTimes(2);
		});

		it('reports the spent daily browser time at once, without retrying', async () => {
			fetchStub.mockImplementation(async () => dailyLimited());

			const result = await browsePage(CONFIG, PAGE, UNRESTRICTED);

			expect(result).toEqual({ ok: false, error: BROWSE_PAGE_ERROR.dailyLimitReached });
			expect(fetchStub).toHaveBeenCalledOnce();
			expect(console.warn).toHaveBeenCalledWith(
				'[chat] browse_page failed',
				429,
				expect.stringContaining('Browser time limit exceeded for today'),
			);
		});

		it('stops waiting without a second request when the turn is stopped', async () => {
			fetchStub.mockImplementation(async () => rateLimited(10));
			const turn = new AbortController();

			const result = browsePage(CONFIG, PAGE, {
				signal: turn.signal,
				conversationUrls: null,
			});
			await vi.advanceTimersByTimeAsync(1_000);
			turn.abort();

			await expect(result).resolves.toEqual({
				ok: false,
				error: BROWSE_PAGE_ERROR.pageNotLoaded,
			});
			await vi.advanceTimersByTimeAsync(BROWSE_PAGE_LIMITS.rateLimitMaxWaitMs);
			expect(fetchStub).toHaveBeenCalledOnce();
		});
	});

	it('logs a refused request without the token', async () => {
		fetchStub.mockResolvedValue(
			jsonResponse(
				{ success: false, errors: [{ code: 10000, message: 'Authentication error' }] },
				403,
			),
		);

		await browsePage(CONFIG, { url: 'https://shop.example.cz/kolo' }, UNRESTRICTED);

		expect(console.warn).toHaveBeenCalledOnce();
		expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(CONFIG.apiToken);
	});

	it.each([
		[
			'an error status',
			() =>
				jsonResponse(
					{ success: false, errors: [{ code: 10000, message: 'Authentication error' }] },
					403,
				),
		],
		[
			'an unsuccessful answer',
			() =>
				jsonResponse({
					success: false,
					errors: [{ code: 1, message: 'Navigation failed' }],
				}),
		],
		['an answer without markdown', () => jsonResponse({ success: true, result: 42 })],
		['invalid JSON', () => new Response('<html>oops</html>', { status: 200 })],
	])('reports %s as a page that could not load', async (_label, response) => {
		fetchStub.mockResolvedValue(response());

		const result = await browsePage(
			CONFIG,
			{ url: 'https://shop.example.cz/kolo' },
			UNRESTRICTED,
		);

		expect(result).toEqual({ ok: false, error: BROWSE_PAGE_ERROR.pageNotLoaded });
		expect(JSON.stringify(result)).not.toContain(CONFIG.apiToken);
	});

	it('reports a network failure without the token', async () => {
		fetchStub.mockRejectedValue(new TypeError(`fetch failed for ${CONFIG.apiToken}`));

		const result = await browsePage(
			CONFIG,
			{ url: 'https://shop.example.cz/kolo' },
			UNRESTRICTED,
		);

		expect(result).toEqual({ ok: false, error: BROWSE_PAGE_ERROR.pageNotLoaded });
		expect(JSON.stringify(result)).not.toContain(CONFIG.apiToken);
	});

	it('reports a timed-out request as a slow page', async () => {
		fetchStub.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));

		await expect(
			browsePage(CONFIG, { url: 'https://shop.example.cz/kolo' }, UNRESTRICTED),
		).resolves.toEqual({ ok: false, error: BROWSE_PAGE_ERROR.timedOut });
	});

	it('stops loading when the turn is stopped', async () => {
		fetchStub.mockImplementation(
			(_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
				}),
		);
		const turn = new AbortController();

		const result = browsePage(
			CONFIG,
			{ url: 'https://shop.example.cz/kolo' },
			{ signal: turn.signal, conversationUrls: null },
		);
		turn.abort();

		await expect(result).resolves.toEqual({
			ok: false,
			error: BROWSE_PAGE_ERROR.pageNotLoaded,
		});
	});
});

describe('browsePage in a chat', () => {
	function chatContext(urls: Iterable<string>): BrowsePageContext {
		return { signal: undefined, conversationUrls: new Set(urls) };
	}

	it('opens a page whose address is in the chat, with or without a trailing slash', async () => {
		fetchStub.mockImplementation(async () => jsonResponse({ success: true, result: '# Kolo' }));
		const context = chatContext(['https://shop.example.cz/kolo', 'https://shop.example.cz/']);

		const exact = await browsePage(CONFIG, { url: 'https://shop.example.cz/kolo' }, context);
		const slashed = await browsePage(CONFIG, { url: 'https://shop.example.cz/kolo/' }, context);
		const host = await browsePage(CONFIG, { url: 'https://shop.example.cz' }, context);

		expect([exact.ok, slashed.ok, host.ok]).toEqual([true, true, true]);
	});

	it('refuses a page whose address is not in the chat without loading it', async () => {
		const context = chatContext(['https://shop.example.cz/kolo']);

		await expect(
			browsePage(CONFIG, { url: 'https://attacker.example/?d=Kolo%2012%20990' }, context),
		).resolves.toEqual({ ok: false, error: BROWSE_PAGE_ERROR.urlNotInConversation });
		await expect(
			browsePage(CONFIG, { url: 'https://shop.example.cz/kolo?d=secret' }, context),
		).resolves.toEqual({ ok: false, error: BROWSE_PAGE_ERROR.urlNotInConversation });
		expect(fetchStub).not.toHaveBeenCalled();
	});
});

describe('conversationUrls', () => {
	function userText(text: string): ChatModelMessage {
		return { role: CHAT_ROLE.user, content: [{ type: CHAT_BLOCK.text, text }] };
	}

	function toolRound(name: string, input: unknown, result: unknown): ChatModelMessage[] {
		const id = `call-${name}`;
		return [
			{
				role: CHAT_ROLE.assistant,
				content: [{ type: CHAT_BLOCK.toolCall, id, name, input }],
			},
			{
				role: CHAT_ROLE.user,
				content: [
					{
						type: CHAT_BLOCK.toolResult,
						toolCallId: id,
						content: JSON.stringify(result),
						isError: false,
					},
				],
			},
		];
	}

	it('collects addresses the user wrote, with trailing punctuation trimmed', () => {
		const urls = conversationUrls(
			[
				userText(
					'Doplňte cenu z https://shop.example.cz/kolo. Nebo (https://jiny.example.cz/Kolo?barva=modra)',
				),
			],
			[],
		);

		expect(urls).toContain('https://shop.example.cz/kolo');
		expect(urls).toContain('https://jiny.example.cz/Kolo?barva=modra');
	});

	it('collects the pages web search and web fetch found', () => {
		const urls = conversationUrls([], ['https://www.heureka.cz', 'not a url']);

		expect([...urls]).toEqual(['https://www.heureka.cz/']);
	});

	it('collects addresses in the page an earlier browse_page call opened', () => {
		const messages = toolRound(
			'browse_page',
			{ url: 'https://www.alza.cz/kolo' },
			{ url: 'https://www.alza.cz/kolo', markdown: 'see https://a.example/x\nnext' },
		);

		const urls = conversationUrls(messages, []);

		expect(urls).toContain('https://www.alza.cz/kolo');
		expect(urls).toContain('https://a.example/x');
	});

	it('leaves out addresses a read tool returned, such as a gift link', () => {
		const messages = toolRound(
			'readWishlistGifts',
			{ wishlistShortId: 'abc' },
			{ gifts: [{ name: 'Kolo', links: ['https://www.alza.cz/kolo'] }] },
		);

		expect(conversationUrls(messages, [])).not.toContain('https://www.alza.cz/kolo');
	});

	it('leaves out a stored link the model planted, which saving normalised beyond what it wrote', () => {
		const messages = toolRound(
			'readWishlistGifts',
			{ wishlistShortId: 'abc' },
			{ gifts: [{ name: 'Kolo', links: ['http://attacker.com/?d=x'] }] },
		);

		expect(conversationUrls(messages, [])).not.toContain('http://attacker.com/?d=x');
	});

	it('leaves out addresses a change tool returned', () => {
		const messages = toolRound(
			'createGift',
			{ name: 'Kolo' },
			{ gift: { description: 'https://attacker.example/?d=tajne' } },
		);

		expect(conversationUrls(messages, [])).not.toContain('https://attacker.example/?d=tajne');
	});

	it('leaves out addresses only the assistant wrote', () => {
		const messages: ChatModelMessage[] = [
			{
				role: CHAT_ROLE.assistant,
				content: [
					{ type: CHAT_BLOCK.text, text: 'Otevřu https://attacker.example/d/tajne' },
				],
			},
		];

		expect(conversationUrls(messages, [])).not.toContain('https://attacker.example/d/tajne');
	});

	it('leaves out a browse_page result whose call the history no longer shows', () => {
		const messages = toolRound(
			'browse_page',
			{ url: 'https://www.alza.cz/kolo' },
			{ url: 'https://www.alza.cz/kolo' },
		).slice(1);

		expect(conversationUrls(messages, [])).not.toContain('https://www.alza.cz/kolo');
	});
});
