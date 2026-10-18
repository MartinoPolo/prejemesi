const API_BASE_PATH = '/api/v1';

const REQUEST_TIMEOUT_MS = 60_000;

export type FetchFunction = (input: URL, init: RequestInit) => Promise<Response>;

/** A failed request with the API's `{ "error": … }` body, or one describing a network failure. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly body: unknown,
	) {
		super(`Request failed with status ${status}`);
	}
}

export interface ApiRequest {
	method: 'GET' | 'POST';
	path: string;
	body?: unknown;
	idempotencyKey?: string;
}

export type ApiClient = (request: ApiRequest) => Promise<unknown>;

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function failureMessage(thrown: unknown): string {
	return thrown instanceof Error ? thrown.message : String(thrown);
}

export function createApiClient(options: {
	baseUrl: string;
	token: string;
	fetch: FetchFunction;
}): ApiClient {
	return async ({ method, path, body, idempotencyKey }) => {
		const headers: Record<string, string> = {
			authorization: `Bearer ${options.token}`,
			accept: 'application/json',
		};
		if (body !== undefined) {
			headers['content-type'] = 'application/json';
		}
		if (idempotencyKey !== undefined) {
			headers['idempotency-key'] = idempotencyKey;
		}
		let response: Response;
		let text: string;
		try {
			response = await options.fetch(new URL(`${API_BASE_PATH}${path}`, options.baseUrl), {
				method,
				headers,
				...(body === undefined ? {} : { body: JSON.stringify(body) }),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
			text = await response.text();
		} catch (thrown) {
			throw new ApiError(0, {
				error: { code: 'NETWORK_ERROR', message: failureMessage(thrown) },
			});
		}
		const parsed = parseJson(text);
		if (!response.ok) {
			throw new ApiError(
				response.status,
				parsed ?? { error: { code: 'HTTP_ERROR', message: `HTTP ${response.status}` } },
			);
		}
		return parsed;
	};
}
