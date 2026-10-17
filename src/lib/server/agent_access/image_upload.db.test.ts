import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	RESERVER_ID,
	createWishlistFixture,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { eq, like } from 'drizzle-orm';

vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));

import { getDb } from '$lib/server/db/index.js';
import { agentImage } from '$lib/server/db/agent_image.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { CreateAccessTokenInputSchema } from '$lib/modules/access_tokens/types.js';
import { MAX_GIFT_IMAGE_BYTES } from '$lib/modules/uploads/types.js';
import { createAccessToken } from './access_tokens.js';
import type { AgentApiRateLimit } from './api.js';
import type { AgentImageBucket } from '$lib/server/storage/r2.js';
import { MAX_IMAGE_SIDE_PX } from '$lib/server/images/image_download.js';
import { AGENT_DAILY_IMAGE_BUDGET, AGENT_IMAGE_REFERENCE_LIFETIME_MS } from './limits.js';
import { POST as postImage } from '../../../routes/api/v1/images/+server.js';

const allowingRateLimit: AgentApiRateLimit = { limit: async () => ({ success: true }) };

function pngBytes(width: number, height: number): Uint8Array<ArrayBuffer> {
	const bytes = new Uint8Array(29);
	bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
	const view = new DataView(bytes.buffer);
	view.setUint32(16, width);
	view.setUint32(20, height);
	return bytes;
}

function pngResponse(width = 800, height = 600): Response {
	return new Response(pngBytes(width, height), { headers: { 'content-type': 'image/png' } });
}

interface StoredObject {
	bytes: Uint8Array;
	contentType: string;
}

/** Stands in for the R2 binding; `afterPut` runs once an object is stored. */
function fakeBucket(afterPut: () => Promise<void> = async () => {}) {
	const objects = new Map<string, StoredObject>();
	const bucket: AgentImageBucket = {
		put: vi.fn(async (key, value, options) => {
			objects.set(key, { bytes: value, contentType: options.httpMetadata.contentType });
			await afterPut();
			return null;
		}),
		delete: vi.fn(async (keys) => {
			for (const key of keys) {
				objects.delete(key);
			}
		}),
	};
	return { objects, bucket };
}

/** Stands in for the image host; the route downloads with the global fetch. */
function imageHost(...responses: Response[]) {
	const fetch = vi.fn<(input: URL | RequestInfo, init?: RequestInit) => Promise<Response>>();
	for (const response of responses) {
		fetch.mockResolvedValueOnce(response);
	}
	vi.stubGlobal('fetch', fetch);
	return fetch;
}

interface UploadRequest {
	authorization: string;
	bucket?: AgentImageBucket;
	idempotencyKey?: string;
}

interface RouteEvent {
	request: Request;
	url: URL;
	params: Record<string, string>;
	cookies: { get: () => undefined };
	platform: { env: { AGENT_API_RATE_LIMIT: AgentApiRateLimit; R2?: AgentImageBucket } };
}

/** The route handler takes a whole SvelteKit event; it reads only what this event provides. */
const callRoute = postImage as unknown as (event: RouteEvent) => Promise<Response>;

async function callUpload(body: unknown, request: UploadRequest) {
	const headers = new Headers({
		authorization: request.authorization,
		'content-type': 'application/json',
	});
	if (request.idempotencyKey !== undefined) {
		headers.set('idempotency-key', request.idempotencyKey);
	}
	const url = 'https://prejemesi.cz/api/v1/images';
	return callRoute({
		request: new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }),
		url: new URL(url),
		params: {},
		cookies: { get: () => undefined },
		platform: {
			env: {
				AGENT_API_RATE_LIMIT: allowingRateLimit,
				...(request.bucket === undefined ? {} : { R2: request.bucket }),
			},
		},
	});
}

async function errorOf(response: Response) {
	const body = (await response.json()) as { error: Record<string, unknown> };
	return { status: response.status, ...body.error };
}

interface UploadedImage {
	reference: string;
	url: string;
	contentType: string;
	byteLength: number;
	width: number;
	height: number;
	expiresAt: string;
}

async function imageOf(response: Response): Promise<UploadedImage> {
	expect(response.status).toBe(201);
	return ((await response.json()) as { image: UploadedImage }).image;
}

async function tokenFor(userId: string, input: Record<string, unknown> = {}) {
	const { value } = await createAccessToken(
		userId,
		v.parse(CreateAccessTokenInputSchema, {
			name: 'Claude',
			scopes: ['gifts:write'],
			wishlistIds: null,
			...input,
		}),
	);
	return `Bearer ${value}`;
}

async function storedImagesOf(userId: string) {
	return getDb().select().from(agentImage).where(eq(agentImage.userId, userId));
}

/** Fills the user's daily image budget with images created a minute ago, keyed under `label`. */
async function fillImageBudget(userId: string, wishlistId: string, label: string) {
	const used = (await storedImagesOf(userId)).length;
	const now = Date.now();
	await getDb()
		.insert(agentImage)
		.values(
			Array.from({ length: AGENT_DAILY_IMAGE_BUDGET.images - used }, (_, index) => ({
				userId,
				wishlistId,
				objectKey: `gifts/agent/${wishlistId}/${label}-${index}.png`,
				contentType: 'image/png',
				byteLength: 29,
				width: 1,
				height: 1,
				createdAt: new Date(now - 60 * 1000),
				expiresAt: new Date(now + AGENT_IMAGE_REFERENCE_LIFETIME_MS),
			})),
		);
	return async () => {
		await getDb()
			.delete(agentImage)
			.where(like(agentImage.objectKey, `%/${label}-%`));
	};
}

describe.skipIf(!DB_READY)('POST /api/v1/images', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('stores the downloaded image in R2 and answers a reference bound to the user and wishlist', async () => {
		const target = await createWishlistFixture();
		const authorization = await tokenFor(MANAGER_ID);
		const { objects, bucket } = fakeBucket();
		const fetch = imageHost(pngResponse(800, 600));
		const before = Date.now();

		const image = await imageOf(
			await callUpload(
				{ wishlistShortId: target.shortId, url: 'https://shop.example/kolo.png' },
				{ authorization, bucket },
			),
		);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(String(fetch.mock.calls[0]?.[0])).toBe('https://shop.example/kolo.png');
		expect(image).toMatchObject({
			contentType: 'image/png',
			byteLength: 29,
			width: 800,
			height: 600,
		});
		expect(Date.parse(image.expiresAt)).toBeGreaterThanOrEqual(
			before + AGENT_IMAGE_REFERENCE_LIFETIME_MS - 1000,
		);
		const [row] = (await storedImagesOf(MANAGER_ID)).filter(
			(stored) => stored.id === image.reference,
		);
		expect(row).toMatchObject({ wishlistId: target.id, attachedAt: null });
		expect(row?.objectKey).toMatch(/^gifts\//);
		expect(image.url).not.toContain('shop.example');
		expect(image.url.endsWith(row?.objectKey ?? '-')).toBe(true);
		expect(objects.get(row?.objectKey ?? '')).toEqual({
			bytes: pngBytes(800, 600),
			contentType: 'image/png',
		});
	});

	it('answers 403 without gifts:write, before downloading anything', async () => {
		const target = await createWishlistFixture();
		const authorization = await tokenFor(MANAGER_ID, { scopes: [] });
		const { bucket } = fakeBucket();
		const fetch = imageHost(pngResponse());

		const response = await callUpload(
			{ wishlistId: target.id, url: 'https://shop.example/kolo.png' },
			{ authorization, bucket },
		);

		expect(await errorOf(response)).toMatchObject({
			status: 403,
			code: SERVER_ERROR.AGENT_SCOPE_MISSING,
		});
		expect(fetch).not.toHaveBeenCalled();
	});

	it('answers 403 when a restricted token names another wishlist', async () => {
		const allowed = await createWishlistFixture();
		const other = await createWishlistFixture();
		const authorization = await tokenFor(MANAGER_ID, { wishlistIds: [allowed.id] });
		const { bucket } = fakeBucket();
		const fetch = imageHost(pngResponse());

		const response = await callUpload(
			{ wishlistId: other.id, url: 'https://shop.example/kolo.png' },
			{ authorization, bucket },
		);

		expect(await errorOf(response)).toMatchObject({
			status: 403,
			code: SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED,
		});
		expect(fetch).not.toHaveBeenCalled();
	});

	it('answers 403 when the token user does not manage the wishlist', async () => {
		const target = await createWishlistFixture({ sharedAt: new Date() });
		const authorization = await tokenFor(RESERVER_ID);
		const { bucket } = fakeBucket();
		const fetch = imageHost(pngResponse());

		const response = await callUpload(
			{ wishlistId: target.id, url: 'https://shop.example/kolo.png' },
			{ authorization, bucket },
		);

		expect(await errorOf(response)).toMatchObject({
			status: 403,
			code: SERVER_ERROR.ACCESS_DENIED,
		});
		expect(fetch).not.toHaveBeenCalled();
	});

	it('replays a repeated Idempotency-Key with the same reference, without a second download', async () => {
		const target = await createWishlistFixture();
		const authorization = await tokenFor(MANAGER_ID);
		const { objects, bucket } = fakeBucket();
		const fetch = imageHost(pngResponse(), pngResponse());
		const body = { wishlistId: target.id, url: 'https://shop.example/kolo.png' };

		const first = await imageOf(
			await callUpload(body, { authorization, bucket, idempotencyKey: 'image-1' }),
		);
		const replayResponse = await callUpload(body, {
			authorization,
			bucket,
			idempotencyKey: 'image-1',
		});
		const replay = await imageOf(replayResponse);

		expect(replay).toEqual(first);
		expect(replayResponse.headers.get('idempotent-replayed')).toBe('true');
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(objects.size).toBe(1);
	});

	it('answers a distinct code for each rejected URL or image and stores nothing', async () => {
		const target = await createWishlistFixture();
		const authorization = await tokenFor(MANAGER_ID);
		const html = new Response('<html></html>', { headers: { 'content-type': 'image/png' } });
		const svg = new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } });
		const oversized = new Response(pngBytes(10, 10), {
			headers: {
				'content-type': 'image/png',
				'content-length': String(MAX_GIFT_IMAGE_BYTES + 1),
			},
		});
		const cases: {
			url?: string;
			response?: Response;
			status: number;
			code: string;
			details?: Record<string, unknown>;
		}[] = [
			{ url: 'http://shop.example/kolo.png', status: 400, code: 'AGENT_IMAGE_URL_INVALID' },
			{ url: 'https://127.0.0.1/kolo.png', status: 400, code: 'AGENT_IMAGE_HOST_BLOCKED' },
			{ response: svg, status: 422, code: 'AGENT_IMAGE_UNSUPPORTED_TYPE' },
			{ response: html, status: 422, code: 'AGENT_IMAGE_SIGNATURE_MISMATCH' },
			{
				response: oversized,
				status: 422,
				code: 'AGENT_IMAGE_TOO_LARGE',
				details: { maxBytes: MAX_GIFT_IMAGE_BYTES },
			},
			{ response: pngResponse(0, 10), status: 422, code: 'AGENT_IMAGE_DIMENSIONS_INVALID' },
			{
				response: pngResponse(MAX_IMAGE_SIDE_PX + 1, 10),
				status: 422,
				code: 'AGENT_IMAGE_DIMENSIONS_INVALID',
			},
			{
				response: new Response('gone', { status: 404 }),
				status: 502,
				code: 'AGENT_IMAGE_FETCH_FAILED',
			},
		];
		const { objects, bucket } = fakeBucket();
		const imagesBefore = (await storedImagesOf(MANAGER_ID)).length;

		for (const testCase of cases) {
			imageHost(...(testCase.response === undefined ? [] : [testCase.response]));
			const response = await callUpload(
				{ wishlistId: target.id, url: testCase.url ?? 'https://shop.example/kolo.png' },
				{ authorization, bucket },
			);
			expect(await errorOf(response), testCase.code).toMatchObject({
				status: testCase.status,
				code: testCase.code,
				...testCase.details,
			});
		}

		expect(objects.size).toBe(0);
		expect(await storedImagesOf(MANAGER_ID)).toHaveLength(imagesBefore);
	});

	it('requires a url and exactly one wishlist address', async () => {
		const target = await createWishlistFixture();
		const authorization = await tokenFor(MANAGER_ID);
		const { bucket } = fakeBucket();
		const fetch = imageHost();

		for (const body of [
			{ wishlistId: target.id },
			{ url: 'https://shop.example/kolo.png' },
			{ wishlistId: target.id, wishlistShortId: target.shortId, url: 'https://a.example/b' },
			{ wishlistId: target.id, url: 'https://shop.example/kolo.png', name: 'extra' },
		]) {
			expect(await errorOf(await callUpload(body, { authorization, bucket }))).toMatchObject({
				status: 400,
				code: SERVER_ERROR.AGENT_IMAGE_REQUEST_INVALID,
			});
		}
		expect(fetch).not.toHaveBeenCalled();
	});

	it('answers 503 without image storage', async () => {
		const target = await createWishlistFixture();
		const authorization = await tokenFor(MANAGER_ID);
		const fetch = imageHost(pngResponse());

		const response = await callUpload(
			{ wishlistId: target.id, url: 'https://shop.example/kolo.png' },
			{ authorization },
		);

		expect(await errorOf(response)).toMatchObject({
			status: 503,
			code: SERVER_ERROR.AGENT_IMAGE_STORAGE_UNAVAILABLE,
		});
		expect(fetch).not.toHaveBeenCalled();
	});

	it('deletes the stored object when the image row is not committed', async () => {
		const target = await createWishlistFixture();
		const authorization = await tokenFor(MANAGER_ID);
		let releaseBudget = async () => {};
		// Another request spends the budget between the first check and the locked recheck.
		const { objects, bucket } = fakeBucket(async () => {
			releaseBudget = await fillImageBudget(MANAGER_ID, target.id, 'between-checks');
		});
		imageHost(pngResponse());

		try {
			const response = await callUpload(
				{ wishlistId: target.id, url: 'https://shop.example/kolo.png' },
				{ authorization, bucket },
			);

			expect(await errorOf(response)).toMatchObject({
				status: 429,
				code: SERVER_ERROR.AGENT_DAILY_IMAGE_BUDGET_EXCEEDED,
			});
			expect(bucket.put).toHaveBeenCalledTimes(1);
			expect(objects.size).toBe(0);
		} finally {
			await releaseBudget();
		}
	});

	it('answers 503 when storing the image fails, keeping no reference', async () => {
		const target = await createWishlistFixture();
		const authorization = await tokenFor(MANAGER_ID);
		const { bucket } = fakeBucket();
		vi.mocked(bucket.put).mockRejectedValueOnce(new Error('R2 unavailable'));
		imageHost(pngResponse());
		const imagesBefore = (await storedImagesOf(MANAGER_ID)).length;
		vi.spyOn(console, 'error').mockImplementation(() => {});

		const response = await callUpload(
			{ wishlistId: target.id, url: 'https://shop.example/kolo.png' },
			{ authorization, bucket },
		);

		expect(await errorOf(response)).toMatchObject({
			status: 503,
			code: SERVER_ERROR.AGENT_IMAGE_STORAGE_UNAVAILABLE,
		});
		expect(await storedImagesOf(MANAGER_ID)).toHaveLength(imagesBefore);
	});

	it('counts only the token user’s own images against the budget', async () => {
		const target = await createWishlistFixture();
		const authorization = await tokenFor(MANAGER_ID);
		const releaseBudget = await fillImageBudget(RECIPIENT_ID, target.id, 'other-user');
		const { bucket } = fakeBucket();
		imageHost(pngResponse());

		try {
			const response = await callUpload(
				{ wishlistId: target.id, url: 'https://shop.example/kolo.png' },
				{ authorization, bucket },
			);

			expect(response.status).toBe(201);
		} finally {
			await releaseBudget();
		}
	});

	it('rejects an archived wishlist before downloading', async () => {
		const target = await createWishlistFixture({ status: 'archived' });
		const authorization = await tokenFor(MANAGER_ID);
		const { bucket } = fakeBucket();
		const fetch = imageHost(pngResponse());

		const response = await callUpload(
			{ wishlistId: target.id, url: 'https://shop.example/kolo.png' },
			{ authorization, bucket },
		);

		expect(await errorOf(response)).toMatchObject({
			status: 400,
			code: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
		});
		expect(fetch).not.toHaveBeenCalled();
	});

	it('answers 429 with Retry-After once the user’s daily image budget is used up', async () => {
		const target = await createWishlistFixture();
		const authorization = await tokenFor(MANAGER_ID);
		const { bucket } = fakeBucket();
		const releaseBudget = await fillImageBudget(MANAGER_ID, target.id, 'budget');
		const fetch = imageHost(pngResponse());

		try {
			const response = await callUpload(
				{ wishlistId: target.id, url: 'https://shop.example/kolo.png' },
				{ authorization, bucket },
			);

			expect(await errorOf(response)).toMatchObject({
				status: 429,
				code: SERVER_ERROR.AGENT_DAILY_IMAGE_BUDGET_EXCEEDED,
				budgetImages: AGENT_DAILY_IMAGE_BUDGET.images,
			});
			expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
			expect(fetch).not.toHaveBeenCalled();
		} finally {
			await releaseBudget();
		}
	});
});
