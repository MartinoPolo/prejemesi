export const UPLOAD_TOKEN_EXPIRY_MS = 15 * 60 * 1000;

/**
 * Delete tokens outlive upload tokens: a user may keep an edit dialog open for a
 * long time before cancelling, and the token only authorizes deleting the one
 * object that same user uploaded moments earlier.
 */
export const DELETE_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

export const TOKEN_PURPOSES = {
	upload: 'upload',
	delete: 'delete',
} as const;

export type TokenPurpose = (typeof TOKEN_PURPOSES)[keyof typeof TOKEN_PURPOSES];

export interface UploadTokenPayload {
	objectKey: string;
	userId: string;
	purpose: TokenPurpose;
	expiresAt: number;
}

export interface UploadTokenResult {
	token: string;
	expiresAt: number;
}

const KEY_PURPOSE = 'upload-token-v1';
const encoder = new TextEncoder();

let cachedSigningKey: CryptoKey | null = null;
let cachedKeySource: string | null = null;

async function getSigningKey(key: string): Promise<CryptoKey> {
	if (cachedSigningKey !== null && cachedKeySource === key) {
		return cachedSigningKey;
	}

	const rawKey = await crypto.subtle.importKey(
		'raw',
		encoder.encode(key),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);

	const derivedBytes = await crypto.subtle.sign('HMAC', rawKey, encoder.encode(KEY_PURPOSE));

	const signingKey = await crypto.subtle.importKey(
		'raw',
		derivedBytes,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify'],
	);

	cachedSigningKey = signingKey;
	cachedKeySource = key;
	return signingKey;
}

function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function fromBase64Url(base64url: string): Uint8Array {
	const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
	const binString = atob(padded);
	return Uint8Array.from(binString, (char) => char.codePointAt(0)!);
}

export async function createUploadToken(
	objectKey: string,
	userId: string,
	signingKey: string,
	purpose: TokenPurpose = TOKEN_PURPOSES.upload,
	expiryMs: number = purpose === TOKEN_PURPOSES.delete
		? DELETE_TOKEN_EXPIRY_MS
		: UPLOAD_TOKEN_EXPIRY_MS,
): Promise<UploadTokenResult> {
	const expiresAt = Date.now() + expiryMs;
	const payload: UploadTokenPayload = { objectKey, userId, purpose, expiresAt };
	const payloadBytes = encoder.encode(JSON.stringify(payload));

	const key = await getSigningKey(signingKey);
	const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadBytes);
	const signatureBytes = new Uint8Array(signatureBuffer);

	const token = `${toBase64Url(payloadBytes)}.${toBase64Url(signatureBytes)}`;
	return { token, expiresAt };
}

export async function verifyUploadToken(
	token: string,
	signingKey: string,
): Promise<UploadTokenPayload> {
	const dotIndex = token.indexOf('.');
	if (dotIndex === -1 || dotIndex === 0 || dotIndex === token.length - 1) {
		throw new Error('Malformed upload token');
	}

	const payloadPart = token.slice(0, dotIndex);
	const signaturePart = token.slice(dotIndex + 1);

	let payloadBytes: Uint8Array;
	let signatureBytes: Uint8Array;
	try {
		payloadBytes = fromBase64Url(payloadPart);
		signatureBytes = fromBase64Url(signaturePart);
	} catch {
		throw new Error('Malformed upload token');
	}

	const key = await getSigningKey(signingKey);
	const valid = await crypto.subtle.verify(
		'HMAC',
		key,
		signatureBytes as BufferSource,
		payloadBytes as BufferSource,
	);
	if (!valid) {
		throw new Error('Invalid upload token signature');
	}

	let payload: UploadTokenPayload;
	try {
		payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as UploadTokenPayload;
	} catch {
		throw new Error('Malformed upload token payload');
	}

	if (
		typeof payload.objectKey !== 'string' ||
		typeof payload.userId !== 'string' ||
		typeof payload.expiresAt !== 'number' ||
		(payload.purpose !== TOKEN_PURPOSES.upload && payload.purpose !== TOKEN_PURPOSES.delete)
	) {
		throw new Error('Malformed upload token payload');
	}

	return payload;
}
