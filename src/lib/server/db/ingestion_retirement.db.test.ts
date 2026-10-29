import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { DB_READY } from '$lib/server/operations/operations.db.test-setup.js';
import { getDb } from './index.js';
import { giftIngestionItem, giftIngestionOrphan, giftIngestionRun } from './ingestion.schema.js';

const INGESTION_TABLE_NAMES = [giftIngestionRun, giftIngestionItem, giftIngestionOrphan].map(
	(table) => getTableConfig(table).name,
);
const MIGRATIONS_DIRECTORY = path.resolve('drizzle');

function migrationStatements() {
	return readdirSync(MIGRATIONS_DIRECTORY)
		.filter((fileName) => fileName.endsWith('.sql'))
		.flatMap((fileName) =>
			readFileSync(path.join(MIGRATIONS_DIRECTORY, fileName), 'utf8')
				.split(/;|--> statement-breakpoint/)
				.map((statement) => ({ fileName, statement: statement.trim() })),
		);
}

describe('retired gift ingestion keeps its historical tables', () => {
	it('no migration drops, renames, truncates or deletes from the ingestion tables', () => {
		const statements = migrationStatements();

		for (const tableName of INGESTION_TABLE_NAMES) {
			const quotedName = `"${tableName}"`;
			expect(
				statements.some(
					({ statement }) =>
						/^CREATE TABLE/i.test(statement) && statement.includes(quotedName),
				),
			).toBe(true);
			const destructive = statements.filter(
				({ statement }) =>
					statement.includes(quotedName) &&
					(/^(DROP TABLE|TRUNCATE|DELETE FROM)/i.test(statement) ||
						/^ALTER TABLE\s+\S+\s+RENAME TO/i.test(statement)),
			);
			expect(destructive).toEqual([]);
		}
	});

	it.skipIf(!DB_READY)('the migrated database still has the ingestion tables', async () => {
		const rows = await getDb().execute<{ table_name: string }>(
			sql`select table_name from information_schema.tables where table_schema = 'public'`,
		);

		expect(Array.from(rows, (row) => row.table_name)).toEqual(
			expect.arrayContaining(INGESTION_TABLE_NAMES),
		);
	});
});
