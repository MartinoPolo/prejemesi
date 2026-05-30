import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	isAllowedContentType,
	putObject,
	getObject,
	deleteObject,
	isR2Available,
} from '$lib/server/storage/r2.js';

/**
 * PUT handler — receives a file upload and stores it in R2.
 * The object key comes from the URL path (e.g., /api/upload/gifts/abc123.jpg).
 *
 * In development without R2 bindings, files are stored in a local Map.
 */

// In-memory fallback store for local development (no persistence across restarts)
const localDevStore = new Map<string, { body: ArrayBuffer; contentType: string }>();

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	// Require authentication
	if (!locals.user || !locals.session) {
		error(401, 'Authentication required');
	}

	const objectKey = params.path;
	if (!objectKey) {
		error(400, 'Missing upload path');
	}

	const contentType = request.headers.get('content-type') ?? '';
	if (!isAllowedContentType(contentType)) {
		error(400, `Invalid content type: ${contentType}`);
	}

	const body = await request.arrayBuffer();
	if (body.byteLength === 0) {
		error(400, 'Empty file body');
	}

	// Try R2 first, fall back to local dev store
	const stored = await putObject(objectKey, body, contentType);
	if (!stored) {
		// Local dev fallback
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
		},
	});
};

/**
 * DELETE handler — removes a file from R2 (or local dev store).
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || !locals.session) {
		error(401, 'Authentication required');
	}

	const objectKey = params.path;
	if (!objectKey) {
		error(400, 'Missing path');
	}

	if (isR2Available()) {
		await deleteObject(objectKey);
	} else {
		localDevStore.delete(objectKey);
	}

	return new Response(null, { status: 204 });
};
