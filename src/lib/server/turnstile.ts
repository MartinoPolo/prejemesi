import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_DEVELOPMENT_SECRET_KEY = '1x0000000000000000000000000000000AA';
const TURNSTILE_TOKEN_MAX_LENGTH = 2_048;

type TurnstileFailureReason =
	| 'missing'
	| 'invalid'
	| 'expired_or_replayed'
	| 'unavailable'
	| 'configuration';

export type TurnstileVerificationResult =
	| { success: true }
	| { success: false; reason: TurnstileFailureReason };

interface VerifyTurnstileTokenOptions {
	token: string | null | undefined;
	secretKey?: string;
	fetcher?: typeof fetch;
	isDevelopment?: boolean;
	timeoutMs?: number;
}

interface TurnstileSiteverifyResponse {
	success?: boolean;
	'error-codes'?: string[];
}

export function getTurnstileSecretKey(
	isDevelopment = dev,
	configuredSecretKey = env.TURNSTILE_SECRET_KEY,
) {
	if (configuredSecretKey !== undefined && configuredSecretKey !== '') {
		return configuredSecretKey;
	}
	return isDevelopment ? TURNSTILE_DEVELOPMENT_SECRET_KEY : '';
}

export async function verifyTurnstileToken({
	token,
	isDevelopment = dev,
	secretKey = getTurnstileSecretKey(isDevelopment),
	fetcher = fetch,
	timeoutMs = 5_000,
}: VerifyTurnstileTokenOptions): Promise<TurnstileVerificationResult> {
	if (!secretKey) {
		return { success: false, reason: 'configuration' };
	}
	if (token == null || token.trim() === '') {
		return { success: false, reason: 'missing' };
	}
	if (token.length > TURNSTILE_TOKEN_MAX_LENGTH) {
		return { success: false, reason: 'invalid' };
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetcher(TURNSTILE_SITEVERIFY_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ secret: secretKey, response: token }),
			signal: controller.signal,
		});
		if (!response.ok) {
			return { success: false, reason: 'unavailable' };
		}

		const result = (await response.json()) as TurnstileSiteverifyResponse;
		if (result === null || typeof result !== 'object' || Array.isArray(result)) {
			return { success: false, reason: 'unavailable' };
		}
		if (result.success === true) {
			return { success: true };
		}

		const errorCodes = Array.isArray(result['error-codes']) ? result['error-codes'] : [];
		if (
			errorCodes.includes('missing-input-secret') ||
			errorCodes.includes('invalid-input-secret') ||
			errorCodes.includes('bad-request')
		) {
			return { success: false, reason: 'configuration' };
		}
		if (errorCodes.includes('internal-error')) {
			return { success: false, reason: 'unavailable' };
		}
		if (errorCodes.includes('timeout-or-duplicate')) {
			return { success: false, reason: 'expired_or_replayed' };
		}
		return { success: false, reason: 'invalid' };
	} catch {
		return { success: false, reason: 'unavailable' };
	} finally {
		clearTimeout(timeout);
	}
}
