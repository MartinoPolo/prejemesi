import { dev } from '$app/environment';
import { isHttpError, type Cookies } from '@sveltejs/kit';
import { DEMO_COOKIE_NAME } from '$lib/server/demo/constants.js';
import { findDemoSession } from '$lib/server/demo/session.js';
import { SERVER_ERROR, type ServerErrorCode } from '$lib/modules/errors/server_error_codes.js';
import { OPERATION_REGISTRY } from '$lib/server/operations/registry.js';
import { OPERATION_KIND } from '$lib/server/operations/operation.js';
import { settleBestEffort } from '$lib/server/operations/runner.js';
import {
	authenticateAccessToken,
	bearerValue,
	isPersonalAccessTokenValue,
} from './access_tokens.js';
import {
	credentialRateLimitKey,
	keepsIdempotencyKeys,
	type AgentCaller,
	type AgentCredential,
} from './agent_caller.js';
import type { OauthAccessVerifier } from './oauth_access.js';
import { authorizeAgentOperation, executeAgentRead } from './authorization.js';
import { requireAgentScope, type AgentAccessGrant } from './agent_grant.js';
import {
	AGENT_OPERATION_POLICIES,
	isOperationName,
	type AgentOperationPolicy,
} from './operation_policies.js';
import { AGENT_API_MAX_BODY_BYTES, AGENT_API_RATE_LIMIT } from './limits.js';
import { describeServerError, isServerErrorCode } from './server_error_description.js';
import { AGENT_API_BASE_PATH } from './api_paths.js';
import {
	IDEMPOTENCY_CLAIM,
	IDEMPOTENCY_KEY_HEADER,
	IDEMPOTENCY_KEY_MAX_LENGTH,
	claimIdempotencyKey,
	fingerprintRequest,
	isValidIdempotencyKey,
	releaseIdempotencyKey,
	storeIdempotentResponse,
} from './idempotency.js';

export interface AgentApiRateLimit {
	limit(input: { key: string }): Promise<{ success: boolean }>;
}

/** What the agent surfaces read from a SvelteKit request event. */
export interface AgentApiEvent {
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
	caller: AgentCaller;
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
	[SERVER_ERROR.AGENT_MUTATION_REQUIRES_PROPOSAL]: `Changes are submitted as proposals for the user to review: POST ${AGENT_API_BASE_PATH}/proposals.`,
	[SERVER_ERROR.AGENT_BATCH_TOO_LARGE]: 'The batch has more items than allowed.',
	[SERVER_ERROR.AGENT_RATE_LIMITED]: 'Too many requests for this access token.',
	[SERVER_ERROR.AGENT_RATE_LIMIT_UNAVAILABLE]: 'The request rate limit is unavailable.',
	[SERVER_ERROR.AGENT_REQUEST_INVALID]: 'The request body is not valid JSON.',
	[SERVER_ERROR.AGENT_REQUEST_TOO_LARGE]: 'The request body is too large.',
	[SERVER_ERROR.AGENT_UNSUPPORTED_MEDIA_TYPE]: 'The request body must be application/json.',
	[SERVER_ERROR.AGENT_INTERNAL_ERROR]: 'The request failed unexpectedly.',
	[SERVER_ERROR.AGENT_DAILY_CHANGE_BUDGET_EXCEEDED]:
		'The daily change budget of the access token user is used up.',
	[SERVER_ERROR.AGENT_IDEMPOTENCY_KEY_INVALID]:
		'The Idempotency-Key header must be 1 to 255 printable ASCII characters without spaces.',
	[SERVER_ERROR.AGENT_IDEMPOTENCY_KEY_REUSED]:
		'The Idempotency-Key was already used for a different request.',
	[SERVER_ERROR.AGENT_IDEMPOTENCY_IN_PROGRESS]:
		'A request with this Idempotency-Key is still in progress.',
	[SERVER_ERROR.AGENT_PROPOSAL_INVALID]:
		'The proposal must name at most one wishlist and list operations that change it.',
	[SERVER_ERROR.AGENT_PROPOSAL_NOT_A_CHANGE]: 'A proposal lists changes only, not reads.',
	[SERVER_ERROR.AGENT_PROPOSAL_WISHLIST_MISMATCH]:
		'Every operation of a proposal must change the wishlist the proposal names.',
	[SERVER_ERROR.AGENT_WISHLIST_CREATION_REQUIRES_FAST_FORWARD]:
		'Only an unrestricted fast-forward token creates wishlists, in a proposal naming no wishlist.',
	[SERVER_ERROR.AGENT_PROPOSAL_NOT_FOUND]: 'No such proposal by this user.',
	[SERVER_ERROR.AGENT_PROPOSAL_EXPIRED]: 'The proposal has expired.',
	[SERVER_ERROR.AGENT_PROPOSAL_NOT_PENDING]:
		'The proposal was already applied, discarded or undone.',
	[SERVER_ERROR.AGENT_PROPOSAL_NOT_APPLIED]: 'Only an applied proposal can be undone.',
	[SERVER_ERROR.AGENT_PROPOSAL_SELECTION_INVALID]:
		'The selected rows include unknown, repeated or rejected rows.',
	[SERVER_ERROR.AGENT_PROPOSAL_UNDO_UNSUPPORTED]:
		'The applied proposal includes changes undo cannot reverse.',
	[SERVER_ERROR.AGENT_PROPOSAL_REVIEW_REQUIRED]:
		'The user applies this proposal on its review page: only the fast-forward token that submitted it applies it, and only while every row is ready.',
	[SERVER_ERROR.AGENT_IMAGE_INPUT_UNSUPPORTED]: `Image URLs and storage keys are not accepted. Only operations whose input schema lists imageReference take an image, from POST ${AGENT_API_BASE_PATH}/images; wishlist images and imported drafts take none.`,
	[SERVER_ERROR.AGENT_IMAGE_REQUEST_INVALID]:
		'The request must give an image url and exactly one of wishlistId or wishlistShortId.',
	[SERVER_ERROR.AGENT_IMAGE_URL_INVALID]:
		'The image url must be an HTTPS URL without credentials.',
	[SERVER_ERROR.AGENT_IMAGE_HOST_BLOCKED]:
		'The image url, or a redirect, names an IP address, a local host or a non-default port.',
	[SERVER_ERROR.AGENT_IMAGE_TOO_LARGE]: 'The image is larger than allowed.',
	[SERVER_ERROR.AGENT_IMAGE_UNSUPPORTED_TYPE]: 'The image must be JPEG, PNG, WebP or GIF.',
	[SERVER_ERROR.AGENT_IMAGE_SIGNATURE_MISMATCH]:
		'The downloaded bytes are not an image of the declared type.',
	[SERVER_ERROR.AGENT_IMAGE_DIMENSIONS_INVALID]: 'The image has no width or height.',
	[SERVER_ERROR.AGENT_IMAGE_FETCH_FAILED]:
		'The image could not be downloaded: an error status, a timeout or too many redirects.',
	[SERVER_ERROR.AGENT_IMAGE_STORAGE_UNAVAILABLE]: 'Image storage is unavailable.',
	[SERVER_ERROR.AGENT_DAILY_IMAGE_BUDGET_EXCEEDED]:
		'The daily image budget of the access token user is used up.',
	[SERVER_ERROR.AGENT_IMAGE_REFERENCE_INVALID]:
		'The imageReference is unknown, belongs to another user or wishlist, or is repeated.',
	[SERVER_ERROR.AGENT_IMAGE_REFERENCE_EXPIRED]: 'The imageReference has expired.',
	[SERVER_ERROR.AGENT_IMAGE_REFERENCE_USED]: 'The imageReference is already attached to a gift.',
};

/** A failure the API answers with its own status, details and headers. */
export class AgentApiFailure extends Error {
	constructor(
		readonly status: number,
		readonly code: ServerErrorCode,
		readonly details: Record<string, unknown> = {},
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

/** The body of every failure. */
export interface AgentApiErrorBody {
	error: { code: string; message: string; [detail: string]: unknown };
}

function errorBody(
	code: string,
	details: Record<string, unknown> = {},
	message?: string,
): AgentApiErrorBody {
	const codeMessage = isServerErrorCode(code) ? AGENT_ERROR_MESSAGES[code] : undefined;
	return { error: { ...details, code, message: message ?? codeMessage ?? code } };
}

/** A core error message is a code, a JSON-encoded code with parameters, or plain text. */
function httpErrorBody(status: number, message: string) {
	const { code, details, plainMessage } = describeServerError(status, message);
	return errorBody(code, details, plainMessage);
}

/** What a failure answers: `{ "error": { "code", "message", ... } }`, without internals. */
export function describeAgentApiFailure(thrown: unknown): {
	status: number;
	body: AgentApiErrorBody;
	headers: Record<string, string>;
} {
	if (thrown instanceof AgentApiFailure) {
		return {
			status: thrown.status,
			body: errorBody(thrown.code, thrown.details),
			headers: thrown.headers,
		};
	}
	if (isHttpError(thrown) && thrown.status < 500) {
		return {
			status: thrown.status,
			body: httpErrorBody(thrown.status, thrown.body.message),
			headers: {},
		};
	}
	console.error('[agent-api] request failed', thrown);
	return {
		status: isHttpError(thrown) ? thrown.status : 500,
		body: errorBody(SERVER_ERROR.AGENT_INTERNAL_ERROR),
		headers: {},
	};
}

function agentApiErrorResponse(thrown: unknown): Response {
	const { status, body, headers } = describeAgentApiFailure(thrown);
	return agentApiJson(body, status, headers);
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
 * Per-credential request limit from the Workers binding. Without the binding production fails
 * closed; the Vite dev server has no Workers bindings, so development allows the request.
 */
async function enforceRateLimit(
	rateLimit: AgentApiRateLimit | undefined,
	credential: AgentCredential,
): Promise<void> {
	if (rateLimit === undefined) {
		if (dev) {
			return;
		}
		throw new AgentApiFailure(503, SERVER_ERROR.AGENT_RATE_LIMIT_UNAVAILABLE);
	}
	let success: boolean;
	try {
		({ success } = await rateLimit.limit({ key: credentialRateLimitKey(credential) }));
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

export async function readJsonBody(request: Request): Promise<AgentApiRequestBody> {
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

/**
 * The caller of an agent request, for every agent surface (`/api/v1` and MCP): rejects a live
 * demo, resolves the credential to the user it acts for, and applies its request limit. A
 * personal access token works everywhere; an app's OAuth access token only where the surface
 * passes `oauth`, so an app never reaches beyond the resource its token is bound to.
 */
export async function authenticateAgentRequest(
	event: AgentApiEvent,
	oauth?: OauthAccessVerifier,
): Promise<AgentCaller> {
	await rejectLiveDemo(event);
	// Authentication precedes the per-credential limit, which needs the credential id. An invalid
	// token costs one indexed hash lookup or one signature check, so guessing stays infeasible.
	const authorization = event.request.headers.get('authorization');
	const bearer = bearerValue(authorization);
	const caller =
		oauth !== undefined && bearer !== null && !isPersonalAccessTokenValue(bearer)
			? await oauth.authenticate(bearer)
			: await authenticateAccessToken(authorization);
	await enforceRateLimit(event.platform?.env.AGENT_API_RATE_LIMIT, caller.credential);
	return caller;
}

function createAgentApiEndpoint<TBody, TEvent extends AgentApiEvent>(
	readBody: (request: Request) => Promise<TBody>,
	handler: AgentApiHandler<TBody, TEvent>,
) {
	return async (event: TEvent): Promise<Response> => {
		try {
			const caller = await authenticateAgentRequest(event);
			const body = await readBody(event.request);
			const response = await handler({ caller, body }, event);
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

const IDEMPOTENT_REPLAY_HEADER = 'idempotent-replayed';

function isSuccessStatus(status: number): boolean {
	return status >= 200 && status < 300;
}

/**
 * Like `agentApiJsonEndpoint`, for mutating endpoints: an optional `Idempotency-Key` header makes
 * a retry replay the stored success instead of repeating the change. The key belongs to the
 * token; reusing it for a different request is 422, and while the first request still runs, 409.
 *
 * A failed request frees its key so a retry runs again, which is only safe because the handler is
 * all-or-nothing up to that point: once its change committed it must return success, never
 * throw. Storing and freeing the key are best effort; a store that fails still answers the
 * success, and a release that fails never hides the handler's own error.
 */
export function agentApiIdempotentJsonEndpoint<TEvent extends AgentApiEvent>(
	handler: AgentApiHandler<AgentApiRequestBody, TEvent>,
) {
	return createAgentApiEndpoint(readJsonBody, async (call, event: TEvent) =>
		runIdempotently(
			{
				credential: call.caller.credential,
				key: event.request.headers.get(IDEMPOTENCY_KEY_HEADER),
				method: event.request.method,
				path: new URL(event.request.url).pathname,
				body: call.body.parsed,
			},
			() => handler(call, event),
		),
	);
}

/** One change request, identified for idempotency by its credential, method, path and body. */
export interface IdempotentRequest {
	credential: AgentCredential;
	/** Null runs the request without idempotency. */
	key: string | null;
	method: string;
	path: string;
	body: unknown;
}

/**
 * Runs a change at most once per idempotency key, with the semantics `agentApiIdempotentJsonEndpoint`
 * documents; every agent surface shares the token's keys.
 */
export async function runIdempotently(
	request: IdempotentRequest,
	handler: () => Promise<AgentApiResponse>,
): Promise<AgentApiResponse> {
	const { key, credential } = request;
	if (key === null || !keepsIdempotencyKeys(credential)) {
		return handler();
	}
	if (!isValidIdempotencyKey(key)) {
		throw new AgentApiFailure(400, SERVER_ERROR.AGENT_IDEMPOTENCY_KEY_INVALID, {
			maxLength: IDEMPOTENCY_KEY_MAX_LENGTH,
		});
	}
	const scope = {
		credential,
		key,
		fingerprint: await fingerprintRequest(request.method, request.path, request.body),
	};
	const claim = await claimIdempotencyKey(scope);
	switch (claim.kind) {
		case IDEMPOTENCY_CLAIM.replay:
			return {
				body: claim.body,
				status: claim.status,
				headers: { [IDEMPOTENT_REPLAY_HEADER]: 'true' },
			};
		case IDEMPOTENCY_CLAIM.reused:
			throw new AgentApiFailure(422, SERVER_ERROR.AGENT_IDEMPOTENCY_KEY_REUSED);
		case IDEMPOTENCY_CLAIM.inProgress:
			throw new AgentApiFailure(409, SERVER_ERROR.AGENT_IDEMPOTENCY_IN_PROGRESS);
		case IDEMPOTENCY_CLAIM.claimed:
			break;
		default: {
			const unhandled: never = claim;
			throw new Error(`Unknown idempotency claim ${JSON.stringify(unhandled)}`);
		}
	}
	let response: AgentApiResponse;
	try {
		response = await handler();
	} catch (thrown) {
		await settleBestEffort('Idempotency key release', () => releaseIdempotencyKey(scope));
		throw thrown;
	}
	const status = response.status ?? 200;
	if (isSuccessStatus(status)) {
		// The stored body is what JSON serialization sends, so a replay matches byte for byte.
		const storedBody: unknown = JSON.parse(JSON.stringify(response.body ?? null));
		await settleBestEffort('Idempotent response store', () =>
			storeIdempotentResponse(scope, { status, body: storedBody }),
		);
	} else {
		await settleBestEffort('Idempotency key release', () => releaseIdempotencyKey(scope));
	}
	return response;
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
		requireAgentScope(grant, mutationPolicy.scope);
		throw new AgentApiFailure(409, SERVER_ERROR.AGENT_MUTATION_REQUIRES_PROPOSAL);
	}
	return executeAgentRead(grant, await authorizeAgentOperation(grant, operationName, input));
}
