/**
 * Per-virtual-user HTTP client: cookie jar, latency capture, Cloudflare error
 * detection, better-auth login, and SvelteKit remote-function transport.
 */

import * as devalue from 'devalue';
import type { MetricsRecorder, RequestSample } from './metrics.js';

/** Matches Cloudflare's HTML error pages, e.g. "error code: 1102". */
const CF_ERROR_CODE_PATTERN = /error code:\s*(\d{3,4})/i;

export interface RemoteCommandResult {
	ok: boolean;
	/** Remote error envelope status (400, 403, …); null on success. */
	errorStatus: number | null;
	/** Server error body message, when the envelope carried one. */
	errorMessage: string | null;
	/** Decoded command result on success. */
	result: unknown;
}

interface RequestOutcome {
	status: number;
	cfErrorCode: number | null;
	bodyText: string;
	headers: Headers | null;
}

/** Encodes a remote-function argument the way kit's `stringify_remote_arg` does. */
export function encodeRemoteArg(value: unknown): string {
	if (value === undefined) {
		return '';
	}
	const jsonString = devalue.stringify(value);
	return Buffer.from(jsonString, 'utf-8').toString('base64url');
}

export class VirtualUserClient {
	private readonly cookies = new Map<string, string>();

	constructor(
		private readonly baseUrl: string,
		private readonly metrics: MetricsRecorder,
	) {}

	private cookieHeader(): string {
		return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
	}

	private storeCookies(headers: Headers): void {
		for (const setCookie of headers.getSetCookie()) {
			const [pair] = setCookie.split(';');
			if (pair === undefined) {
				continue;
			}
			const separatorIndex = pair.indexOf('=');
			if (separatorIndex === -1) {
				continue;
			}
			const name = pair.slice(0, separatorIndex).trim();
			const value = pair.slice(separatorIndex + 1).trim();
			// Expired cookie (deletion) — drop it from the jar.
			if (value === '' || /max-age=0/i.test(setCookie)) {
				this.cookies.delete(name);
			} else {
				this.cookies.set(name, value);
			}
		}
	}

	hasSessionCookie(): boolean {
		return [...this.cookies.keys()].some((name) => name.includes('session_token'));
	}

	/** Issues one instrumented request; never throws — failures become samples. */
	private async instrumentedFetch(
		operation: string,
		path: string,
		init: RequestInit,
		options: { expectedConflict?: (outcome: RequestOutcome) => boolean } = {},
	): Promise<RequestOutcome> {
		const url = `${this.baseUrl}${path}`;
		const headers = new Headers(init.headers);
		// better-auth rejects state-changing requests without an Origin header.
		headers.set('origin', this.baseUrl);
		const cookieHeader = this.cookieHeader();
		if (cookieHeader !== '') {
			headers.set('cookie', cookieHeader);
		}

		const startedAt = performance.now();
		let outcome: RequestOutcome;
		try {
			const response = await fetch(url, { ...init, headers, redirect: 'manual' });
			const bodyText = await response.text();
			let cfErrorCode: number | null = null;
			if (response.status >= 400) {
				const match = CF_ERROR_CODE_PATTERN.exec(bodyText);
				if (match !== null) {
					cfErrorCode = Number(match[1]);
				}
			}
			this.storeCookies(response.headers);
			outcome = { status: response.status, cfErrorCode, bodyText, headers: response.headers };
		} catch {
			outcome = { status: 0, cfErrorCode: null, bodyText: '', headers: null };
		}
		const durationMs = performance.now() - startedAt;

		const sample: RequestSample = {
			operation,
			durationMs,
			status: outcome.status,
			cfErrorCode: outcome.cfErrorCode,
			remoteErrorStatus: null,
			expectedConflict: options.expectedConflict?.(outcome) ?? false,
		};
		this.metrics.record(sample);
		this.lastSample = sample;
		return outcome;
	}

	/** The sample recorded by the most recent request (mutable for envelope enrichment). */
	private lastSample: RequestSample | null = null;

	/** better-auth email/password sign-in; returns true when a session cookie was set. */
	async login(email: string, password: string): Promise<boolean> {
		const outcome = await this.instrumentedFetch('auth:login', '/api/auth/sign-in/email', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email, password }),
		});
		return outcome.status === 200 && this.hasSessionCookie();
	}

	/** SSR page view; returns HTTP status. */
	async viewPage(operation: string, path: string): Promise<number> {
		const outcome = await this.instrumentedFetch(operation, path, { method: 'GET' });
		return outcome.status;
	}

	/**
	 * Invokes a remote command the way the SvelteKit client does. Handled app
	 * errors arrive as HTTP 200 `{type:'error', status}` envelopes; those are
	 * recorded as remote errors (or expected conflicts via `isExpectedConflict`).
	 */
	async remoteCommand(
		endpointId: string,
		arg: unknown,
		options: {
			operation: string;
			isExpectedConflict?: (errorStatus: number, errorMessage: string) => boolean;
		},
	): Promise<RemoteCommandResult> {
		const outcome = await this.instrumentedFetch(
			options.operation,
			`/_app/remote/${endpointId}`,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ payload: encodeRemoteArg(arg), refreshes: [] }),
			},
		);

		if (outcome.status !== 200) {
			return {
				ok: false,
				errorStatus: outcome.status,
				errorMessage: outcome.bodyText.slice(0, 200),
				result: null,
			};
		}

		let envelope: { type: string; status?: number; error?: unknown; result?: string };
		try {
			envelope = JSON.parse(outcome.bodyText) as typeof envelope;
		} catch {
			return {
				ok: false,
				errorStatus: null,
				errorMessage: 'unparseable envelope',
				result: null,
			};
		}

		if (envelope.type === 'error') {
			const errorStatus = envelope.status ?? 500;
			const errorMessage =
				typeof envelope.error === 'object' && envelope.error !== null
					? JSON.stringify(envelope.error)
					: String(envelope.error);
			const expected = options.isExpectedConflict?.(errorStatus, errorMessage) ?? false;
			if (this.lastSample !== null) {
				this.lastSample.remoteErrorStatus = errorStatus;
				this.lastSample.expectedConflict = expected;
			}
			return { ok: false, errorStatus, errorMessage, result: null };
		}

		let result: unknown = null;
		if (typeof envelope.result === 'string') {
			try {
				result = devalue.parse(envelope.result);
			} catch {
				result = null;
			}
		}
		return { ok: true, errorStatus: null, errorMessage: null, result };
	}
}
