import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readMigrationFiles } from 'drizzle-orm/migrator';

export type MigrationManifestEntry = {
	idx: number;
	tag: string;
	when: bigint;
	hash: string;
};

export type MigrationLedgerRow = {
	id: string | number | bigint;
	hash: string;
	createdAt: string | number | bigint;
};

export type MigrationReconciliation =
	| { status: 'exact' }
	| { status: 'pending'; pending: MigrationManifestEntry[] }
	| { status: 'drift'; diagnostic: string };

type JournalEntry = { idx?: unknown; tag?: unknown; when?: unknown };

export async function loadMigrationManifest(
	repositoryRoot: string,
): Promise<MigrationManifestEntry[]> {
	const drizzleRoot = join(repositoryRoot, 'drizzle');
	const journalText = await readFile(join(drizzleRoot, 'meta', '_journal.json'), 'utf8');
	let entries: JournalEntry[];
	try {
		const journal = JSON.parse(journalText) as { entries?: unknown };
		if (!Array.isArray(journal.entries)) {
			throw new Error('entries is not an array');
		}
		entries = journal.entries;
	} catch (error) {
		throw new Error(
			`Invalid migration journal: ${error instanceof Error ? error.message : 'parse error'}`,
		);
	}

	if (entries.length === 0) {
		throw new Error('Invalid migration journal: entries must be nonempty');
	}
	const tags = new Set<string>();
	const timestamps = new Set<number>();
	let previousWhen = -Infinity;
	for (const [position, entry] of entries.entries()) {
		if (entry.idx !== position) {
			throw new Error(`Invalid migration journal index at entry ${position}`);
		}
		if (typeof entry.tag !== 'string' || entry.tag.length === 0 || tags.has(entry.tag)) {
			throw new Error(`Invalid migration journal tag at entry ${position}`);
		}
		if (
			typeof entry.when !== 'number' ||
			!Number.isSafeInteger(entry.when) ||
			timestamps.has(entry.when) ||
			entry.when <= previousWhen
		) {
			throw new Error(`Invalid migration journal timestamp at tag ${entry.tag}`);
		}
		tags.add(entry.tag);
		timestamps.add(entry.when);
		previousWhen = entry.when;
	}

	const sqlFiles = (await readdir(drizzleRoot)).filter((name) => name.endsWith('.sql'));
	const expectedFiles = new Set(entries.map((entry) => `${String(entry.tag)}.sql`));
	const extraFiles = sqlFiles.filter((name) => !expectedFiles.has(name));
	if (extraFiles.length > 0) {
		throw new Error(`Unjournaled migration SQL file: ${extraFiles.join(', ')}`);
	}

	await Promise.all(
		entries.map(async (entry) => {
			const tag = entry.tag as string;
			try {
				await readFile(join(drizzleRoot, `${tag}.sql`));
			} catch {
				throw new Error(`Missing journaled migration SQL file for ${tag}`);
			}
		}),
	);

	const drizzleMigrations = readMigrationFiles({ migrationsFolder: drizzleRoot });
	if (drizzleMigrations.length !== entries.length) {
		throw new Error(
			'Invalid migration journal: Drizzle metadata length does not match journal',
		);
	}

	return entries.map((entry, idx) => {
		const drizzleMigration = drizzleMigrations[idx];
		if (!drizzleMigration || drizzleMigration.folderMillis !== entry.when) {
			throw new Error(`Invalid migration journal timestamp at tag ${String(entry.tag)}`);
		}
		return {
			idx,
			tag: entry.tag as string,
			when: BigInt(drizzleMigration.folderMillis),
			hash: drizzleMigration.hash,
		};
	});
}

function normalizeInteger(value: string | number | bigint): bigint | undefined {
	if (typeof value === 'bigint') {
		return value;
	}
	if (typeof value === 'number') {
		return Number.isSafeInteger(value) ? BigInt(value) : undefined;
	}
	return /^-?\d+$/.test(value) ? BigInt(value) : undefined;
}

function hashPrefix(hash: string): string {
	return /^[0-9a-f]+$/i.test(hash) ? hash.toLowerCase().slice(0, 8) : '<invalid>';
}

export function reconcileMigrationHistory(
	expected: readonly MigrationManifestEntry[],
	ledger: readonly MigrationLedgerRow[],
): MigrationReconciliation {
	const orderedLedger = ledger
		.map((row) => ({
			row,
			createdAt: normalizeInteger(row.createdAt),
			id: normalizeInteger(row.id),
		}))
		.sort((left, right) => {
			if (left.createdAt === undefined || right.createdAt === undefined) {
				return 0;
			}
			if (left.createdAt !== right.createdAt) {
				return left.createdAt < right.createdAt ? -1 : 1;
			}
			if (left.id === undefined || right.id === undefined || left.id === right.id) {
				return 0;
			}
			return left.id < right.id ? -1 : 1;
		});
	for (let index = 0; index < orderedLedger.length; index += 1) {
		const { row, createdAt } = orderedLedger[index];
		const migration = expected[index];
		if (!migration) {
			return {
				status: 'drift',
				diagnostic: `Extra ledger row at position ${index}: timestamp ${createdAt?.toString() ?? '<invalid>'}, hash ${hashPrefix(row.hash)}`,
			};
		}
		if (createdAt !== migration.when || row.hash !== migration.hash) {
			return {
				status: 'drift',
				diagnostic: `Migration ${migration.tag} mismatch at position ${index}: expected timestamp ${migration.when} hash ${hashPrefix(migration.hash)}, ledger timestamp ${createdAt?.toString() ?? '<invalid>'} hash ${hashPrefix(row.hash)}`,
			};
		}
	}
	if (ledger.length === expected.length) {
		return { status: 'exact' };
	}
	return { status: 'pending', pending: expected.slice(ledger.length) };
}
