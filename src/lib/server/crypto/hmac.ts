/**
 * Shared HMAC-SHA-256 signing primitives for the app's signed-token modules
 * (upload tokens, notification-preferences tokens, …). Each token module
 * derives its own domain-separated signing key via `createSigningKeyProvider`
 * so tokens minted for one purpose can never be replayed as another.
 */

const encoder = new TextEncoder();

/** Derives a domain-separated HMAC signing key from a raw secret + purpose string. */
async function deriveSigningKey(signingSecret: string, keyPurpose: string): Promise<CryptoKey> {
	const rawKey = await crypto.subtle.importKey(
		'raw',
		encoder.encode(signingSecret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);

	const derivedBytes = await crypto.subtle.sign('HMAC', rawKey, encoder.encode(keyPurpose));

	return crypto.subtle.importKey('raw', derivedBytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
		'verify',
	]);
}

/**
 * Returns a memoized `getSigningKey(signingSecret)` function scoped to one `keyPurpose`
 * domain constant. Each token module calls this once at module scope so repeated
 * sign/verify calls within a request don't re-derive the key.
 */
export function createSigningKeyProvider(
	keyPurpose: string,
): (signingSecret: string) => Promise<CryptoKey> {
	let cachedKey: CryptoKey | null = null;
	let cachedSource: string | null = null;

	return async function getSigningKey(signingSecret: string): Promise<CryptoKey> {
		if (cachedKey !== null && cachedSource === signingSecret) {
			return cachedKey;
		}

		const key = await deriveSigningKey(signingSecret, keyPurpose);
		cachedKey = key;
		cachedSource = signingSecret;
		return key;
	};
}

export function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

export function fromBase64Url(base64url: string): Uint8Array {
	const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
	const binString = atob(padded);
	return Uint8Array.from(binString, (char) => char.codePointAt(0)!);
}

export async function signPayloadBytes(
	key: CryptoKey,
	payloadBytes: Uint8Array,
): Promise<Uint8Array> {
	const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadBytes as BufferSource);
	return new Uint8Array(signatureBuffer);
}

export async function verifyPayloadSignature(
	key: CryptoKey,
	signatureBytes: Uint8Array,
	payloadBytes: Uint8Array,
): Promise<boolean> {
	return crypto.subtle.verify(
		'HMAC',
		key,
		signatureBytes as BufferSource,
		payloadBytes as BufferSource,
	);
}

export { encoder };
