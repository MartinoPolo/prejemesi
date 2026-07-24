import { env } from '$env/dynamic/private';

/**
 * Returns the app's `AUTH_SECRET`, the raw secret behind every signed-token
 * module (upload tokens, notification-preferences tokens). Throws if unset so a
 * misconfiguration fails loudly instead of silently producing unverifiable tokens.
 */
export function getAuthSigningKey(): string {
	const key = env.AUTH_SECRET;
	if (key == null || key === '') {
		throw new Error('AUTH_SECRET environment variable is required for signed-token operations');
	}
	return key;
}
