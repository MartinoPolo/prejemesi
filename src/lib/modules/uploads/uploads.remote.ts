import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { guardedCommand } from '$lib/server/remote.js';
import { generateId } from '$lib/server/db/id.js';
import { createUploadToken, TOKEN_PURPOSES } from '$lib/server/crypto/upload_token.js';
import { presignUploadUrl, PRESIGNED_UPLOAD_EXPIRY_SECONDS } from '$lib/server/storage/presign.js';
import {
	UPLOAD_TARGETS,
	MAX_FILE_SIZE,
	isAllowedContentType,
	getPublicUrl,
	type UploadTarget,
} from '$lib/server/storage/r2.js';
import { UPLOAD_API_BASE, UPLOAD_MODES } from './types.js';
import type { UploadAuthorization } from './types.js';

function isUploadTarget(value: string): value is UploadTarget {
	return value in UPLOAD_TARGETS;
}

function getExtensionFromContentType(contentType: string): string {
	const extensionMap: Record<string, string> = {
		'image/jpeg': 'jpg',
		'image/png': 'png',
		'image/webp': 'webp',
		'image/gif': 'gif',
	};
	return extensionMap[contentType] ?? 'bin';
}

const AuthorizeUploadInputSchema = v.object({
	target: v.string(),
	fileName: v.string(),
	contentType: v.string(),
	fileSize: v.number(),
});

function getAuthSigningKey(): string {
	const key = env.AUTH_SECRET;
	if (key == null || key === '') {
		throw new Error('AUTH_SECRET environment variable is required for upload token signing');
	}
	return key;
}

export const authorizeUpload = guardedCommand(
	AuthorizeUploadInputSchema,
	async (authContext, input): Promise<UploadAuthorization> => {
		if (!isUploadTarget(input.target)) {
			error(400, `Invalid upload target: ${input.target}`);
		}

		if (!isAllowedContentType(input.contentType)) {
			error(
				400,
				`Invalid content type: ${input.contentType}. Allowed: image/jpeg, image/png, image/webp, image/gif`,
			);
		}

		const maxSize = MAX_FILE_SIZE[input.target];
		if (input.fileSize <= 0) {
			error(400, 'File size must be greater than 0');
		}
		if (input.fileSize > maxSize) {
			const maxMb = Math.round(maxSize / (1024 * 1024));
			error(400, `File too large. Maximum size for ${input.target}: ${String(maxMb)}MB`);
		}

		const prefix = UPLOAD_TARGETS[input.target];
		const extension = getExtensionFromContentType(input.contentType);
		const uniqueId = generateId();
		const objectKey = `${prefix}/${uniqueId}.${extension}`;

		const publicUrl = getPublicUrl(objectKey);
		const signingKey = getAuthSigningKey();

		// The delete token lets only this uploader clean up this one object after a
		// cancel or replacement (REQ-6) – there is no arbitrary-key delete API.
		const { token: deleteToken } = await createUploadToken(
			objectKey,
			authContext.user.id,
			signingKey,
			TOKEN_PURPOSES.delete,
		);

		// Preferred path (REQ-1): a presigned PUT straight to R2 – the Worker never
		// sees the request body. Falls back to the same-origin proxy route when R2
		// S3 credentials are not configured (local dev, tests).
		const presignedUrl = await presignUploadUrl({
			objectKey,
			contentType: input.contentType,
			contentLength: input.fileSize,
		});

		if (presignedUrl !== null) {
			return {
				objectKey,
				uploadMode: UPLOAD_MODES.presigned,
				uploadUrl: presignedUrl,
				uploadToken: null,
				deleteToken,
				publicUrl,
				expiresAt: Date.now() + PRESIGNED_UPLOAD_EXPIRY_SECONDS * 1000,
			};
		}

		const { token: uploadToken, expiresAt } = await createUploadToken(
			objectKey,
			authContext.user.id,
			signingKey,
			TOKEN_PURPOSES.upload,
		);

		return {
			objectKey,
			uploadMode: UPLOAD_MODES.proxy,
			uploadUrl: `${UPLOAD_API_BASE}/${objectKey}`,
			uploadToken,
			deleteToken,
			publicUrl,
			expiresAt,
		};
	},
);
