import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL ?? '';
const temporarySchema = `test_gift_category_color_${Date.now()}_${Math.random()
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
	const candidate = postgres(databaseUrl, { max: 1 });
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

const presetColors = new Map([
	['games', '#7C3AED'],
	['toys', '#D97706'],
	['books', '#2563EB'],
	['clothing', '#DB2777'],
	['electronics', '#0F766E'],
	['home', '#B45309'],
	['experiences', '#15803D'],
	['subscriptions', '#6D28D9'],
	['personal-care', '#BE185D'],
]);

const customPalette = [
	'#0369A1',
	'#047857',
	'#A21CAF',
	'#C2410C',
	'#4F46E5',
	'#B91C1C',
	'#0F766E',
	'#7E22CE',
] as const;

interface CustomFixture {
	id: string;
	createdAt: string;
	deleted: boolean;
}

const customFixtures: CustomFixture[] = [
	{ id: 'custom-z', createdAt: '2024-01-01T00:00:00.000Z', deleted: false },
	{ id: 'custom-a', createdAt: '2024-01-02T00:00:00.000Z', deleted: false },
	{ id: 'custom-c', createdAt: '2024-01-03T00:00:00.000Z', deleted: true },
	{ id: 'custom-b', createdAt: '2024-01-03T00:00:00.000Z', deleted: false },
	{ id: 'custom-d', createdAt: '2024-01-04T00:00:00.000Z', deleted: false },
	{ id: 'custom-e', createdAt: '2024-01-05T00:00:00.000Z', deleted: false },
	{ id: 'custom-f', createdAt: '2024-01-06T00:00:00.000Z', deleted: false },
	{ id: 'custom-g', createdAt: '2024-01-07T00:00:00.000Z', deleted: false },
	{ id: 'custom-h', createdAt: '2024-01-08T00:00:00.000Z', deleted: false },
];

describe.skipIf(!databaseReady)('0019 gift category color migration [real DB]', () => {
	it('backfills colors without changing category history or gift assignments', async () => {
		const sql = database!;
		await sql.unsafe(`
			CREATE TABLE gift_category (
				id text PRIMARY KEY NOT NULL,
				wishlist_id text NOT NULL,
				preset_key text,
				custom_label text,
				sort_order integer DEFAULT 0 NOT NULL,
				deleted_at timestamp with time zone,
				created_at timestamp with time zone DEFAULT now() NOT NULL,
				updated_at timestamp with time zone DEFAULT now() NOT NULL
			)
		`);
		await sql.unsafe(`
			CREATE TABLE gift (
				id text PRIMARY KEY NOT NULL,
				wishlist_id text NOT NULL,
				category_id text,
				name text NOT NULL,
				CONSTRAINT gift_category_fk FOREIGN KEY (category_id) REFERENCES gift_category(id)
			)
		`);

		let presetSortOrder = 0;
		for (const presetKey of presetColors.keys()) {
			await sql`
				INSERT INTO gift_category (
					id, wishlist_id, preset_key, sort_order, deleted_at, created_at, updated_at
				) VALUES (
					${`preset-${presetKey}`}, 'wishlist-main', ${presetKey}, ${presetSortOrder},
					${presetSortOrder % 2 === 0 ? null : new Date('2024-02-01T00:00:00.000Z')},
					${new Date(`2024-01-${String(presetSortOrder + 1).padStart(2, '0')}T00:00:00.000Z`)},
					${new Date('2024-03-01T00:00:00.000Z')}
				)
			`;
			presetSortOrder += 1;
		}
		for (const [index, fixture] of customFixtures.entries()) {
			await sql`
				INSERT INTO gift_category (
					id, wishlist_id, custom_label, sort_order, deleted_at, created_at, updated_at
				) VALUES (
					${fixture.id}, 'wishlist-main', ${`Vlastní ${fixture.id}`}, ${100 + index},
					${fixture.deleted ? new Date('2024-02-15T00:00:00.000Z') : null},
					${new Date(fixture.createdAt)}, ${new Date('2024-03-01T00:00:00.000Z')}
				)
			`;
		}
		await sql`
			INSERT INTO gift (id, wishlist_id, category_id, name) VALUES
				('gift-active-preset', 'wishlist-main', 'preset-games', 'Active preset gift'),
				('gift-deleted-preset', 'wishlist-main', 'preset-toys', 'Deleted preset gift'),
				('gift-active-custom', 'wishlist-main', 'custom-z', 'Active custom gift'),
				('gift-deleted-custom', 'wishlist-main', 'custom-c', 'Deleted custom gift')
		`;

		const categorySnapshot = await sql`
			SELECT id, wishlist_id, preset_key, custom_label, sort_order, deleted_at,
				created_at, updated_at
			FROM gift_category
			ORDER BY id
		`;
		const giftSnapshot = await sql`
			SELECT id, wishlist_id, category_id, name
			FROM gift
			ORDER BY id
		`;

		const migrationSql = await readFile(
			new URL('../../../../drizzle/0019_add_gift_category_colors.sql', import.meta.url),
			'utf8',
		);
		for (const statement of migrationSql.split('--> statement-breakpoint')) {
			if (statement.trim() !== '') {
				await sql.unsafe(statement);
			}
		}

		expect(
			await sql`
				SELECT id, wishlist_id, preset_key, custom_label, sort_order, deleted_at,
					created_at, updated_at
				FROM gift_category
				ORDER BY id
			`,
		).toEqual(categorySnapshot);
		expect(
			await sql`
				SELECT id, wishlist_id, category_id, name
				FROM gift
				ORDER BY id
			`,
		).toEqual(giftSnapshot);

		const migratedPresetRows = await sql<{ preset_key: string; color: string }[]>`
			SELECT preset_key, color
			FROM gift_category
			WHERE preset_key IS NOT NULL
		`;
		expect(new Map(migratedPresetRows.map((row) => [row.preset_key, row.color]))).toEqual(
			presetColors,
		);

		const migratedCustomRows = await sql<{ id: string; color: string }[]>`
			SELECT id, color
			FROM gift_category
			WHERE preset_key IS NULL
		`;
		const customColors = new Map(migratedCustomRows.map((row) => [row.id, row.color]));
		const rankedFixtures = [...customFixtures].sort(
			(first, second) =>
				first.createdAt.localeCompare(second.createdAt) ||
				first.id.localeCompare(second.id),
		);
		for (const [index, fixture] of rankedFixtures.entries()) {
			expect(customColors.get(fixture.id)).toBe(customPalette[index % customPalette.length]);
		}
		expect(customColors.get('custom-c')).toBe(customPalette[3]);

		const nullabilityRows = await sql<{ is_nullable: string }[]>`
			SELECT is_nullable
			FROM information_schema.columns
			WHERE table_schema = ${temporarySchema}
				AND table_name = 'gift_category'
				AND column_name = 'color'
		`;
		expect(nullabilityRows[0]?.is_nullable).toBe('NO');
		const colorCheckRows = await sql<{ check_definition: string }[]>`
			SELECT pg_get_constraintdef(oid) AS check_definition
			FROM pg_constraint
			WHERE connamespace = ${temporarySchema}::regnamespace
				AND conname = 'gift_category_color_hex_check'
		`;
		expect(colorCheckRows[0]?.check_definition).toContain('^#[0-9A-Fa-f]{6}$');
		expect(
			[...presetColors.values(), ...customColors.values()].every((color) =>
				/^#[0-9A-Fa-f]{6}$/.test(color),
			),
		).toBe(true);

		const [legacyInsert] = await sql<{ color: string }[]>`
			INSERT INTO gift_category (
				id, wishlist_id, custom_label, sort_order, created_at, updated_at
			) VALUES (
				'custom-legacy', 'wishlist-main', 'Legacy insert', 200,
				${new Date('2024-04-01T00:00:00.000Z')}, ${new Date('2024-04-01T00:00:00.000Z')}
			)
			RETURNING color
		`;
		expect(legacyInsert?.color).toBe(
			customPalette[customFixtures.length % customPalette.length],
		);
	});
});
