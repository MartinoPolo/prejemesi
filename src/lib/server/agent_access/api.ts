import { dev } from '$app/environment';
import { isHttpError, type Cookies } from '@sveltejs/kit';
import { DEMO_COOKIE_NAME } from '$lib/server/demo/constants.js';
import { findDemoSession } from '$lib/server/demo/session.js';
import {
	SERVER_ERROR,
	WISHLIST_NOT_FOUND_MESSAGE,
	type ServerErrorCode,
} from '$lib/modules/errors/server_error_codes.js';
import { OPERATION_REGISTRY } from '$lib/server/operations/registry.js';
import { OPERATION_KIND } from '$lib/server/operations/operation.js';
import { authenticateAccessToken, type AuthenticatedAccessToken } from './access_tokens.js';
import { authorizeAgentOperation, executeAgentRead } from './authorization.js';
import { hasAgentScope, type AgentAccessGrant } from './agent_grant.js';
import {
	AGENT_OPERATION_POLICIES,
	isOperationName,
	type AgentOperationPolicy,
} from './operation_policies.js';
import { AGENT_API_MAX_BODY_BYTES, AGENT_API_RATE_LIMIT } from './limits.js';

export interface AgentApiRateLimit {
	limit(input: { key: string }): Promise<{ success: boolean }>;
}

interface AgentApiEvent {
	request: Request;
	cookies: Pick<Cookies, 'get'>;
	platform?: { env: { AGENT_API_RATE_LIMIT?: AgentApiRateLimit } };
}

/** A JSON request body as received and as parsed. */
export interface AgentApiRequestBody {
	/** The exact text, e.g. for fingerprinting a request. */
	rawText: string;
	parsed: unknown;
}

interface AgentApiCall<TBody> {
	token: AuthenticatedAccessToken;
	body: TBody;
}

/** What an endpoint answers; the status defaults to 200. */
export interface AgentApiResponse {
	body: unknown;
	status?: number;
	headers?: Record<string, string>;
}

type AgentApiHandler<TBody, TEvent> = (
	call: AgentApiCall<TBody>,
	event: TEvent,
) => Promise<AgentApiResponse>;

/** English messages for the agent API's own codes; other codes are their own message. */
const AGENT_ERROR_MESSAGES: Partial<Record<ServerErrorCode, string>> = {
	[SERVER_ERROR.AGENT_TOKEN_INVALID]: 'The access token is missing, malformed or unknown.',
	[SERVER_ERROR.AGENT_TOKEN_EXPIRED]: 'The access token has expired.',
	[SERVER_ERROR.AGENT_TOKEN_REVOKED]: 'The access token has been revoked.',
	[SERVER_ERROR.AGENT_DEMO_NOT_ALLOWED]: 'The demo cannot use the API.',
	[SERVER_ERROR.AGENT_SCOPE_MISSING]: 'The access token lacks the scope this operation needs.',
	[SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED]: 'The access token is limited to other wishlists.',
	[SERVER_ERROR.AGENT_OPERATION_NOT_FOUND]: 'No such operation is available to agents.',
	[SERVER_ERROR.AGENT_MUTATION_REQUIRES_PROPOSAL]:
		'Changes are submitted as proposals for the user to review.',
	[SERVER_ERROR.AGENT_BATCH_TOO_LARGE]: 'The batch has more items than allowed.',
	[SERVER_ERROR.AGENT_RATE_LIMITED]: 'Too many requests for this access token.',
	[SERVER_ERROR.AGENT_RATE_LIMIT_UNAVAILABLE]: 'The request rate limit is unavailable.',
	[SERVER_ERROR.AGENT_REQUEST_INVALID]: 'The request body is not valid JSON.',
	[SERVER_ERROR.AGENT_REQUEST_TOO_LARGE]: 'The request body is too large.',
	[SERVER_ERROR.AGENT_UNSUPPORTED_MEDIA_TYPE]: 'The request body must be application/json.',
	[SERVER_ERROR.AGENT_INTERNAL_ERROR]: 'The request failed unexpectedly.',
};

/** Codes for plain-text errors from the core, which carry no code of their own. */
const STATUS_ERROR_CODES: Partial<Record<number, ServerErrorCode>> = {
	400: SERVER_ERROR.BAD_REQUEST,
	401: SERVER_ERROR.UNAUTHORIZED,
	403: SERVER_ERROR.FORBIDDEN,
	404: SERVER_ERROR.NOT_FOUND,
	409: SERVER_ERROR.CONFLICT,
	410: SERVER_ERROR.GONE,
};

const SERVER_ERROR_CODES = new Set<string>(Object.values(SERVER_ERROR));

/** A failure the API answers with its own status, details and headers. */
export class AgentApiFailure extends Error {
	constructor(
		readonly status: number,
		readonly code: ServerErrorCode,
		readonly details: Record<string, string | number> = {},
		readonly headers: Record<string, string> = {},
	) {
		super(code);
	}
}

function agentApiJson(body: unknown, status: number, headers: Record<string, string> = {}) {
	return Response.json(body, {
		status,
		headers: { 'cache-control': 'no-store', ...headers },
	});
}

function errorBody(code: string, details: Record<string, unknown> = {}, message?: string) {
	const codeMessage = isServerErrorCode(code) ? AGENT_ERROR_MESSAGES[code] : undefined;
	return { error: { ...details, code, message: message ?? codeMessage ?? code } };
}

function isServerErrorCode(value: unknown): value is ServerErrorCode {
	return typeof value === 'string' && SERVER_ERROR_CODES.has(value);
}

/** A core error message is a code, a JSON-encoded code with parameters, or plain text. */
function httpErrorBody(status: number, message: string) {
	if (isServerErrorCode(message)) {
		return errorBody(message);
	}
	if (message === WISHLIST_NOT_FOUND_MESSAGE) {
		return errorBody(SERVER_ERROR.WISHLIST_NOT_FOUND, {}, message);
	}
	try {
		const parsed: unknown = JSON.parse(message);
		if (typeof parsed === 'object' && parsed !== null && 'code' in parsed) {
			const { code, ...details } = parsed;
			if (isServerErrorCode(code)) {
				return errorBody(code, details);
			}
		}
	} catch {
		// Plain text.
	}
	return errorBody(STATUS_ERROR_CODES[status] ?? SERVER_ERROR.REQUEST_FAILED, {}, message);
}

function agentApiErrorResponse(thrown: unknown): Response {
	if (thrown instanceof AgentApiFailure) {
		return agentApiJson(errorBody(thrown.code, thrown.details), thrown.status, thrown.headers);
	}
	if (isHttpError(thrown) && thrown.status < 500) {
		return agentApiJson(httpErrorBody(thrown.status, thrown.body.message), thrown.status);
	}
	console.error('[agent-api] request failed', thrown);
	const status = isHttpError(thrown) ? thrown.status : 500;
	return agentApiJson(errorBody(SERVER_ERROR.AGENT_INTERNAL_ERROR), status);
}

/** The API never acts for a live demo, even though it authenticates by token, not cookie. */
async function rejectLiveDemo(event: AgentApiEvent): Promise<void> {
	const demoToken = event.cookies.get(DEMO_COOKIE_NAME);
	if (demoToken === undefined || demoToken === '') {
		return;
	}
	if ((await findDemoSession(demoToken)) !== null) {
		throw new AgentApiFailure(403, SERVER_ERROR.AGENT_DEMO_NOT_ALLOWED);
	}
}

/**
 * Per-token request limit from the Workers binding. Without the binding production fails closed;
 * the Vite dev server has no Workers bindings, so development allows the request.
 */
async function enforceRateLimit(
	rateLimit: AgentApiRateLimit | undefined,
	tokenId: string,
): Promise<void> {
	if (rateLimit === undefined) {
		if (dev) {
			return;
		}
		throw new AgentApiFailure(503, SERVER_ERROR.AGENT_RATE_LIMIT_UNAVAILABLE);
	}
	let success: boolean;
	try {
		({ success } = await rateLimit.limit({ key: tokenId }));
	} catch {
		throw new AgentApiFailure(503, SERVER_ERROR.AGENT_RATE_LIMIT_UNAVAILABLE);
	}
	if (!success) {
		const retryAfterSeconds = AGENT_API_RATE_LIMIT.periodSeconds;
		throw new AgentApiFailure(
			429,
			SERVER_ERROR.AGENT_RATE_LIMITED,
			{ retryAfterSeconds },
			{ 'retry-after': String(retryAfterSeconds) },
		);
	}
}

function requestTooLarge(): AgentApiFailure {
	return new AgentApiFailure(413, SERVER_ERROR.AGENT_REQUEST_TOO_LARGE, {
		maxBytes: AGENT_API_MAX_BODY_BYTES,
	});
}

/** Reads the body up to the cap, so an oversized chunked body is never buffered whole. */
async function readCappedBodyText(request: Request): Promise<string> {
	if (request.body === null) {
		return '';
	}
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let byteLength = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			byteLength += value.byteLength;
			if (byteLength > AGENT_API_MAX_BODY_BYTES) {
				await reader.cancel();
				throw requestTooLarge();
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const bytes = new Uint8Array(byteLength);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(bytes);
}

async function readJsonBody(request: Request): Promise<AgentApiRequestBody> {
	const mediaType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
	if (mediaType !== 'application/json') {
		throw new AgentApiFailure(415, SERVER_ERROR.AGENT_UNSUPPORTED_MEDIA_TYPE);
	}
	// A missing or non-numeric Content-Length is not trusted; the capped read still applies.
	const declaredLength = Number(request.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > AGENT_API_MAX_BODY_BYTES) {
		throw requestTooLarge();
	}
	const rawText = await readCappedBodyText(request);
	try {
		return { rawText, parsed: JSON.parse(rawText) };
	} catch {
		throw new AgentApiFailure(400, SERVER_ERROR.AGENT_REQUEST_INVALID);
	}
}

function createAgentApiEndpoint<TBody, TEvent extends AgentApiEvent>(
	readBody: (request: Request) => Promise<TBody>,
	handler: AgentApiHandler<TBody, TEvent>,
) {
	return async (event: TEvent): Promise<Response> => {
		try {
			await rejectLiveDemo(event);
			// Authentication precedes the per-token limit, which needs the token id. An invalid
			// token costs one indexed hash lookup, and 256-bit secrets make guessing infeasible.
			const token = await authenticateAccessToken(event.request.headers.get('authorization'));
			await enforceRateLimit(event.platform?.env.AGENT_API_RATE_LIMIT, token.tokenId);
			const body = await readBody(event.request);
			const response = await handler({ token, body }, event);
			return agentApiJson(response.body, response.status ?? 200, response.headers);
		} catch (thrown) {
			return agentApiErrorResponse(thrown);
		}
	};
}

const readsNoBody = async (): Promise<undefined> => undefined;

/**
 * One `/api/v1` endpoint without a request body: rejects a live demo, authenticates the bearer
 * token, applies the token's request limit, and answers every failure as
 * `{ "error": { "code", "message", ... } }` without internals.
 */
export function agentApiEndpoint<TEvent extends AgentApiEvent>(
	handler: AgentApiHandler<undefined, TEvent>,
) {
	return createAgentApiEndpoint(readsNoBody, handler);
}

/** Like `agentApiEndpoint`, for endpoints that take a JSON body within the size cap. */
export function agentApiJsonEndpoint<TEvent extends AgentApiEvent>(
	handler: AgentApiHandler<AgentApiRequestBody, TEvent>,
) {
	return createAgentApiEndpoint(readJsonBody, handler);
}

function agentMutationPolicy(operationName: string) {
	if (!isOperationName(operationName)) {
		return null;
	}
	const policy: AgentOperationPolicy<unknown, unknown> | null =
		AGENT_OPERATION_POLICIES[operationName];
	return OPERATION_REGISTRY[operationName].kind === OPERATION_KIND.mutation ? policy : null;
}

/**
 * Runs an agent operation. Reads run directly; a change within the token's scopes answers 409,
 * since changes arrive as reviewed proposals instead.
 */
export async function runAgentApiOperation(
	grant: AgentAccessGrant,
	operationName: string,
	input: unknown,
): Promise<unknown> {
	const mutationPolicy = agentMutationPolicy(operationName);
	if (mutationPolicy !== null) {
		if (!hasAgentScope(grant, mutationPolicy.scope)) {
			throw new AgentApiFailure(403, SERVER_ERROR.AGENT_SCOPE_MISSING);
		}
		throw new AgentApiFailure(409, SERVER_ERROR.AGENT_MUTATION_REQUIRES_PROPOSAL);
	}
	return executeAgentRead(grant, await authorizeAgentOperation(grant, operationName, input));
}
