import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL ?? '';
const temporarySchema = `test_gift_category_ids_${Date.now()}_${Math.random()
	.toString(36)
	.slice(2)}`;

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
		CREATE TABLE gift_category (
			id text PRIMARY KEY NOT NULL,
			wishlist_id text NOT NULL
		)
	`);
	await database.unsafe(`
		CREATE TABLE gift (
			id text PRIMARY KEY NOT NULL,
			wishlist_id text NOT NULL,
			category_id text REFERENCES gift_category(id),
			name text NOT NULL
		)
	`);
	await database.unsafe(`
		INSERT INTO gift_category (id, wishlist_id) VALUES
			('books', 'wishlist'), ('games', 'wishlist'), ('toys', 'wishlist'),
			('home', 'wishlist'), ('garden', 'wishlist'), ('music', 'wishlist')
	`);
	await database.unsafe(`
		INSERT INTO gift (id, wishlist_id, category_id, name) VALUES
			('gift-categorized', 'wishlist', 'books', 'Categorized'),
			('gift-uncategorized', 'wishlist', NULL, 'Uncategorized')
	`);

	const migrationSql = await readFile(
		new URL('../../../../drizzle/0030_add-gift-category-ids.sql', import.meta.url),
		'utf8',
	);
	for (const statement of migrationSql.split('--> statement-breakpoint')) {
		if (statement.trim() !== '') {
			await database.unsafe(statement);
		}
	}
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

async function categoriesOf(giftId: string) {
	const [row] = await database!<{ category_id: string | null; category_ids: string[] }[]>`
		SELECT category_id, category_ids FROM gift WHERE id = ${giftId}
	`;
	return { categoryId: row!.category_id, categoryIds: row!.category_ids };
}

describe.skipIf(!databaseReady)('0030 gift category ids migration [real DB]', () => {
	it('backfills the existing single category as the only one', async () => {
		expect(await categoriesOf('gift-categorized')).toEqual({
			categoryId: 'books',
			categoryIds: ['books'],
		});
		expect(await categoriesOf('gift-uncategorized')).toEqual({
			categoryId: null,
			categoryIds: [],
		});
	});

	it('keeps the legacy column mirroring the primary category on application writes', async () => {
		const sql = database!;
		await sql`
			INSERT INTO gift (id, wishlist_id, category_ids, name)
			VALUES ('gift-app-insert', 'wishlist', ${['games', 'toys']}, 'App insert')
		`;
		expect(await categoriesOf('gift-app-insert')).toEqual({
			categoryId: 'games',
			categoryIds: ['games', 'toys'],
		});

		await sql`UPDATE gift SET category_ids = ${['toys', 'games']} WHERE id = 'gift-app-insert'`;
		expect((await categoriesOf('gift-app-insert')).categoryId).toBe('toys');

		await sql`UPDATE gift SET category_ids = '{}' WHERE id = 'gift-app-insert'`;
		expect((await categoriesOf('gift-app-insert')).categoryId).toBeNull();
	});

	it('lets a release that writes only the legacy column replace the primary or clear all', async () => {
		const sql = database!;
		await sql`
			INSERT INTO gift (id, wishlist_id, category_id, name)
			VALUES ('gift-legacy', 'wishlist', 'books', 'Legacy insert')
		`;
		expect((await categoriesOf('gift-legacy')).categoryIds).toEqual(['books']);

		await sql`UPDATE gift SET category_ids = ${['books', 'games', 'toys']} WHERE id = 'gift-legacy'`;
		await sql`UPDATE gift SET category_id = 'toys' WHERE id = 'gift-legacy'`;
		expect(await categoriesOf('gift-legacy')).toEqual({
			categoryId: 'toys',
			categoryIds: ['toys', 'games'],
		});

		await sql`UPDATE gift SET name = 'Renamed' WHERE id = 'gift-legacy'`;
		expect((await categoriesOf('gift-legacy')).categoryIds).toEqual(['toys', 'games']);

		await sql`UPDATE gift SET category_id = NULL WHERE id = 'gift-legacy'`;
		expect(await categoriesOf('gift-legacy')).toEqual({ categoryId: null, categoryIds: [] });
	});

	it('rejects more than five categories', async () => {
		await expect(
			database!`
				UPDATE gift
				SET category_ids = ${['books', 'games', 'toys', 'home', 'garden', 'music']}
				WHERE id = 'gift-categorized'
			`,
		).rejects.toThrow(/gift_category_ids_limit_check/);
	});
});
