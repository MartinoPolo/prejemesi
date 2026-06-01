import { vi, describe, it, expect, beforeEach } from 'vitest';

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

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

vi.mock('$lib/server/remote.js', () => ({
	guardedCommand: vi.fn((handler: (...args: unknown[]) => unknown) => {
		// Attach the __type metadata that SvelteKit's init_remote_functions expects,
		// while still making the exported value directly callable as the handler.
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'command' };
		return wrapped;
	}),
}));

vi.mock('$lib/server/db/id.js', () => ({
	generateId: vi.fn(() => 'test-id-123'),
}));

vi.mock('$lib/server/storage/r2.js', () => ({
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
	isAllowedContentType: vi.fn((contentType: string) =>
		['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType),
	),
	getPublicUrl: vi.fn((objectKey: string) => `https://cdn.example.com/${objectKey}`),
}));

import { authorizeUpload } from './uploads.remote.js';
import { isAllowedContentType } from '$lib/server/storage/r2.js';
import type { UploadAuthorization } from './types.js';

const mockIsAllowedContentType = vi.mocked(isAllowedContentType);

// After the guardedCommand mock, authorizeUpload IS the raw handler (_authContext, input) => ...
const callAuthorizeUpload = (input: {
	target: string;
	fileName: string;
	contentType: string;
	fileSize: number;
}): UploadAuthorization => {
	return (authorizeUpload as unknown as (...args: unknown[]) => unknown)(
		null,
		input,
	) as UploadAuthorization;
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe('authorizeUpload', () => {
	describe('valid input', () => {
		it('returns objectKey, uploadUrl, and publicUrl for a valid gift-image upload', () => {
			const result = callAuthorizeUpload({
				target: 'gift-image',
				fileName: 'photo.jpg',
				contentType: 'image/jpeg',
				fileSize: 1024 * 1024,
			});

			expect(result.objectKey).toBe('gifts/test-id-123.jpg');
			expect(result.uploadUrl).toBe('/api/upload/gifts/test-id-123.jpg');
			expect(result.publicUrl).toBe('https://cdn.example.com/gifts/test-id-123.jpg');
		});

		it('returns correct paths for wishlist-banner target', () => {
			const result = callAuthorizeUpload({
				target: 'wishlist-banner',
				fileName: 'banner.png',
				contentType: 'image/png',
				fileSize: 2 * 1024 * 1024,
			});

			expect(result.objectKey).toBe('wishlists/banners/test-id-123.png');
			expect(result.uploadUrl).toBe('/api/upload/wishlists/banners/test-id-123.png');
			expect(result.publicUrl).toBe(
				'https://cdn.example.com/wishlists/banners/test-id-123.png',
			);
		});
	});

	describe('invalid target', () => {
		it('throws 400 with "Invalid upload target" for an unknown target', () => {
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

	describe('invalid content type', () => {
		it('throws 400 with "Invalid content type" for an unsupported MIME type', () => {
			expect(() =>
				callAuthorizeUpload({
					target: 'gift-image',
					fileName: 'file.pdf',
					contentType: 'application/pdf',
					fileSize: 1024,
				}),
			).toThrowError(
				expect.objectContaining({
					status: 400,
					message: expect.stringContaining('Invalid content type'),
				}),
			);
		});
	});

	describe('file size validation', () => {
		it('throws 400 with "File size must be greater than 0" when fileSize is zero', () => {
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

		it('throws 400 when fileSize is negative', () => {
			expect(() =>
				callAuthorizeUpload({
					target: 'gift-image',
					fileName: 'file.jpg',
					contentType: 'image/jpeg',
					fileSize: -1,
				}),
			).toThrowError(expect.objectContaining({ status: 400 }));
		});

		it('throws 400 with "File too large" when fileSize exceeds the target limit', () => {
			expect(() =>
				callAuthorizeUpload({
					target: 'gift-image',
					fileName: 'big.jpg',
					contentType: 'image/jpeg',
					fileSize: 6 * 1024 * 1024, // 6 MB — over the 5 MB gift-image limit
				}),
			).toThrowError(
				expect.objectContaining({
					status: 400,
					message: expect.stringContaining('File too large'),
				}),
			);
		});

		it('accepts a file exactly at the maximum allowed size', () => {
			const result = callAuthorizeUpload({
				target: 'gift-image',
				fileName: 'max.jpg',
				contentType: 'image/jpeg',
				fileSize: 5 * 1024 * 1024, // exactly 5 MB
			});

			expect(result.objectKey).toBe('gifts/test-id-123.jpg');
		});
	});

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

		it('falls back to .bin extension for an unknown content type that passes isAllowedContentType', () => {
			mockIsAllowedContentType.mockReturnValueOnce(true);

			const result = callAuthorizeUpload({
				target: 'gift-image',
				fileName: 'file.unknown',
				contentType: 'image/tiff',
				fileSize: 1024,
			});

			expect(result.objectKey).toBe('gifts/test-id-123.bin');
		});
	});
});
