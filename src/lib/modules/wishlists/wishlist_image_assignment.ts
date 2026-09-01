import { error } from '@sveltejs/kit';
import { getAuthSigningKey } from '$lib/server/crypto/auth_signing_key.js';
import { TOKEN_PURPOSES, verifyUploadToken } from '$lib/server/crypto/upload_token.js';
import { UPLOAD_TARGETS } from '$lib/server/storage/r2.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';

/** Proves that a newly assigned banner was authorized for this uploader. */
export async function assertWishlistBannerAssignment(
	userId: string,
	objectKey: string,
	deleteToken: string | undefined,
): Promise<void> {
	try {
		if (deleteToken === undefined) {
			throw new Error('missing token');
		}
		const payload = await verifyUploadToken(deleteToken, getAuthSigningKey());
		if (
			payload.expiresAt <= Date.now() ||
			payload.userId !== userId ||
			payload.objectKey !== objectKey ||
			payload.purpose !== TOKEN_PURPOSES.delete ||
			!objectKey.startsWith(`${UPLOAD_TARGETS['wishlist-banner']}/`)
		) {
			throw new Error('invalid banner assignment');
		}
	} catch {
		error(403, SERVER_ERROR.ACCESS_DENIED);
	}
}
