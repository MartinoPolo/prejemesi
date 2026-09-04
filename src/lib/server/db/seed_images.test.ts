import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareSeedImages, SEED_IMAGE_MANIFEST, type SeedImageDefinition } from './seed_images.js';

const VALID_JPEG = Uint8Array.from([
	0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff,
	0xd9,
]);
const TEST_MANIFEST = [
	{
		objectKey: 'seed/one.jpg',
		sourceUrl: 'https://images.example/one',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/two.jpg',
		sourceUrl: 'https://images.example/two',
		contentType: 'image/jpeg',
	},
] as const satisfies readonly SeedImageDefinition[];

const temporaryDirectories: string[] = [];

async function temporaryCache(): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), 'prejemesi-seed-images-'));
	temporaryDirectories.push(directory);
	return directory;
}

async function putCached(cacheDirectory: string, objectKey: string, bytes = VALID_JPEG) {
	const path = join(cacheDirectory, objectKey);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, bytes);
	return path;
}

function successfulFetch() {
	return vi.fn(
		async () =>
			new Response(VALID_JPEG, {
				status: 200,
				headers: { 'content-type': 'image/jpeg' },
			}),
	) as unknown as typeof fetch;
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
	);
});

describe('prepareSeedImages', () => {
	it('prepares every declared image into an empty cache without database configuration', async () => {
		const cacheDirectory = await temporaryCache();
		const fetchImplementation = successfulFetch();
		const previousDatabaseUrl = process.env.DATABASE_URL;
		Reflect.deleteProperty(process.env, 'DATABASE_URL');

		try {
			const result = await prepareSeedImages({ cacheDirectory, fetchImplementation });

			expect(result).toEqual({
				cached: 0,
				downloaded: SEED_IMAGE_MANIFEST.length,
				total: SEED_IMAGE_MANIFEST.length,
			});
			expect(fetchImplementation).toHaveBeenCalledTimes(SEED_IMAGE_MANIFEST.length);
			for (const definition of SEED_IMAGE_MANIFEST) {
				expect([...(await readFile(join(cacheDirectory, definition.objectKey)))]).toEqual([
					...VALID_JPEG,
				]);
			}
		} finally {
			if (previousDatabaseUrl === undefined) {
				Reflect.deleteProperty(process.env, 'DATABASE_URL');
			} else {
				process.env.DATABASE_URL = previousDatabaseUrl;
			}
		}
	});

	it('repairs only the missing entry in a partial cache', async () => {
		const cacheDirectory = await temporaryCache();
		const validPath = await putCached(cacheDirectory, TEST_MANIFEST[0].objectKey);
		const before = await stat(validPath);
		const fetchImplementation = successfulFetch();

		const result = await prepareSeedImages({
			cacheDirectory,
			fetchImplementation,
			manifest: TEST_MANIFEST,
		});

		expect(result).toEqual({ cached: 1, downloaded: 1, total: 2 });
		expect(fetchImplementation).toHaveBeenCalledTimes(1);
		expect(fetchImplementation).toHaveBeenCalledWith(TEST_MANIFEST[1].sourceUrl, {
			redirect: 'follow',
		});
		expect((await stat(validPath)).mtimeMs).toBe(before.mtimeMs);
	});

	it.each([
		['empty', new Uint8Array()],
		['invalid', new TextEncoder().encode('not an image')],
		['corrupt', VALID_JPEG.slice(0, -2)],
	])('atomically repairs a %s cache entry', async (_description, invalidBytes) => {
		const cacheDirectory = await temporaryCache();
		const path = await putCached(cacheDirectory, TEST_MANIFEST[0].objectKey, invalidBytes);
		const fetchImplementation = successfulFetch();

		const result = await prepareSeedImages({
			cacheDirectory,
			fetchImplementation,
			manifest: [TEST_MANIFEST[0]],
		});

		expect(result).toEqual({ cached: 0, downloaded: 1, total: 1 });
		expect([...(await readFile(path))]).toEqual([...VALID_JPEG]);
		expect(await readdir(dirname(path))).toEqual(['one.jpg']);
	});

	it('does not download or modify a complete valid cache', async () => {
		const cacheDirectory = await temporaryCache();
		const paths = await Promise.all(
			TEST_MANIFEST.map(({ objectKey }) => putCached(cacheDirectory, objectKey)),
		);
		const before = await Promise.all(paths.map((path) => stat(path)));
		const fetchImplementation = vi.fn(() => {
			throw new Error('network must not be used');
		}) as unknown as typeof fetch;

		const result = await prepareSeedImages({
			cacheDirectory,
			fetchImplementation,
			manifest: TEST_MANIFEST,
		});

		expect(result).toEqual({ cached: 2, downloaded: 0, total: 2 });
		expect(fetchImplementation).not.toHaveBeenCalled();
		const after = await Promise.all(paths.map((path) => stat(path)));
		expect(after.map(({ mtimeMs }) => mtimeMs)).toEqual(before.map(({ mtimeMs }) => mtimeMs));
	});

	it('reports every failure once and leaves no partial destination or temporary file', async () => {
		const cacheDirectory = await temporaryCache();
		const fetchImplementation = vi.fn(async (input: string | URL | Request) => {
			return String(input).endsWith('/one')
				? new Response(null, { status: 503, headers: { 'content-type': 'image/jpeg' } })
				: new Response(new TextEncoder().encode('broken'), {
						status: 200,
						headers: { 'content-type': 'image/jpeg' },
					});
		}) as unknown as typeof fetch;

		const preparation = prepareSeedImages({
			cacheDirectory,
			fetchImplementation,
			manifest: TEST_MANIFEST,
		});

		await expect(preparation).rejects.toThrow(
			/Could not prepare required seed images:[\s\S]*seed\/one\.jpg[\s\S]*seed\/two\.jpg[\s\S]*Run `pnpm seed:images` and try again\./,
		);
		expect(await readdir(cacheDirectory)).toEqual([]);
	});
});
