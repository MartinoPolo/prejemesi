import * as v from 'valibot';
import { CHAT_BROWSE_TOOL } from '$lib/modules/chat/types.js';
import { CHAT_BLOCK, CHAT_ROLE, type ChatModelMessage, type ChatModelTool } from './chat_model.js';

/**
 * The chat's `browse_page` tool: Cloudflare Browser Run's `/markdown` quick action opens a page in
 * a headless browser and returns its rendered text, for pages the provider's web fetch cannot read.
 * The REST API is used instead of the Worker `browser` binding, which needs a newer compatibility
 * date than the app's.
 */

export interface BrowsePageConfig {
	accountId: string;
	apiToken: string;
}

/** What one page load runs with: the turn's abort signal and the pages the chat may open. */
export interface BrowsePageContext {
	signal: AbortSignal | undefined;
	/** Normalised hrefs from `conversationUrls`; null lets any public page open. */
	conversationUrls: ReadonlySet<string> | null;
}

export const BROWSE_PAGE_LIMITS = {
	urlMaxLength: 2048,
	/** Cloudflare's page load bound; below the request timeout so Cloudflare reports it first. */
	pageLoadTimeoutMs: 30_000,
	requestTimeoutMs: 45_000,
	markdownMaxLength: 30_000,
} as const;

/** Images, media, fonts and styles do not change the text, so the browser skips loading them. */
const REJECTED_RESOURCE_TYPES = ['image', 'media', 'font', 'stylesheet'];

export const BROWSE_PAGE_ERROR = {
	urlNotAllowed: {
		code: 'URL_NOT_ALLOWED',
		message: `Only public http and https pages up to ${BROWSE_PAGE_LIMITS.urlMaxLength} characters can be opened.`,
	},
	urlNotInConversation: {
		code: 'URL_NOT_IN_CONVERSATION',
		message:
			'Only pages whose address came from the user, a web search or fetch result, or a page already opened in this chat can be opened.',
	},
	limitReached: {
		code: 'BROWSER_LIMIT_REACHED',
		message: 'The browser has reached its rate or daily limit. Try again later.',
	},
	timedOut: { code: 'PAGE_TIMED_OUT', message: 'The page took too long to load.' },
	pageNotLoaded: { code: 'PAGE_NOT_LOADED', message: 'The page could not be loaded.' },
} as const;

type BrowsePageError = (typeof BROWSE_PAGE_ERROR)[keyof typeof BROWSE_PAGE_ERROR];

export type BrowsePageResult =
	| { ok: true; page: { url: string; markdown: string; truncated: boolean } }
	| { ok: false; error: BrowsePageError };

export const browsePageTool: ChatModelTool = {
	name: CHAT_BROWSE_TOOL,
	description:
		'Opens a page in a real browser and returns its rendered text as markdown. Use it when web fetch returns little or no content (pages rendered by JavaScript) or fails. It is slow and rate-limited, so open one page at a time and only pages worth reading.',
	inputSchema: {
		type: 'object',
		properties: {
			url: {
				type: 'string',
				description: 'The full http or https address of the page.',
				maxLength: BROWSE_PAGE_LIMITS.urlMaxLength,
			},
		},
		required: ['url'],
		additionalProperties: false,
	},
};

const MarkdownResponseSchema = v.object({ success: v.literal(true), result: v.string() });

const FailureResponseSchema = v.object({
	errors: v.array(v.object({ code: v.optional(v.number()), message: v.optional(v.string()) })),
});

const IPV4_ADDRESS = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u;

/** Loopback, private, shared, link-local and unspecified IPv4 ranges. */
function isNonPublicIpv4(first: number, second: number): boolean {
	return (
		first === 0 ||
		first === 10 ||
		first === 127 ||
		(first === 100 && second >= 64 && second <= 127) ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 168)
	);
}

/**
 * The page loads on Cloudflare's network, not the app's, so this is defence in depth only. The URL
 * parser already normalises numeric IPv4 forms, and IPv6 literals have no dot.
 */
function isAllowedHostname(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/\.$/u, '');
	if (!host.includes('.') || host.endsWith('.localhost')) {
		return false;
	}
	const ipv4 = IPV4_ADDRESS.exec(host);
	return ipv4 === null || !isNonPublicIpv4(Number(ipv4[1]), Number(ipv4[2]));
}

/** The page address the tool may open, or null. */
function allowedBrowseUrl(candidate: unknown): URL | null {
	if (typeof candidate !== 'string' || candidate.length > BROWSE_PAGE_LIMITS.urlMaxLength) {
		return null;
	}
	let url: URL;
	try {
		url = new URL(candidate);
	} catch {
		return null;
	}
	const isWebProtocol = url.protocol === 'http:' || url.protocol === 'https:';
	const hasCredentials = url.username !== '' || url.password !== '';
	return isWebProtocol && !hasCredentials && isAllowedHostname(url.hostname) ? url : null;
}

/** The page address of a `browse_page` call's input, if the tool may open it. */
export function allowedBrowseUrlFromInput(input: unknown): URL | null {
	return allowedBrowseUrl(
		typeof input === 'object' && input !== null ? Reflect.get(input, 'url') : undefined,
	);
}

/** Stops at quotes and backslashes too, so addresses inside JSON tool results end where they do. */
const URL_IN_TEXT = /https?:\/\/[^\s"'<>\\`]+/giu;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/u;

function addNormalisedUrl(urls: Set<string>, candidate: string): void {
	try {
		urls.add(new URL(candidate).href);
	} catch {
		// Not an address after all; it names no page.
	}
}

function addUrlsInText(urls: Set<string>, text: string): void {
	for (const [match] of text.matchAll(URL_IN_TEXT)) {
		addNormalisedUrl(urls, match);
		addNormalisedUrl(urls, match.replace(TRAILING_PUNCTUATION, ''));
	}
}

/** The same address with its path's trailing slash added or removed. */
function slashToggledHref(href: string): string {
	const url = new URL(href);
	url.pathname = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : `${url.pathname}/`;
	return url.href;
}

/**
 * The page addresses the chat may open, as web fetch rules them (an address must already be in the
 * conversation), from sources the model cannot write: the user's text, the pages the provider's web
 * tools found this turn, and the pages earlier `browse_page` calls opened. Other tool results never
 * count: the model writes gift data, which persists across sessions and is normalised on save, so a
 * prompt injection could plant an address that carries private data to another site and read it
 * back later.
 */
export function conversationUrls(
	messages: readonly ChatModelMessage[],
	webSourceUrls: Iterable<string>,
): Set<string> {
	const blocks = messages.flatMap((message) => message.content);
	const browseCallIds = new Set(
		blocks.flatMap((block) =>
			block.type === CHAT_BLOCK.toolCall && block.name === CHAT_BROWSE_TOOL ? [block.id] : [],
		),
	);
	const urls = new Set<string>();
	for (const message of messages) {
		for (const block of message.content) {
			if (block.type === CHAT_BLOCK.text && message.role === CHAT_ROLE.user) {
				addUrlsInText(urls, block.text);
			} else if (
				block.type === CHAT_BLOCK.toolResult &&
				browseCallIds.has(block.toolCallId)
			) {
				addUrlsInText(urls, block.content);
			}
		}
	}
	for (const url of webSourceUrls) {
		addNormalisedUrl(urls, url);
	}
	return urls;
}

/** Whether the address, or the same address with or without a trailing slash, is in the chat. */
function isUrlInConversation(url: URL, urls: ReadonlySet<string> | null): boolean {
	return urls === null || urls.has(url.href) || urls.has(slashToggledHref(url.href));
}

function failed(error: BrowsePageError): BrowsePageResult {
	return { ok: false, error };
}

function isTimeout(thrown: unknown): boolean {
	return thrown instanceof Error && thrown.name === 'TimeoutError';
}

async function cloudflareErrorSummary(response: Response): Promise<string> {
	try {
		const parsed = v.safeParse(FailureResponseSchema, await response.json());
		return parsed.success
			? parsed.output.errors
					.map((error) => `${error.code ?? ''} ${error.message ?? ''}`)
					.join('; ')
			: '';
	} catch {
		return '';
	}
}

/**
 * Opens the page of the tool call's input and returns its markdown, cut at the length cap. Never
 * throws: every failure becomes an error the model can relay.
 */
export async function browsePage(
	config: BrowsePageConfig,
	input: unknown,
	{ signal, conversationUrls: allowedUrls }: BrowsePageContext,
): Promise<BrowsePageResult> {
	const url = allowedBrowseUrlFromInput(input);
	if (url === null) {
		return failed(BROWSE_PAGE_ERROR.urlNotAllowed);
	}
	if (!isUrlInConversation(url, allowedUrls)) {
		return failed(BROWSE_PAGE_ERROR.urlNotInConversation);
	}
	const timeout = AbortSignal.timeout(BROWSE_PAGE_LIMITS.requestTimeoutMs);
	try {
		const response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/browser-rendering/markdown`,
			{
				method: 'POST',
				headers: {
					authorization: `Bearer ${config.apiToken}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					url: url.href,
					gotoOptions: {
						waitUntil: 'networkidle2',
						timeout: BROWSE_PAGE_LIMITS.pageLoadTimeoutMs,
					},
					rejectResourceTypes: REJECTED_RESOURCE_TYPES,
				}),
				signal: signal === undefined ? timeout : AbortSignal.any([timeout, signal]),
			},
		);
		if (response.status === 429) {
			return failed(BROWSE_PAGE_ERROR.limitReached);
		}
		if (!response.ok) {
			console.warn(
				'[chat] browse_page failed',
				response.status,
				await cloudflareErrorSummary(response),
			);
			return failed(BROWSE_PAGE_ERROR.pageNotLoaded);
		}
		const parsed = v.safeParse(MarkdownResponseSchema, await response.json());
		if (!parsed.success) {
			return failed(BROWSE_PAGE_ERROR.pageNotLoaded);
		}
		const markdown = parsed.output.result;
		const truncated = markdown.length > BROWSE_PAGE_LIMITS.markdownMaxLength;
		return {
			ok: true,
			page: {
				url: url.href,
				markdown: truncated
					? markdown.slice(0, BROWSE_PAGE_LIMITS.markdownMaxLength)
					: markdown,
				truncated,
			},
		};
	} catch (thrown) {
		return failed(
			isTimeout(thrown) ? BROWSE_PAGE_ERROR.timedOut : BROWSE_PAGE_ERROR.pageNotLoaded,
		);
	}
}
