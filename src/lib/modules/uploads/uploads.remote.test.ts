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
// The Vite transform injects `fn.__.id = ...` for every export after calling
// init_remote_functions, so each returned handler must carry a `__` object.
function wrapWithRemoteMarker(
	handler: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
	(handler as unknown as Record<string, unknown>).__ = {};
	return handler;
}

vi.mock('$lib/server/remote.js', () => ({
	guardedCommand: vi.fn((handler: (...args: unknown[]) => unknown) =>
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

import { authorizeUpload } from './uploads.remote.js';
import type { UploadAuthorization } from './types.js';

// ── Typed handler alias ─────────────────────────────────────────────────────
// guardedCommand wraps (authContext, arg) => result. The mock returns the raw
// handler, so authorizeUpload IS (authContext, input) => UploadAuthorization.

const fakeAuthContext = { user: { id: 'test-user' }, session: {} };

type AuthorizeUploadHandler = (
	authContext: typeof fakeAuthContext,
	input: {
		target: string;
		fileName: string;
		contentType: string;
		fileSize: number;
	},
) => UploadAuthorization;

const callAuthorizeUpload = (input: {
	target: string;
	fileName: string;
	contentType: string;
	fileSize: number;
}): UploadAuthorization => {
	return (authorizeUpload as unknown as AuthorizeUploadHandler)(fakeAuthContext, input);
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
			({ target, prefix, contentType, extension }) => {
				const result = callAuthorizeUpload({
					target,
					fileName: `photo.${extension}`,
					contentType,
					fileSize: 1024 * 1024,
				});

				expect(result.objectKey).toBe(`${prefix}/test-id-123.${extension}`);
				expect(result.uploadUrl).toMatch(/^\/api\/upload\//);
				expect(result.publicUrl).toContain(result.objectKey);
			},
		);
	});

	// ── Object key format ────────────────────────────────────────────────────

	describe('object key format', () => {
		it('follows {prefix}/{uniqueId}.{extension} pattern', () => {
			const result = callAuthorizeUpload({
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
		it('starts with /api/upload/', () => {
			const result = callAuthorizeUpload({
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
		it('contains the object key', () => {
			const result = callAuthorizeUpload({
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
		it('throws 400 for unknown target', () => {
			expect(() =>
				callAuthorizeUpload({
					target: 'unknown-target',
					fileName: 'file.jpg',
					contentType: 'image/jpeg',
					fileSize: 1024,
				}),
			).toThrowError(
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
			(contentType) => {
				expect(() =>
					callAuthorizeUpload({
						target: 'gift-image',
						fileName: 'file',
						contentType,
						fileSize: 1024,
					}),
				).toThrowError(
					expect.objectContaining({
						status: 400,
						message: expect.stringContaining('Invalid content type'),
					}),
				);
			},
		);

		it.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])(
			'accepts %s',
			(contentType) => {
				expect(() =>
					callAuthorizeUpload({
						target: 'gift-image',
						fileName: 'file',
						contentType,
						fileSize: 1024,
					}),
				).not.toThrow();
			},
		);
	});

	// ── File size validation ─────────────────────────────────────────────────

	describe('file size validation', () => {
		it('rejects 0 bytes', () => {
			expect(() =>
				callAuthorizeUpload({
					target: 'gift-image',
					fileName: 'file.jpg',
					contentType: 'image/jpeg',
					fileSize: 0,
				}),
			).toThrowError(
				expect.objectContaining({
					status: 400,
					message: 'File size must be greater than 0',
				}),
			);
		});

		it('rejects negative file size', () => {
			expect(() =>
				callAuthorizeUpload({
					target: 'gift-image',
					fileName: 'file.jpg',
					contentType: 'image/jpeg',
					fileSize: -1,
				}),
			).toThrowError(expect.objectContaining({ status: 400 }));
		});

		it.each([
			{ target: 'gift-image', maxBytes: 5 * 1024 * 1024, label: '5MB' },
			{ target: 'wishlist-banner', maxBytes: 10 * 1024 * 1024, label: '10MB' },
			{ target: 'wishlist-thumbnail', maxBytes: 5 * 1024 * 1024, label: '5MB' },
		])('$target: rejects file over $label limit', ({ target, maxBytes }) => {
			expect(() =>
				callAuthorizeUpload({
					target,
					fileName: 'big.jpg',
					contentType: 'image/jpeg',
					fileSize: maxBytes + 1,
				}),
			).toThrowError(
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
		])('$target: accepts file exactly at limit ($maxBytes bytes)', ({ target, maxBytes }) => {
			const result = callAuthorizeUpload({
				target,
				fileName: 'max.jpg',
				contentType: 'image/jpeg',
				fileSize: maxBytes,
			});

			expect(result.objectKey).toBeTruthy();
		});

		it('rejects file at limit+1 byte (off-by-one boundary)', () => {
			const limit = 5 * 1024 * 1024;

			expect(() =>
				callAuthorizeUpload({
					target: 'gift-image',
					fileName: 'file.jpg',
					contentType: 'image/jpeg',
					fileSize: limit + 1,
				}),
			).toThrowError(
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
		])('maps %s to .%s extension in objectKey', (contentType, expectedExtension) => {
			const result = callAuthorizeUpload({
				target: 'gift-image',
				fileName: `file.${expectedExtension}`,
				contentType,
				fileSize: 1024,
			});

			expect(result.objectKey).toBe(`gifts/test-id-123.${expectedExtension}`);
		});
	});
});
