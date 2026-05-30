import 'use server';

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
export const authorizeUpload = guardedCommand(
	(
		_authContext,
		target: string,
		_fileName: string,
		contentType: string,
		fileSize: number,
	): UploadAuthorization => {
		// Validate target
		if (!isUploadTarget(target)) {
			error(400, `Invalid upload target: ${target}`);
		}

		// Validate content type
		if (!isAllowedContentType(contentType)) {
			error(
				400,
				`Invalid content type: ${contentType}. Allowed: image/jpeg, image/png, image/webp, image/gif`,
			);
		}

		// Validate file size
		const maxSize = MAX_FILE_SIZE[target];
		if (fileSize <= 0) {
			error(400, 'File size must be greater than 0');
		}
		if (fileSize > maxSize) {
			const maxMb = Math.round(maxSize / (1024 * 1024));
			error(400, `File too large. Maximum size for ${target}: ${String(maxMb)}MB`);
		}

		// Generate unique object key
		const prefix = UPLOAD_TARGETS[target];
		const extension = getExtensionFromContentType(contentType);
		const uniqueId = generateId();
		const objectKey = `${prefix}/${uniqueId}.${extension}`;

		// Build upload URL (points to our API route that proxies to R2)
		const uploadUrl = `/api/upload/${objectKey}`;
		const publicUrl = getPublicUrl(objectKey);

		return { objectKey, uploadUrl, publicUrl };
	},
);
