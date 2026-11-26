import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AGENT_SCOPE } from '$lib/modules/access_tokens/scopes.js';
import { AGENT_CREDENTIAL_KIND, type AgentCaller } from '$lib/server/agent_access/agent_caller.js';
import { OPERATION_CHANNEL } from '$lib/server/operations/actor.js';
import { CHAT_BLOCK } from './chat_model.js';
import { chatToolQuery, chatTools, runChatToolCalls } from './chat_tools.js';

const BROWSE_PAGE_CONFIG = { accountId: 'account-123', apiToken: 'secret-browser-token' };

const CALLER: AgentCaller = {
	credential: { kind: AGENT_CREDENTIAL_KIND.chatSession, id: 'chat-1' },
	fastForward: false,
	grant: {
		userId: 'user-1',
		userName: 'Martin',
		tokenName: 'AI asistent',
		channel: OPERATION_CHANNEL.chatbot,
		scopes: Object.values(AGENT_SCOPE),
		wishlistIds: ['wishlist-1'],
	},
};

const ENVIRONMENT = { imageBucket: undefined, signal: undefined, conversationUrls: null };

function browseCall(url: string) {
	return { id: 'call-1', name: 'browse_page', input: { url } };
}

function errorCodeOf(round: Awaited<ReturnType<typeof runChatToolCalls>>): unknown {
	const [result] = round.results;
	if (result?.type !== CHAT_BLOCK.toolResult || !result.isError) {
		throw new Error(`No tool error among ${JSON.stringify(round.results)}`);
	}
	return (JSON.parse(result.content) as { error: { code: unknown } }).error.code;
}

const fetchStub = vi.fn<typeof fetch>();

beforeEach(() => {
	fetchStub.mockReset();
	vi.stubGlobal('fetch', fetchStub);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('chatTools', () => {
	it('offers browse_page only when the page browser is configured', () => {
		const withoutBrowser = chatTools(CALLER, null).map((tool) => tool.name);
		const withBrowser = chatTools(CALLER, BROWSE_PAGE_CONFIG).map((tool) => tool.name);

		expect(withoutBrowser).not.toContain('browse_page');
		expect(withBrowser).toContain('browse_page');
		expect(withBrowser.filter((name) => name !== 'browse_page')).toEqual(withoutBrowser);
	});

	it('describes browse_page with a required url and no secret', () => {
		const browseTool = chatTools(CALLER, BROWSE_PAGE_CONFIG).find(
			(tool) => tool.name === 'browse_page',
		);

		expect(browseTool?.inputSchema).toMatchObject({
			type: 'object',
			properties: { url: { type: 'string' } },
			required: ['url'],
		});
		expect(JSON.stringify(browseTool)).not.toContain(BROWSE_PAGE_CONFIG.apiToken);
	});
});

describe('runChatToolCalls', () => {
	it('opens the page and returns its markdown without forming a proposal', async () => {
		fetchStub.mockResolvedValue(
			new Response(JSON.stringify({ success: true, result: '# Kolo' }), { status: 200 }),
		);
		const tools = chatTools(CALLER, BROWSE_PAGE_CONFIG);

		const round = await runChatToolCalls(
			CALLER,
			tools,
			'wishlist-1',
			[{ id: 'call-1', name: 'browse_page', input: { url: 'https://shop.example.cz/kolo' } }],
			ENVIRONMENT,
		);

		expect(round.proposal).toBeNull();
		expect(round.results).toEqual([
			{
				type: CHAT_BLOCK.toolResult,
				toolCallId: 'call-1',
				content: JSON.stringify({
					url: 'https://shop.example.cz/kolo',
					markdown: '# Kolo',
					truncated: false,
				}),
				isError: false,
			},
		]);
	});

	it('returns a failed page load as a tool error', async () => {
		const tools = chatTools(CALLER, BROWSE_PAGE_CONFIG);

		const round = await runChatToolCalls(
			CALLER,
			tools,
			'wishlist-1',
			[{ id: 'call-1', name: 'browse_page', input: { url: 'http://localhost/' } }],
			ENVIRONMENT,
		);

		expect(fetchStub).not.toHaveBeenCalled();
		expect(round.proposal).toBeNull();
		const [result] = round.results;
		expect(result?.type === CHAT_BLOCK.toolResult && result.isError).toBe(true);
		expect(result?.type === CHAT_BLOCK.toolResult && JSON.parse(result.content)).toMatchObject({
			error: { code: 'URL_NOT_ALLOWED' },
		});
	});

	it('treats browse_page as unknown when the page browser is not configured', async () => {
		const round = await runChatToolCalls(
			CALLER,
			chatTools(CALLER, null),
			'wishlist-1',
			[{ id: 'call-1', name: 'browse_page', input: { url: 'https://shop.example.cz/kolo' } }],
			ENVIRONMENT,
		);

		expect(fetchStub).not.toHaveBeenCalled();
		expect(errorCodeOf(round)).toBe('UNKNOWN_TOOL');
	});

	it('stops loading the page when the turn is stopped', async () => {
		fetchStub.mockImplementation(
			(_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
				}),
		);
		const turn = new AbortController();

		const round = runChatToolCalls(
			CALLER,
			chatTools(CALLER, BROWSE_PAGE_CONFIG),
			'wishlist-1',
			[browseCall('https://shop.example.cz/kolo')],
			{ ...ENVIRONMENT, signal: turn.signal },
		);
		turn.abort();

		expect(errorCodeOf(await round)).toBe('PAGE_NOT_LOADED');
	});

	it('opens a page whose address is in the chat', async () => {
		fetchStub.mockResolvedValue(
			new Response(JSON.stringify({ success: true, result: '# Kolo' }), { status: 200 }),
		);

		const round = await runChatToolCalls(
			CALLER,
			chatTools(CALLER, BROWSE_PAGE_CONFIG),
			'wishlist-1',
			[browseCall('https://shop.example.cz/kolo')],
			{ ...ENVIRONMENT, conversationUrls: new Set(['https://shop.example.cz/kolo']) },
		);

		expect(fetchStub).toHaveBeenCalledOnce();
		expect(round.results[0]).toMatchObject({ isError: false });
	});

	it('refuses a page whose address is not in the chat without loading it', async () => {
		const round = await runChatToolCalls(
			CALLER,
			chatTools(CALLER, BROWSE_PAGE_CONFIG),
			'wishlist-1',
			[browseCall('https://attacker.example/?d=tajne')],
			{ ...ENVIRONMENT, conversationUrls: new Set(['https://shop.example.cz/kolo']) },
		);

		expect(fetchStub).not.toHaveBeenCalled();
		expect(errorCodeOf(round)).toBe('URL_NOT_IN_CONVERSATION');
	});
});

describe('chatToolQuery', () => {
	it('names the page a browse_page call opens', () => {
		expect(
			chatToolQuery({ name: 'browse_page', input: { url: 'https://shop.example.cz/kolo' } }),
		).toBe('https://shop.example.cz/kolo');
	});

	it('names nothing for other tools or refused addresses', () => {
		expect(
			chatToolQuery({ name: 'readWishlistGifts', input: { url: 'https://a.cz/' } }),
		).toBeNull();
		expect(
			chatToolQuery({ name: 'browse_page', input: { url: 'http://localhost/' } }),
		).toBeNull();
	});
});
