import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL ?? '';
const temporarySchema = `test_wishlist_occasion_${Date.now()}_${Math.random()
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
	await database.unsafe(`CREATE TYPE wishlist_kind AS ENUM ('occasion', 'permanent')`);
	await database.unsafe(`
		CREATE TABLE wishlist (
			id text PRIMARY KEY NOT NULL,
			kind wishlist_kind DEFAULT 'occasion' NOT NULL,
			theme_id text,
			event_date timestamp with time zone
		)
	`);
	await database.unsafe(`
		INSERT INTO wishlist (id, kind, theme_id, event_date) VALUES
			('permanent-christmas-motif', 'permanent', 'christmas', NULL),
			('christmas-eve-prague', 'occasion', NULL, '2026-12-23T23:00:00Z'),
			('christmas-day-prague', 'occasion', NULL, '2026-12-24T23:30:00Z'),
			('christmas-motif-undated', 'occasion', 'christmas', NULL),
			('birthday-gamer', 'occasion', 'gamer', '2026-03-14T10:00:00Z'),
			('undated-plain', 'occasion', NULL, NULL)
	`);

	const migrationSql = await readFile(
		new URL('../../../../drizzle/0034_add-wishlist-occasion.sql', import.meta.url),
		'utf8',
	);
	// The enum is created in the temporary schema rather than the real database's public one.
	for (const statement of migrationSql
		.replaceAll('"public".', '')
		.split('--> statement-breakpoint')) {
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

async function readKindAndOccasion(wishlistId: string) {
	const [row] = await database!<{ kind: string; occasion: string }[]>`
		SELECT kind, occasion FROM wishlist WHERE id = ${wishlistId}
	`;
	return { kind: row!.kind, occasion: row!.occasion };
}

describe.skipIf(!databaseReady)('0034 wishlist occasion migration [real DB]', () => {
	it('backfills permanent lists, 24. 12. or Christmas-motif lists and the rest', async () => {
		expect(await readKindAndOccasion('permanent-christmas-motif')).toEqual({
			kind: 'permanent',
			occasion: 'permanent',
		});
		expect((await readKindAndOccasion('christmas-eve-prague')).occasion).toBe('christmas');
		expect((await readKindAndOccasion('christmas-day-prague')).occasion).toBe('other');
		expect((await readKindAndOccasion('christmas-motif-undated')).occasion).toBe('christmas');
		expect((await readKindAndOccasion('birthday-gamer')).occasion).toBe('other');
		expect((await readKindAndOccasion('undated-plain')).occasion).toBe('other');
	});

	it('turns a release that writes only the kind into the matching occasion', async () => {
		const sql = database!;
		await sql`INSERT INTO wishlist (id, kind) VALUES ('legacy-permanent', 'permanent')`;
		await sql`INSERT INTO wishlist (id) VALUES ('legacy-occasion')`;
		expect(await readKindAndOccasion('legacy-permanent')).toEqual({
			kind: 'permanent',
			occasion: 'permanent',
		});
		expect(await readKindAndOccasion('legacy-occasion')).toEqual({
			kind: 'occasion',
			occasion: 'other',
		});

		await sql`UPDATE wishlist SET kind = 'occasion' WHERE id = 'christmas-eve-prague'`;
		expect((await readKindAndOccasion('christmas-eve-prague')).occasion).toBe('christmas');
		await sql`UPDATE wishlist SET kind = 'permanent' WHERE id = 'christmas-eve-prague'`;
		expect((await readKindAndOccasion('christmas-eve-prague')).occasion).toBe('permanent');
		await sql`UPDATE wishlist SET kind = 'occasion' WHERE id = 'christmas-eve-prague'`;
		expect(await readKindAndOccasion('christmas-eve-prague')).toEqual({
			kind: 'occasion',
			occasion: 'other',
		});
	});

	it('keeps writes of both columns and rejects a contradictory pair', async () => {
		const sql = database!;
		await sql`
			UPDATE wishlist SET kind = 'occasion', occasion = 'birthday'
			WHERE id = 'permanent-christmas-motif'
		`;
		expect(await readKindAndOccasion('permanent-christmas-motif')).toEqual({
			kind: 'occasion',
			occasion: 'birthday',
		});
		await expect(
			sql`UPDATE wishlist SET occasion = 'permanent' WHERE id = 'undated-plain'`,
		).rejects.toThrow(/wishlist_occasion_kind_check/);
	});
});
