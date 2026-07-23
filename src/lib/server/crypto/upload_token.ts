import {
	createSigningKeyProvider,
	encoder,
	fromBase64Url,
	signPayloadBytes,
	toBase64Url,
	verifyPayloadSignature,
} from './hmac.js';

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

const getSigningKey = createSigningKeyProvider('upload-token-v1');

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
	const signatureBytes = await signPayloadBytes(key, payloadBytes);

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
	const valid = await verifyPayloadSignature(key, signatureBytes, payloadBytes);
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
