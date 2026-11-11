import { json } from '@sveltejs/kit';

/** A chat endpoint's refusal as the JSON error body the clients read. */
export function chatFailure(
	status: number,
	code: string,
	options: { details?: Record<string, unknown>; headers?: HeadersInit } = {},
): Response {
	return json({ error: { code, ...options.details } }, { status, headers: options.headers });
}
