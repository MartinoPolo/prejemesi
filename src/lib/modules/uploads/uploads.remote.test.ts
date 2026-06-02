import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Suppress SvelteKit's remote-function validator injected by the Vite transform
vi.mock('@sveltejs/kit/internal', () => ({
	init_remote_functions: vi.fn(),
}));

// ── Mock $app/server to prevent SvelteKit remote-function validation ─────────
vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(),
	query: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
	command: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
}));

// ── Mock remote wrappers — extract handlers directly ────────────────────────
function wrapWithRemoteMarker(
	handler: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
	(handler as unknown as Record<string, unknown>).__ = {};
	return handler;
}

vi.mock('$lib/server/remote.js', () => ({
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
}));

// ── Mock SvelteKit error so it throws with a .status property ───────────────
vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

vi.mock('$lib/server/db/id.js', () => ({
	generateId: vi.fn(() => 'test-id-123'),
}));

vi.mock('$env/dynamic/private', () => ({
	env: { AUTH_SECRET: 'test-auth-secret-for-hmac' },
}));

vi.mock('$lib/server/storage/r2.js', async () => {
	const types = await import('./types.js');
	return {
		UPLOAD_TARGETS: {
			'gift-image': 'gifts',
			'wishlist-banner': 'wishlists/banners',
			'wishlist-thumbnail': 'wishlists/thumbnails',
			avatar: 'avatars',
		} as Record<string, string>,
		MAX_FILE_SIZE: {
			'gift-image': 5 * 1024 * 1024,
			'wishlist-banner': 10 * 1024 * 1024,
			'wishlist-thumbnail': 5 * 1024 * 1024,
			avatar: 5 * 1024 * 1024,
		} as Record<string, number>,
		isAllowedContentType: types.isAllowedContentType,
		getPublicUrl: vi.fn((objectKey: string) => `https://cdn.example.com/${objectKey}`),
	};
});

import { authorizeUpload, authorizeDelete } from './uploads.remote.js';
import type { UploadAuthorization, DeleteAuthorization } from './types.js';

// ── Typed handler aliases ───────────────────────────────────────────────────
const fakeAuthContext = { user: { id: 'test-user' }, session: {} };

const callAuthorizeUpload = async (input: {
	target: string;
	fileName: string;
	contentType: string;
	fileSize: number;
}): Promise<UploadAuthorization> => {
	return (authorizeUpload as unknown as (...args: unknown[]) => Promise<unknown>)(
		fakeAuthContext,
		input,
	) as Promise<UploadAuthorization>;
};

const callAuthorizeDelete = async (input: { objectKey: string }): Promise<DeleteAuthorization> => {
	return (authorizeDelete as unknown as (...args: unknown[]) => Promise<unknown>)(
		fakeAuthContext,
		input,
	) as Promise<DeleteAuthorization>;
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe('authorizeUpload', () => {
	// ── Valid uploads for all targets ──────────────────────────────────────────

	describe('valid uploads for all targets', () => {
		it.each([
			{ target: 'gift-image', prefix: 'gifts', contentType: 'image/jpeg', extension: 'jpg' },
			{
				target: 'wishlist-banner',
				prefix: 'wishlists/banners',
				contentType: 'image/png',
				extension: 'png',
			},
			{
				target: 'wishlist-thumbnail',
				prefix: 'wishlists/thumbnails',
				contentType: 'image/webp',
				extension: 'webp',
			},
		])(
			'$target returns objectKey with $prefix/ prefix',
			async ({ target, prefix, contentType, extension }) => {
				const result = await callAuthorizeUpload({
					target,
					fileName: `photo.${extension}`,
					contentType,
					fileSize: 1024 * 1024,
				});

				expect(result.objectKey).toBe(`${prefix}/test-id-123.${extension}`);
				expect(result.uploadUrl).toMatch(/^\/api\/upload\//);
				expect(result.publicUrl).toContain(result.objectKey);
				expect(result.token).toBeTypeOf('string');
				expect(result.token).toContain('.');
				expect(result.expiresAt).toBeTypeOf('number');
				expect(result.expiresAt).toBeGreaterThan(Date.now());
			},
		);
	});

	// ── Object key format ────────────────────────────────────────────────────

	describe('object key format', () => {
		it('follows {prefix}/{uniqueId}.{extension} pattern', async () => {
			const result = await callAuthorizeUpload({
				target: 'gift-image',
				fileName: 'photo.jpg',
				contentType: 'image/jpeg',
				fileSize: 1024,
			});

			expect(result.objectKey).toMatch(/^gifts\/[a-zA-Z0-9_-]+\.jpg$/);
		});
	});

	// ── Upload URL format ────────────────────────────────────────────────────

	describe('upload URL format', () => {
		it('starts with /api/upload/', async () => {
			const result = await callAuthorizeUpload({
				target: 'gift-image',
				fileName: 'photo.jpg',
				contentType: 'image/jpeg',
				fileSize: 1024,
			});

			expect(result.uploadUrl).toBe('/api/upload/gifts/test-id-123.jpg');
		});
	});

	// ── Public URL ───────────────────────────────────────────────────────────

	describe('public URL', () => {
		it('contains the object key', async () => {
			const result = await callAuthorizeUpload({
				target: 'gift-image',
				fileName: 'photo.jpg',
				contentType: 'image/jpeg',
				fileSize: 1024,
			});

			expect(result.publicUrl).toBe('https://cdn.example.com/gifts/test-id-123.jpg');
		});
	});

	// ── Invalid target ───────────────────────────────────────────────────────

	describe('invalid target', () => {
		it('throws 400 for unknown target', async () => {
			await expect(
				callAuthorizeUpload({
					target: 'unknown-target',
					fileName: 'file.jpg',
					contentType: 'image/jpeg',
					fileSize: 1024,
				}),
			).rejects.toThrow(
				expect.objectContaining({
					status: 400,
					message: expect.stringContaining('Invalid upload target'),
				}),
			);
		});
	});

	// ── Content type validation ──────────────────────────────────────────────

	describe('content type validation', () => {
		it.each(['application/pdf', 'text/html', 'image/svg+xml', 'video/mp4'])(
			'rejects %s',
			async (contentType) => {
				await expect(
					callAuthorizeUpload({
						target: 'gift-image',
						fileName: 'file',
						contentType,
						fileSize: 1024,
					}),
				).rejects.toThrow(
					expect.objectContaining({
						status: 400,
						message: expect.stringContaining('Invalid content type'),
					}),
				);
			},
		);

		it.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])(
			'accepts %s',
			async (contentType) => {
				await expect(
					callAuthorizeUpload({
						target: 'gift-image',
						fileName: 'file',
						contentType,
						fileSize: 1024,
					}),
				).resolves.toBeTruthy();
			},
		);
	});

	// ── File size validation ─────────────────────────────────────────────────

	describe('file size validation', () => {
		it('rejects 0 bytes', async () => {
			await expect(
				callAuthorizeUpload({
					target: 'gift-image',
					fileName: 'file.jpg',
					contentType: 'image/jpeg',
					fileSize: 0,
				}),
			).rejects.toThrow(
				expect.objectContaining({
					status: 400,
					message: 'File size must be greater than 0',
				}),
			);
		});

		it('rejects negative file size', async () => {
			await expect(
				callAuthorizeUpload({
					target: 'gift-image',
					fileName: 'file.jpg',
					contentType: 'image/jpeg',
					fileSize: -1,
				}),
			).rejects.toThrow(expect.objectContaining({ status: 400 }));
		});

		it.each([
			{ target: 'gift-image', maxBytes: 5 * 1024 * 1024, label: '5MB' },
			{ target: 'wishlist-banner', maxBytes: 10 * 1024 * 1024, label: '10MB' },
			{ target: 'wishlist-thumbnail', maxBytes: 5 * 1024 * 1024, label: '5MB' },
		])('$target: rejects file over $label limit', async ({ target, maxBytes }) => {
			await expect(
				callAuthorizeUpload({
					target,
					fileName: 'big.jpg',
					contentType: 'image/jpeg',
					fileSize: maxBytes + 1,
				}),
			).rejects.toThrow(
				expect.objectContaining({
					status: 400,
					message: expect.stringContaining('File too large'),
				}),
			);
		});

		it.each([
			{ target: 'gift-image', maxBytes: 5 * 1024 * 1024 },
			{ target: 'wishlist-banner', maxBytes: 10 * 1024 * 1024 },
			{ target: 'wishlist-thumbnail', maxBytes: 5 * 1024 * 1024 },
		])(
			'$target: accepts file exactly at limit ($maxBytes bytes)',
			async ({ target, maxBytes }) => {
				const result = await callAuthorizeUpload({
					target,
					fileName: 'max.jpg',
					contentType: 'image/jpeg',
					fileSize: maxBytes,
				});

				expect(result.objectKey).toBeTruthy();
			},
		);

		it('rejects file at limit+1 byte (off-by-one boundary)', async () => {
			const limit = 5 * 1024 * 1024;

			await expect(
				callAuthorizeUpload({
					target: 'gift-image',
					fileName: 'file.jpg',
					contentType: 'image/jpeg',
					fileSize: limit + 1,
				}),
			).rejects.toThrow(
				expect.objectContaining({
					status: 400,
					message: expect.stringContaining('File too large'),
				}),
			);
		});
	});

	// ── Extension mapping ────────────────────────────────────────────────────

	describe('extension mapping', () => {
		it.each([
			['image/jpeg', 'jpg'],
			['image/png', 'png'],
			['image/webp', 'webp'],
			['image/gif', 'gif'],
		])('maps %s to .%s extension in objectKey', async (contentType, expectedExtension) => {
			const result = await callAuthorizeUpload({
				target: 'gift-image',
				fileName: `file.${expectedExtension}`,
				contentType,
				fileSize: 1024,
			});

			expect(result.objectKey).toBe(`gifts/test-id-123.${expectedExtension}`);
		});
	});
});

describe('authorizeDelete', () => {
	it('returns a token and expiresAt for a valid object key', async () => {
		const result = await callAuthorizeDelete({ objectKey: 'gifts/test-id-123.jpg' });

		expect(result.token).toBeTypeOf('string');
		expect(result.token).toContain('.');
		expect(result.expiresAt).toBeTypeOf('number');
		expect(result.expiresAt).toBeGreaterThan(Date.now());
	});

	it('throws 400 for an empty object key', async () => {
		await expect(callAuthorizeDelete({ objectKey: '' })).rejects.toThrow(
			expect.objectContaining({
				status: 400,
				message: 'Missing object key',
			}),
		);
	});
});
