import {
	createSigningKeyProvider,
	encoder,
	fromBase64Url,
	signPayloadBytes,
	toBase64Url,
	verifyPayloadSignature,
} from './hmac.js';

/**
 * Unsubscribe / preferences links are followed long after the triggering email
 * was sent (issue #206) – a short-lived token would routinely 404 on a user
 * clicking a months-old email, so this grants a full year of access.
 */
export const NOTIFICATION_PREFERENCES_TOKEN_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000;

const NOTIFICATION_PREFERENCES_TOKEN_PURPOSE = 'notification-preferences';

interface NotificationPreferencesTokenPayload {
	userId: string;
	purpose: typeof NOTIFICATION_PREFERENCES_TOKEN_PURPOSE;
	expiresAt: number;
}

export interface NotificationPreferencesTokenResult {
	token: string;
	expiresAt: number;
}

const getSigningKey = createSigningKeyProvider('notification-preferences-token-v1');

/**
 * Mints a signed, non-guessable token scoped to exactly one user's notification
 * preferences (issue #206, REQ-4) – it authorizes nothing else about the account.
 */
export async function createNotificationPreferencesToken(
	userId: string,
	signingKey: string,
	expiryMs: number = NOTIFICATION_PREFERENCES_TOKEN_EXPIRY_MS,
): Promise<NotificationPreferencesTokenResult> {
	const expiresAt = Date.now() + expiryMs;
	const payload: NotificationPreferencesTokenPayload = {
		userId,
		purpose: NOTIFICATION_PREFERENCES_TOKEN_PURPOSE,
		expiresAt,
	};
	const payloadBytes = encoder.encode(JSON.stringify(payload));

	const key = await getSigningKey(signingKey);
	const signatureBytes = await signPayloadBytes(key, payloadBytes);

	const token = `${toBase64Url(payloadBytes)}.${toBase64Url(signatureBytes)}`;
	return { token, expiresAt };
}

/**
 * Verifies signature, purpose, and expiry in one call. Returns `null` (never
 * throws) for any malformed, tampered, wrong-purpose, or expired token so
 * callers on the public `/unsubscribe` page can render a plain "invalid link"
 * state instead of a 500 (issue #206, REQ-4).
 */
export async function verifyNotificationPreferencesToken(
	token: string,
	signingKey: string,
): Promise<{ userId: string } | null> {
	const dotIndex = token.indexOf('.');
	if (dotIndex === -1 || dotIndex === 0 || dotIndex === token.length - 1) {
		return null;
	}

	const payloadPart = token.slice(0, dotIndex);
	const signaturePart = token.slice(dotIndex + 1);

	let payloadBytes: Uint8Array;
	let signatureBytes: Uint8Array;
	try {
		payloadBytes = fromBase64Url(payloadPart);
		signatureBytes = fromBase64Url(signaturePart);
	} catch {
		return null;
	}

	const key = await getSigningKey(signingKey);
	const valid = await verifyPayloadSignature(key, signatureBytes, payloadBytes);
	if (!valid) {
		return null;
	}

	let payload: NotificationPreferencesTokenPayload;
	try {
		payload = JSON.parse(
			new TextDecoder().decode(payloadBytes),
		) as NotificationPreferencesTokenPayload;
	} catch {
		return null;
	}

	if (
		typeof payload.userId !== 'string' ||
		payload.userId === '' ||
		payload.purpose !== NOTIFICATION_PREFERENCES_TOKEN_PURPOSE ||
		typeof payload.expiresAt !== 'number'
	) {
		return null;
	}

	if (payload.expiresAt < Date.now()) {
		return null;
	}

	return { userId: payload.userId };
}
