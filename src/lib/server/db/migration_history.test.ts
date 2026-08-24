import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	loadMigrationManifest,
	reconcileMigrationHistory,
	type MigrationManifestEntry,
} from '../../../../scripts/migration-history.js';

const repositoryRoots: string[] = [];

async function repository(
	entries: Array<{ idx: number; tag: string; when: number }>,
	sql = 'SELECT 1;\n',
) {
	const root = await mkdtemp(join(tmpdir(), 'migration-history-'));
	repositoryRoots.push(root);
	await mkdir(join(root, 'drizzle', 'meta'), { recursive: true });
	await writeFile(join(root, 'drizzle', 'meta', '_journal.json'), JSON.stringify({ entries }));
	for (const entry of entries) {
		await writeFile(join(root, 'drizzle', `${entry.tag}.sql`), sql);
	}
	return root;
}

afterEach(async () => {
	const roots = repositoryRoots.splice(0);
	await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

const manifest: MigrationManifestEntry[] = [
	{
		idx: 0,
		tag: '0000_first',
		when: 100n,
		hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
	},
	{
		idx: 1,
		tag: '0001_second',
		when: 200n,
		hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
	},
];

describe('migration history manifest', () => {
	it('loads journaled SQL and hashes its exact UTF-8 text with lowercase SHA-256', async () => {
		const root = await repository([{ idx: 0, tag: '0000_first', when: 100 }], 'SELECT π;\r\n');
		await expect(loadMigrationManifest(root)).resolves.toEqual([
			{
				idx: 0,
				tag: '0000_first',
				when: 100n,
				hash: '0272f9b80f606cb8689022b300ca2351c03ddd0cda29af65be53d7cc17377289',
			},
		]);
	});

	it.each([
		['empty entries', []],
		['non-contiguous indexes', [{ idx: 1, tag: '0000_first', when: 100 }]],
		[
			'duplicate tags',
			[
				{ idx: 0, tag: 'same', when: 100 },
				{ idx: 1, tag: 'same', when: 200 },
			],
		],
		[
			'duplicate timestamps',
			[
				{ idx: 0, tag: 'a', when: 100 },
				{ idx: 1, tag: 'b', when: 100 },
			],
		],
		[
			'non-increasing timestamps',
			[
				{ idx: 0, tag: 'a', when: 200 },
				{ idx: 1, tag: 'b', when: 100 },
			],
		],
		['non-numeric timestamps', [{ idx: 0, tag: 'a', when: '100' as unknown as number }]],
	])('rejects an invalid journal with %s', async (_label, entries) => {
		const root = await repository(entries);
		await expect(loadMigrationManifest(root)).rejects.toThrow(/journal/i);
	});

	it('rejects a missing journaled SQL file', async () => {
		const root = await repository([{ idx: 0, tag: '0000_first', when: 100 }]);
		await rm(join(root, 'drizzle', '0000_first.sql'));
		await expect(loadMigrationManifest(root)).rejects.toThrow(/0000_first/);
	});

	it('rejects extra top-level SQL migration files', async () => {
		const root = await repository([{ idx: 0, tag: '0000_first', when: 100 }]);
		await writeFile(join(root, 'drizzle', 'orphan.sql'), 'SELECT 2;');
		await expect(loadMigrationManifest(root)).rejects.toThrow(/orphan\.sql/);
	});
});

describe('migration history reconciliation', () => {
	it('reports exact when every normalized ledger row matches', () => {
		expect(
			reconcileMigrationHistory(manifest, [
				{ id: 8, hash: manifest[0].hash, createdAt: '100' },
				{ id: 9n, hash: manifest[1].hash, createdAt: 200 },
			]),
		).toEqual({ status: 'exact' });
	});

	it('orders ledger rows logically by createdAt and id before comparison', () => {
		expect(
			reconcileMigrationHistory(manifest, [
				{ id: 9, hash: manifest[1].hash, createdAt: 200 },
				{ id: 8, hash: manifest[0].hash, createdAt: 100 },
			]),
		).toEqual({ status: 'exact' });
	});

	it('reports all migrations pending for an empty ledger', () => {
		expect(reconcileMigrationHistory(manifest, [])).toEqual({
			status: 'pending',
			pending: manifest,
		});
	});

	it('reports only the suffix pending when the ledger is an exact prefix', () => {
		expect(
			reconcileMigrationHistory(manifest, [
				{ id: 1, hash: manifest[0].hash, createdAt: 100n },
			]),
		).toEqual({ status: 'pending', pending: [manifest[1]] });
	});

	it.each([
		[
			'extra row',
			[
				{ id: 1, hash: manifest[0].hash, createdAt: 100 },
				{ id: 2, hash: manifest[1].hash, createdAt: 200 },
				{ id: 3, hash: 'cccc', createdAt: 300 },
			],
		],
		['wrong hash', [{ id: 1, hash: 'secret-sql-aaaaaaaa', createdAt: 100 }]],
		['non-lowercase hash', [{ id: 1, hash: manifest[0].hash.toUpperCase(), createdAt: 100 }]],
		['wrong timestamp', [{ id: 1, hash: manifest[0].hash, createdAt: 101 }]],
		['missing middle', [{ id: 1, hash: manifest[1].hash, createdAt: 200 }]],
		[
			'reordered rows',
			[
				{ id: 1, hash: manifest[1].hash, createdAt: 100 },
				{ id: 2, hash: manifest[0].hash, createdAt: 200 },
			],
		],
		[
			'duplicate rows',
			[
				{ id: 1, hash: manifest[0].hash, createdAt: 100 },
				{ id: 2, hash: manifest[0].hash, createdAt: 100 },
			],
		],
	])('reports drift for %s with a safe diagnostic', (_label, rows) => {
		const result = reconcileMigrationHistory(manifest, rows);
		expect(result.status).toBe('drift');
		if (result.status !== 'drift') {
			throw new Error('Expected drift');
		}
		expect(result.diagnostic).toMatch(/(0000_first|0001_second|timestamp|extra|ledger)/i);
		expect(result.diagnostic).not.toContain('secret-sql');
		expect(result.diagnostic.length).toBeLessThan(500);
	});
});
