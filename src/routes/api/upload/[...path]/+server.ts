/**
 * Upload proxy route — intentional design choice over R2 presigned URLs.
 *
 * Trade-off: upload bandwidth flows through the server. Acceptable for images
 * (max 10 MB). Consider presigned URLs if video/large-file uploads are added.
 *
 * Benefits of proxying:
 * - HMAC token verification binds each upload to a specific user + objectKey
 * - Session cookie auth works without CORS presigned URL complexity
 * - Content-type and size validation happens server-side before storage
 * - Simpler client code — PUT to a same-origin URL
 */
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types.js';
import {
	isAllowedContentType,
	putObject,
	getObject,
	deleteObject,
	isR2Available,
	MAX_FILE_SIZE,
	UPLOAD_TARGETS,
} from '$lib/server/storage/r2.js';
import { verifyUploadToken } from '$lib/server/crypto/upload_token.js';
import type { UploadTokenPayload } from '$lib/server/crypto/upload_token.js';

async function extractAndVerifyToken(request: Request): Promise<UploadTokenPayload> {
	const tokenHeader = request.headers.get('x-upload-token');
	if (tokenHeader == null || tokenHeader === '') {
		error(403, 'Missing upload token');
	}

	const key = env.AUTH_SECRET;
	if (key == null || key === '') {
		throw new Error(
			'AUTH_SECRET environment variable is required for upload token verification',
		);
	}

	let payload: UploadTokenPayload;
	try {
		payload = await verifyUploadToken(tokenHeader, key);
	} catch {
		error(403, 'Invalid upload token');
	}

	if (payload.expiresAt < Date.now()) {
		error(401, 'Upload token expired');
	}

	return payload;
}

function validateTokenBinding(
	payload: UploadTokenPayload,
	userId: string,
	objectKey: string,
): void {
	if (payload.userId !== userId) {
		error(403, 'Upload token user mismatch');
	}
	if (payload.objectKey !== objectKey) {
		error(403, 'Upload token path mismatch');
	}
}

// In-memory fallback store for local development (no persistence across restarts)
const localDevStore = new Map<string, { body: ArrayBuffer; contentType: string }>();
const LOCAL_DEV_STORE_MAX_ENTRIES = 50;

function getTargetFromPath(path: string): keyof typeof UPLOAD_TARGETS | null {
	for (const [target, prefix] of Object.entries(UPLOAD_TARGETS)) {
		if (path.startsWith(prefix + '/')) {
			return target as keyof typeof UPLOAD_TARGETS;
		}
	}
	return null;
}

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (locals.user == null || locals.session == null) {
		error(401, 'Authentication required');
	}

	const objectKey = params.path;
	if (!objectKey) {
		error(400, 'Missing upload path');
	}

	const tokenPayload = await extractAndVerifyToken(request);
	validateTokenBinding(tokenPayload, locals.user.id, objectKey);

	const target = getTargetFromPath(objectKey);
	if (!target) {
		error(400, 'Invalid upload path prefix');
	}

	const contentType = request.headers.get('content-type') ?? '';
	if (!isAllowedContentType(contentType)) {
		error(400, `Invalid content type: ${contentType}`);
	}

	const contentLength = Number(request.headers.get('content-length') ?? '0');
	if (contentLength > MAX_FILE_SIZE[target]) {
		const maxMb = Math.round(MAX_FILE_SIZE[target] / (1024 * 1024));
		error(400, `File too large. Maximum: ${String(maxMb)}MB`);
	}

	// Production path: stream directly to R2
	if (isR2Available()) {
		if (request.body == null) {
			error(400, 'Empty file body');
		}
		try {
			await putObject(objectKey, request.body, contentType);
		} catch {
			error(502, 'Storage write failed');
		}
	} else {
		// Dev fallback: must buffer for in-memory store
		let body: ArrayBuffer;
		try {
			body = await request.arrayBuffer();
		} catch {
			error(400, 'Failed to read request body');
		}
		if (body.byteLength === 0) {
			error(400, 'Empty file body');
		}
		if (localDevStore.size >= LOCAL_DEV_STORE_MAX_ENTRIES) {
			const oldestKey = localDevStore.keys().next().value;
			if (oldestKey !== undefined) {
				localDevStore.delete(oldestKey);
			}
		}
		localDevStore.set(objectKey, { body, contentType });
	}

	return json({ objectKey }, { status: 201 });
};

/**
 * GET handler — serves files from R2 (or local dev store).
 * Used as the public URL fallback when R2_PUBLIC_URL is not set.
 */
export const GET: RequestHandler = async ({ params }) => {
	const objectKey = params.path;
	if (!objectKey) {
		error(400, 'Missing path');
	}

	// Try R2 first
	if (isR2Available()) {
		const object = await getObject(objectKey);
		if (!object) {
			error(404, 'File not found');
		}

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set('cache-control', 'public, max-age=31536000, immutable');
		headers.set('etag', object.httpEtag);
		headers.set('X-Content-Type-Options', 'nosniff');

		return new Response(object.body, { headers });
	}

	// Local dev fallback
	const localFile = localDevStore.get(objectKey);
	if (!localFile) {
		error(404, 'File not found');
	}

	return new Response(localFile.body, {
		headers: {
			'content-type': localFile.contentType,
			'cache-control': 'no-cache',
			'X-Content-Type-Options': 'nosniff',
		},
	});
};

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	if (locals.user == null || locals.session == null) {
		error(401, 'Authentication required');
	}

	const objectKey = params.path;
	if (!objectKey) {
		error(400, 'Missing path');
	}

	const tokenPayload = await extractAndVerifyToken(request);
	validateTokenBinding(tokenPayload, locals.user.id, objectKey);

	if (isR2Available()) {
		await deleteObject(objectKey);
	} else {
		localDevStore.delete(objectKey);
	}

	return new Response(null, { status: 204 });
};
