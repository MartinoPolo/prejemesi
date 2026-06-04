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
import { readFile } from 'node:fs/promises';
import { resolve, normalize } from 'node:path';
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

// In-memory store used only when no R2 binding is configured (e.g. plain
// `node` runs without wrangler). Local dev and production both use R2, which
// persists across restarts. Not persistent — entries are lost on restart.
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

	let body: ArrayBuffer;
	try {
		body = await request.arrayBuffer();
	} catch {
		error(400, 'Failed to read request body');
	}
	if (body.byteLength === 0) {
		error(400, 'Empty file body');
	}

	if (isR2Available()) {
		try {
			await putObject(objectKey, body, contentType);
		} catch {
			error(500, 'Failed to store upload');
		}
	} else {
		// No R2 binding — keep the file in memory so uploads work in this session.
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
 * GET handler — serves files from R2 (or the in-memory fallback store).
 * Used as the public URL fallback when R2_PUBLIC_URL is not set.
 */
export const GET: RequestHandler = async ({ params }) => {
	const objectKey = params.path;
	if (!objectKey) {
		error(400, 'Missing path');
	}

	if (isR2Available()) {
		const object = await getObject(objectKey);
		if (object) {
			return new Response(object.body, {
				headers: {
					'content-type': object.contentType,
					'cache-control': 'public, max-age=31536000, immutable',
					etag: object.etag,
					'X-Content-Type-Options': 'nosniff',
				},
			});
		}
	}

	// In-memory fallback (no R2 binding configured)
	const localFile = localDevStore.get(objectKey);
	if (localFile !== undefined) {
		return new Response(localFile.body, {
			headers: {
				'content-type': localFile.contentType,
				'cache-control': 'no-cache',
				'X-Content-Type-Options': 'nosniff',
			},
		});
	}

	// Filesystem fallback — seed images downloaded by `pnpm db:seed`
	try {
		const seedRoot = resolve(process.cwd(), '.seed-uploads');
		const seedPath = resolve(seedRoot, normalize(objectKey));
		if (!seedPath.startsWith(seedRoot)) {
			error(403, 'Invalid path');
		}
		const body = await readFile(seedPath);
		const ext = objectKey.split('.').pop()?.toLowerCase();
		const contentType =
			ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
		return new Response(body, {
			headers: {
				'content-type': contentType,
				'cache-control': 'no-cache',
				'X-Content-Type-Options': 'nosniff',
			},
		});
	} catch {
		error(404, 'File not found');
	}
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
		try {
			await deleteObject(objectKey);
		} catch {
			// Best-effort delete — the object may already be gone
		}
	} else {
		localDevStore.delete(objectKey);
	}

	return new Response(null, { status: 204 });
};
