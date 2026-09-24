import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storageMocks = vi.hoisted(() => ({
	isR2Available: vi.fn(),
	getObject: vi.fn(),
	putObject: vi.fn(),
	deleteObject: vi.fn(),
}));
const verifyUploadToken = vi.hoisted(() => vi.fn());

vi.mock('$env/dynamic/private', () => ({ env: { AUTH_SECRET: 'test-secret' } }));
vi.mock('$lib/server/storage/r2.js', () => ({
	isAllowedContentType: (contentType: string) => contentType === 'image/jpeg',
	putObject: storageMocks.putObject,
	getObject: storageMocks.getObject,
	deleteObject: storageMocks.deleteObject,
	isR2Available: storageMocks.isR2Available,
	MAX_FILE_SIZE: {
		'gift-image': 5 * 1024 * 1024,
		'wishlist-banner': 10 * 1024 * 1024,
		'avatar-image': 2 * 1024 * 1024,
	},
	UPLOAD_TARGETS: {
		'gift-image': 'gifts',
		'wishlist-banner': 'wishlists',
		'avatar-image': 'avatars',
	},
}));
vi.mock('$lib/server/crypto/upload_token.js', () => ({
	verifyUploadToken,
	TOKEN_PURPOSES: { upload: 'upload', delete: 'delete' },
}));

import { GET, PUT } from './[...path]/+server.js';

const filesystemPaths: string[] = [];
const callGet = GET as unknown as (event: { params: { path?: string } }) => Promise<Response>;
const callPut = PUT as unknown as (event: {
	params: { path?: string };
	request: Request;
	locals: { user: { id: string } | null; session: { id: string } | null };
}) => Promise<Response>;

async function putFilesystemSeed(objectKey: string, bytes: Uint8Array): Promise<void> {
	const path = resolve(process.cwd(), '.seed-uploads', objectKey);
	filesystemPaths.push(path);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, bytes);
}

beforeEach(() => {
	storageMocks.isR2Available.mockReturnValue(false);
	storageMocks.getObject.mockReset();
	storageMocks.putObject.mockReset();
	storageMocks.deleteObject.mockReset();
	verifyUploadToken.mockReset();
});

afterEach(async () => {
	await Promise.all(filesystemPaths.splice(0).map((path) => rm(path, { force: true })));
});

describe('upload GET source precedence', () => {
	it('serves R2 before the filesystem seed cache', async () => {
		const objectKey = 'seed/route-r2-precedence.jpg';
		await putFilesystemSeed(objectKey, Uint8Array.from([1]));
		storageMocks.isR2Available.mockReturnValue(true);
		storageMocks.getObject.mockResolvedValue({
			body: Uint8Array.from([2]).buffer,
			contentType: 'image/jpeg',
			etag: 'r2-etag',
		});

		const response = await callGet({ params: { path: objectKey } });

		expect(response.status).toBe(200);
		expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([2]);
		expect(response.headers.get('etag')).toBe('r2-etag');
	});

	it('serves an existing local upload before the filesystem seed cache', async () => {
		const objectKey = 'gifts/route-local-precedence.jpg';
		await putFilesystemSeed(objectKey, Uint8Array.from([1]));
		verifyUploadToken.mockResolvedValue({
			userId: 'test-user',
			objectKey,
			purpose: 'upload',
			expiresAt: Date.now() + 60_000,
		});
		const putResponse = await callPut({
			params: { path: objectKey },
			request: new Request(`http://localhost/api/upload/${objectKey}`, {
				method: 'PUT',
				headers: {
					'content-type': 'image/jpeg',
					'content-length': '1',
					'x-upload-token': 'token',
				},
				body: Uint8Array.from([3]),
			}),
			locals: { user: { id: 'test-user' }, session: { id: 'test-session' } },
		});

		expect(putResponse.status).toBe(201);
		const response = await callGet({ params: { path: objectKey } });
		expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([3]);
	});

	it('serves a prepared seed image with an image content type', async () => {
		const objectKey = 'seed/route-filesystem.jpg';
		await putFilesystemSeed(objectKey, Uint8Array.from([4]));

		const response = await callGet({ params: { path: objectKey } });

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/jpeg');
		expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([4]);
	});
});
