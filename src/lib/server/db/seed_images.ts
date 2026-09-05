import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve, sep } from 'node:path';

export interface SeedImageDefinition {
	objectKey: string;
	sourceUrl: string;
	contentType: 'image/jpeg';
}

export const SEED_IMAGE_MANIFEST: readonly SeedImageDefinition[] = [
	{
		objectKey: 'seed/wl-xmas2026.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1765194493212-874b062ff31a?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/wl-bday.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1531956531700-dc0ee0f1f9a5?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/wl-svatek.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1775138386053-5766c8c10e85?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/wl-knihy.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1747913647304-9f298ff28ff4?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-ps5.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1622297845775-5ff3fef71d13?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-bunda.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1487793433179-ce0b55eda342?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-sapiens.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1710578472398-1edbbd348b79?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-sony.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1621208587196-0b2a7d2aeb03?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-batoh.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-kytara.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1589131626349-2799f057b43a?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-parfem.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1583545889266-55be2d76c6c5?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-catan.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1606733847546-db8546099013?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-kindle.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1455541504462-57ebb2a9cec1?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-puzzle.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1494059980473-813e73ee784b?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-svicka.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1574266742257-41460b7992ee?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-kabelka.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1683921470299-b8f0f3331657?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-satek.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1753807971479-5a51e1445b78?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-lego.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-lampicka.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1547091267-6b2be403a763?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-mixer.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-monstera.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1503149779833-1de50ebe5f8a?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-dune.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1710578472398-1edbbd348b79?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-1984.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1710578472398-1edbbd348b79?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-ponozky.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-poukaz.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-advent.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-kavovar.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-kolo.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-monitor.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-stan.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-sachy.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1528819622765-d6bcf132f793?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-kytice.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1487070183336-b863922373d4?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-hodinky-d.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-caj.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&q=80',
		contentType: 'image/jpeg',
	},
	{
		objectKey: 'seed/g-sklenice.jpg',
		sourceUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80',
		contentType: 'image/jpeg',
	},
];

export interface PrepareSeedImagesOptions {
	cacheDirectory?: string;
	fetchImplementation?: typeof fetch;
	manifest?: readonly SeedImageDefinition[];
}

export interface PrepareSeedImagesResult {
	cached: number;
	downloaded: number;
	total: number;
}

interface SeedImageFailure {
	objectKey: string;
	reason: string;
}

class SeedImagePreparationError extends Error {
	readonly failures: readonly SeedImageFailure[];

	constructor(failures: readonly SeedImageFailure[]) {
		super(
			[
				'Could not prepare required seed images:',
				...failures.map(({ objectKey, reason }) => `- ${objectKey}: ${reason}`),
				'Run `pnpm seed:images` and try again.',
			].join('\n'),
		);
		this.name = 'SeedImagePreparationError';
		this.failures = failures;
	}
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
	if (
		bytes.length < 14 ||
		bytes[0] !== 0xff ||
		bytes[1] !== 0xd8 ||
		bytes[bytes.length - 2] !== 0xff ||
		bytes[bytes.length - 1] !== 0xd9
	) {
		return null;
	}

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = 2;
	while (offset + 4 <= bytes.length - 2) {
		if (bytes[offset] !== 0xff) {
			offset += 1;
			continue;
		}
		while (bytes[offset] === 0xff) {
			offset += 1;
		}
		const marker = bytes[offset];
		if (marker === undefined || marker === 0xd9 || marker === 0xda) {
			break;
		}
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
			offset += 1;
			continue;
		}
		if (offset + 2 >= bytes.length) {
			return null;
		}
		const segmentLength = view.getUint16(offset + 1);
		if (segmentLength < 2 || offset + 1 + segmentLength > bytes.length - 2) {
			return null;
		}
		if (
			[0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
				marker,
			)
		) {
			if (segmentLength < 7) {
				return null;
			}
			const height = view.getUint16(offset + 4);
			const width = view.getUint16(offset + 6);
			return width > 0 && height > 0 ? { width, height } : null;
		}
		offset += 1 + segmentLength;
	}
	return null;
}

function isValidSeedImage(
	bytes: Uint8Array,
	contentType: SeedImageDefinition['contentType'],
): boolean {
	return contentType === 'image/jpeg' && jpegDimensions(bytes) !== null;
}

function destinationPath(cacheDirectory: string, objectKey: string): string {
	const destination = resolve(cacheDirectory, objectKey);
	const cacheRoot = resolve(cacheDirectory);
	if (destination !== cacheRoot && !destination.startsWith(`${cacheRoot}${sep}`)) {
		throw new Error('object key escapes the seed image cache');
	}
	return destination;
}

async function readValidCachedImage(
	path: string,
	contentType: SeedImageDefinition['contentType'],
): Promise<boolean> {
	try {
		return isValidSeedImage(await readFile(path), contentType);
	} catch {
		return false;
	}
}

async function downloadSeedImage(
	definition: SeedImageDefinition,
	path: string,
	fetchImplementation: typeof fetch,
): Promise<void> {
	const response = await fetchImplementation(definition.sourceUrl, { redirect: 'follow' });
	if (!response.ok) {
		throw new Error(`HTTP ${String(response.status)}`);
	}
	const responseContentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim();
	if (responseContentType !== definition.contentType) {
		throw new Error(
			`expected ${definition.contentType}, received ${responseContentType ?? 'no type'}`,
		);
	}
	const bytes = new Uint8Array(await response.arrayBuffer());
	if (!isValidSeedImage(bytes, definition.contentType)) {
		throw new Error('downloaded bytes are not a valid JPEG image');
	}

	await mkdir(dirname(path), { recursive: true });
	const temporaryPath = resolve(
		dirname(path),
		`.${basename(path)}.${String(process.pid)}.${randomUUID()}.tmp`,
	);
	try {
		await writeFile(temporaryPath, bytes, { flag: 'wx' });
		await rename(temporaryPath, path);
	} finally {
		await rm(temporaryPath, { force: true });
	}
}

export async function prepareSeedImages(
	options: PrepareSeedImagesOptions = {},
): Promise<PrepareSeedImagesResult> {
	const cacheDirectory = options.cacheDirectory ?? resolve(process.cwd(), '.seed-uploads');
	const fetchImplementation = options.fetchImplementation ?? fetch;
	const manifest = options.manifest ?? SEED_IMAGE_MANIFEST;
	const failures: SeedImageFailure[] = [];
	let cached = 0;
	let downloaded = 0;

	for (const definition of manifest) {
		let path: string;
		try {
			path = destinationPath(cacheDirectory, definition.objectKey);
			if (await readValidCachedImage(path, definition.contentType)) {
				cached += 1;
				continue;
			}
			await downloadSeedImage(definition, path, fetchImplementation);
			downloaded += 1;
		} catch (error) {
			failures.push({
				objectKey: definition.objectKey,
				reason: error instanceof Error ? error.message : String(error),
			});
		}
	}

	if (failures.length > 0) {
		throw new SeedImagePreparationError(failures);
	}
	return { cached, downloaded, total: manifest.length };
}
