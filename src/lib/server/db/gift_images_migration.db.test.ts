import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL ?? '';
const temporarySchema = `test_gift_images_${Date.now()}_${Math.random().toString(36).slice(2)}`;

function isLocalDatabaseUrl(value: string): boolean {
	try {
		const hostname = new URL(value).hostname.toLowerCase();
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
	} catch {
		return false;
	}
}

let database: ReturnType<typeof postgres> | null = null;
let schemaCreated = false;

async function connectToUsableLocalDatabase(): Promise<boolean> {
	if (!isLocalDatabaseUrl(databaseUrl)) {
		return false;
	}
	const candidate = postgres(databaseUrl, { max: 1, onnotice: () => undefined });
	try {
		await candidate`SELECT 1`;
		database = candidate;
		return true;
	} catch {
		await candidate.end().catch(() => undefined);
		return false;
	}
}

const databaseReady = await connectToUsableLocalDatabase();

beforeAll(async () => {
	if (database === null) {
		return;
	}
	await database.unsafe(`CREATE SCHEMA "${temporarySchema}"`);
	schemaCreated = true;
	await database.unsafe(`SET search_path TO "${temporarySchema}"`);
	await database.unsafe(`
		CREATE TABLE gift (
			id text PRIMARY KEY NOT NULL,
			name text NOT NULL,
			image_url text,
			image_key text,
			image_meta jsonb,
			deleted_at timestamp with time zone
		)
	`);
	await database.unsafe(`
		INSERT INTO gift (id, name, image_url, image_key, image_meta, deleted_at) VALUES
			('gift-uploaded', 'Uploaded', '/api/upload/a', 'a', '{"fitMode":"auto"}', NULL),
			('gift-agent-upload', 'Agent upload', NULL, 'agent-key', NULL, NULL),
			('gift-deleted', 'Deleted', 'https://example.com/x.png', NULL, NULL, now()),
			('gift-without-image', 'No image', NULL, NULL, NULL, NULL)
	`);

	const migrationSql = await readFile(
		new URL('../../../../drizzle/0033_add-gift-images.sql', import.meta.url),
		'utf8',
	);
	// The temporary schema stands in for "public".
	const schemaLocalSql = migrationSql.replaceAll('"public".', '');
	// Drizzle applies migrations in one transaction, which the migration's table lock requires.
	await database.begin(async (transaction) => {
		for (const statement of schemaLocalSql.split('--> statement-breakpoint')) {
			if (statement.trim() !== '') {
				await transaction.unsafe(statement);
			}
		}
	});
});

afterAll(async () => {
	if (database === null) {
		return;
	}
	try {
		if (schemaCreated) {
			await database.unsafe(`DROP SCHEMA IF EXISTS "${temporarySchema}" CASCADE`);
		}
	} finally {
		await database.end().catch(() => undefined);
		database = null;
	}
});

interface GalleryRow {
	position: number;
	image_url: string | null;
	image_key: string | null;
	image_meta: unknown;
}

async function galleryOf(giftId: string): Promise<GalleryRow[]> {
	return database!<GalleryRow[]>`
		SELECT position, image_url, image_key, image_meta
		FROM gift_image
		WHERE gift_id = ${giftId}
		ORDER BY position
	`;
}

async function insertLaterImages(giftId: string, keys: string[]) {
	for (const [index, key] of keys.entries()) {
		await database!`
			INSERT INTO gift_image (id, gift_id, position, image_key)
			VALUES (${`${giftId}-${key}`}, ${giftId}, ${index + 1}, ${key})
		`;
	}
}

describe.skipIf(!databaseReady)('0033 gift images migration [real DB]', () => {
	it('backfills every gift image, soft-deleted gifts included, as the cover', async () => {
		expect(await galleryOf('gift-uploaded')).toEqual([
			{
				position: 0,
				image_url: '/api/upload/a',
				image_key: 'a',
				image_meta: { fitMode: 'auto' },
			},
		]);
		expect(await galleryOf('gift-agent-upload')).toEqual([
			{ position: 0, image_url: null, image_key: 'agent-key', image_meta: null },
		]);
		expect(await galleryOf('gift-deleted')).toEqual([
			{
				position: 0,
				image_url: 'https://example.com/x.png',
				image_key: null,
				image_meta: null,
			},
		]);
		expect(await galleryOf('gift-without-image')).toEqual([]);
	});

	it('lets a release that writes only the cover columns replace the cover and keep later images', async () => {
		const sql = database!;
		await sql`
			INSERT INTO gift (id, name, image_url, image_key)
			VALUES ('gift-legacy', 'Legacy insert', '/api/upload/first', 'first')
		`;
		expect((await galleryOf('gift-legacy')).map((row) => row.image_key)).toEqual(['first']);

		await insertLaterImages('gift-legacy', ['second', 'third']);
		await sql`
			UPDATE gift SET image_url = '/api/upload/new', image_key = 'new', image_meta = '{"fitMode":"cover-crop"}'
			WHERE id = 'gift-legacy'
		`;
		expect(await galleryOf('gift-legacy')).toEqual([
			{
				position: 0,
				image_url: '/api/upload/new',
				image_key: 'new',
				image_meta: { fitMode: 'cover-crop' },
			},
			{ position: 1, image_url: null, image_key: 'second', image_meta: null },
			{ position: 2, image_url: null, image_key: 'third', image_meta: null },
		]);

		await sql`UPDATE gift SET name = 'Renamed' WHERE id = 'gift-legacy'`;
		expect(await galleryOf('gift-legacy')).toHaveLength(3);
	});

	it('clears the whole gallery when a write clears the cover', async () => {
		const sql = database!;
		await sql`
			INSERT INTO gift (id, name, image_url, image_key)
			VALUES ('gift-cleared', 'Cleared', '/api/upload/a', 'a')
		`;
		await insertLaterImages('gift-cleared', ['b', 'c']);
		expect(await galleryOf('gift-cleared')).toHaveLength(3);

		await sql`UPDATE gift SET image_url = NULL, image_key = NULL, image_meta = NULL WHERE id = 'gift-cleared'`;
		expect(await galleryOf('gift-cleared')).toEqual([]);
	});

	it('leaves a gallery the application already wrote untouched', async () => {
		const sql = database!;
		await sql`INSERT INTO gift (id, name) VALUES ('gift-app', 'App write')`;
		await sql`
			INSERT INTO gift_image (id, gift_id, position, image_url, image_key) VALUES
				('app-0', 'gift-app', 0, '/api/upload/cover', 'cover'),
				('app-1', 'gift-app', 1, NULL, 'later')
		`;
		await sql`UPDATE gift SET image_url = '/api/upload/cover', image_key = 'cover' WHERE id = 'gift-app'`;
		const [cover] = await sql<{ id: string }[]>`
			SELECT id FROM gift_image WHERE gift_id = 'gift-app' AND position = 0
		`;
		expect(cover!.id).toBe('app-0');
		expect((await galleryOf('gift-app')).map((row) => row.image_key)).toEqual([
			'cover',
			'later',
		]);
	});

	it('rejects a ninth image and an image without a source', async () => {
		const sql = database!;
		await sql`INSERT INTO gift (id, name) VALUES ('gift-constraints', 'Constraints')`;
		await expect(
			sql`INSERT INTO gift_image (id, gift_id, position, image_key) VALUES ('ninth', 'gift-constraints', 8, 'x')`,
		).rejects.toThrow(/gift_image_position_range_check/);
		await expect(
			sql`INSERT INTO gift_image (id, gift_id, position) VALUES ('empty', 'gift-constraints', 2)`,
		).rejects.toThrow(/gift_image_source_check/);
	});
});
