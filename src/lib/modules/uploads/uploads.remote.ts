import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { guardedCommand } from '$lib/server/remote.js';
import { generateId } from '$lib/server/db/id.js';
import { createUploadToken } from '$lib/server/crypto/upload_token.js';
import {
	UPLOAD_TARGETS,
	MAX_FILE_SIZE,
	isAllowedContentType,
	getPublicUrl,
	type UploadTarget,
} from '$lib/server/storage/r2.js';
import { UPLOAD_API_BASE } from './types.js';
import type { UploadAuthorization, DeleteAuthorization } from './types.js';

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

/**
 * Server command that authorizes an upload and returns the upload endpoint + object key.
 * The client then uploads the file directly to the returned URL.
 */
interface AuthorizeUploadInput {
	target: string;
	fileName: string;
	contentType: string;
	fileSize: number;
}

function getAuthSigningKey(): string {
	const key = env.AUTH_SECRET;
	if (key == null || key === '') {
		throw new Error('AUTH_SECRET environment variable is required for upload token signing');
	}
	return key;
}

export const authorizeUpload = guardedCommand(
	async (authContext, input: AuthorizeUploadInput): Promise<UploadAuthorization> => {
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

		const uploadUrl = `${UPLOAD_API_BASE}/${objectKey}`;
		const publicUrl = getPublicUrl(objectKey);

		const { token, expiresAt } = await createUploadToken(
			objectKey,
			authContext.user.id,
			getAuthSigningKey(),
		);

		return { objectKey, uploadUrl, publicUrl, token, expiresAt };
	},
);

interface AuthorizeDeleteInput {
	objectKey: string;
}

export const authorizeDelete = guardedCommand(
	async (authContext, input: AuthorizeDeleteInput): Promise<DeleteAuthorization> => {
		if (typeof input.objectKey !== 'string' || input.objectKey === '') {
			error(400, 'Missing object key');
		}

		const { token, expiresAt } = await createUploadToken(
			input.objectKey,
			authContext.user.id,
			getAuthSigningKey(),
		);

		return { token, expiresAt };
	},
);
