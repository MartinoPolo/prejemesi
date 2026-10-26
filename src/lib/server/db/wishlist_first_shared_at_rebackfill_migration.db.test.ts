import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL ?? '';
const temporarySchema = `test_first_shared_at_rebackfill_${Date.now()}_${Math.random()
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

async function runMigration() {
	const migrationSql = await readFile(
		new URL(
			'../../../../drizzle/0032_rebackfill-wishlist-first-shared-at.sql',
			import.meta.url,
		),
		'utf8',
	);
	for (const statement of migrationSql.split('--> statement-breakpoint')) {
		if (statement.trim() !== '') {
			await database!.unsafe(statement);
		}
	}
}

beforeAll(async () => {
	if (database === null) {
		return;
	}
	await database.unsafe(`CREATE SCHEMA "${temporarySchema}"`);
	schemaCreated = true;
	await database.unsafe(`SET search_path TO "${temporarySchema}"`);
	await database.unsafe(`
		CREATE TABLE wishlist (
			id text PRIMARY KEY NOT NULL,
			shared_at timestamp with time zone,
			first_shared_at timestamp with time zone
		)
	`);
	await database.unsafe(`
		INSERT INTO wishlist (id, shared_at, first_shared_at) VALUES
			('shared-by-previous-app', '2026-10-20T10:00:00Z', NULL),
			('never-shared', NULL, NULL),
			('reshared-after-first-share', '2026-10-22T10:00:00Z', '2026-09-01T10:00:00Z'),
			('reverted-after-first-share', NULL, '2026-09-01T10:00:00Z')
	`);
	await runMigration();
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

async function firstSharedAtOf(wishlistId: string): Promise<string | null> {
	const [row] = await database!<{ first_shared_at: Date | null }[]>`
		SELECT first_shared_at FROM wishlist WHERE id = ${wishlistId}
	`;
	return row?.first_shared_at?.toISOString() ?? null;
}

describe.skipIf(!databaseReady)(
	'0032 wishlist first_shared_at re-backfill migration [real DB]',
	() => {
		it('records the share time of wishlists the previous app shared without first_shared_at', async () => {
			expect(await firstSharedAtOf('shared-by-previous-app')).toBe(
				'2026-10-20T10:00:00.000Z',
			);
		});

		it('leaves never-shared wishlists movable', async () => {
			expect(await firstSharedAtOf('never-shared')).toBeNull();
		});

		it('keeps an existing first share time, including after a revert', async () => {
			expect(await firstSharedAtOf('reshared-after-first-share')).toBe(
				'2026-09-01T10:00:00.000Z',
			);
			expect(await firstSharedAtOf('reverted-after-first-share')).toBe(
				'2026-09-01T10:00:00.000Z',
			);
		});

		it('is idempotent', async () => {
			await runMigration();
			expect(await firstSharedAtOf('shared-by-previous-app')).toBe(
				'2026-10-20T10:00:00.000Z',
			);
			expect(await firstSharedAtOf('reshared-after-first-share')).toBe(
				'2026-09-01T10:00:00.000Z',
			);
		});
	},
);
