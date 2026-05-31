import { error } from '@sveltejs/kit';
import { guardedCommand } from '$lib/server/remote.js';
import { generateId } from '$lib/server/db/id.js';
import {
	UPLOAD_TARGETS,
	MAX_FILE_SIZE,
	isAllowedContentType,
	getPublicUrl,
	type UploadTarget,
} from '$lib/server/storage/r2.js';
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

export const authorizeUpload = guardedCommand(
	(_authContext, input: AuthorizeUploadInput): UploadAuthorization => {
		// Validate target
		if (!isUploadTarget(input.target)) {
			error(400, `Invalid upload target: ${input.target}`);
		}

		// Validate content type
		if (!isAllowedContentType(input.contentType)) {
			error(
				400,
				`Invalid content type: ${input.contentType}. Allowed: image/jpeg, image/png, image/webp, image/gif`,
			);
		}

		// Validate file size
		const maxSize = MAX_FILE_SIZE[input.target];
		if (input.fileSize <= 0) {
			error(400, 'File size must be greater than 0');
		}
		if (input.fileSize > maxSize) {
			const maxMb = Math.round(maxSize / (1024 * 1024));
			error(400, `File too large. Maximum size for ${input.target}: ${String(maxMb)}MB`);
		}

		// Generate unique object key
		const prefix = UPLOAD_TARGETS[input.target];
		const extension = getExtensionFromContentType(input.contentType);
		const uniqueId = generateId();
		const objectKey = `${prefix}/${uniqueId}.${extension}`;

		// Build upload URL (points to our API route that proxies to R2)
		const uploadUrl = `/api/upload/${objectKey}`;
		const publicUrl = getPublicUrl(objectKey);

		return { objectKey, uploadUrl, publicUrl };
	},
);
