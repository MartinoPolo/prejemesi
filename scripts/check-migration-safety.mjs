/**
 * Migration safety guard (issue #110, REQ-2).
 *
 * Production schema changes must follow the non-destructive
 * expand → migrate → deploy → contract sequence (docs/DEPLOYMENT.md):
 * a migration that runs while the previous app version is still deployed
 * must not remove or rename anything that version still reads or writes.
 *
 * This script scans committed migrations in drizzle/*.sql for statements that
 * break that compatibility window (dropping/renaming tables or columns,
 * type rewrites, data deletion). Such statements are allowed only when the
 * migration tag has a rationale in drizzle/meta/contract-migrations.json.
 * Keeping the rationale outside SQL preserves the immutable hash recorded by
 * Drizzle in production. Runs in check:all and CI.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const MIGRATIONS_DIR = 'drizzle';
const CONTRACT_MIGRATIONS_FILE = join(MIGRATIONS_DIR, 'meta', 'contract-migrations.json');

/** Statements that break old-app ↔ new-schema compatibility or delete data. */
const DESTRUCTIVE_PATTERNS = [
	{ pattern: /\bDROP\s+TABLE\b/i, label: 'DROP TABLE' },
	{ pattern: /\bDROP\s+COLUMN\b/i, label: 'DROP COLUMN' },
	{ pattern: /\bDROP\s+TYPE\b/i, label: 'DROP TYPE' },
	{ pattern: /\bDROP\s+SCHEMA\b/i, label: 'DROP SCHEMA' },
	{ pattern: /\bTRUNCATE\b/i, label: 'TRUNCATE' },
	{ pattern: /\bDELETE\s+FROM\b/i, label: 'DELETE FROM' },
	{ pattern: /\bRENAME\s+(?:TO|COLUMN)\b/i, label: 'RENAME' },
	{ pattern: /\bSET\s+DATA\s+TYPE\b/i, label: 'ALTER COLUMN … SET DATA TYPE' },
	{ pattern: /\bSET\s+NOT\s+NULL\b/i, label: 'ALTER COLUMN … SET NOT NULL' },
];

/** Remove SQL comments so commented-out statements are not flagged. */
function stripSqlComments(sql) {
	return sql.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/--[^\n]*/g, '');
}

const migrationFiles = readdirSync(MIGRATIONS_DIR)
	.filter((name) => name.endsWith('.sql'))
	.sort();
const contractMigrations = JSON.parse(readFileSync(CONTRACT_MIGRATIONS_FILE, 'utf8'));
if (
	typeof contractMigrations !== 'object' ||
	contractMigrations === null ||
	Array.isArray(contractMigrations)
) {
	throw new Error(`${CONTRACT_MIGRATIONS_FILE} must contain an object of migration rationales`);
}
for (const [tag, rationale] of Object.entries(contractMigrations)) {
	if (typeof rationale !== 'string' || rationale.trim().length === 0) {
		throw new Error(`${CONTRACT_MIGRATIONS_FILE} has no rationale for ${tag}`);
	}
}

const violations = [];
const acknowledgedContracts = new Set();

for (const fileName of migrationFiles) {
	const filePath = join(MIGRATIONS_DIR, fileName);
	const rawSql = readFileSync(filePath, 'utf-8');
	const executableSql = stripSqlComments(rawSql);

	const matchedLabels = DESTRUCTIVE_PATTERNS.filter(({ pattern }) =>
		pattern.test(executableSql),
	).map(({ label }) => label);

	if (matchedLabels.length === 0) {
		continue;
	}
	const tag = basename(fileName, '.sql');
	if (Object.hasOwn(contractMigrations, tag)) {
		acknowledgedContracts.add(tag);
	} else {
		violations.push({ filePath, matchedLabels });
	}
}

const staleAcknowledgments = Object.keys(contractMigrations).filter(
	(tag) => !acknowledgedContracts.has(tag),
);
if (staleAcknowledgments.length > 0) {
	throw new Error(
		`${CONTRACT_MIGRATIONS_FILE} has stale or unknown entries: ${staleAcknowledgments.join(', ')}`,
	);
}

if (violations.length > 0) {
	console.error('Migration safety check failed.\n');
	for (const { filePath, matchedLabels } of violations) {
		console.error(`  ${filePath}`);
		console.error(`    destructive statements: ${matchedLabels.join(', ')}`);
	}
	console.error(
		[
			'',
			'These statements break compatibility with the currently deployed app',
			'version or delete data. Follow expand → migrate → deploy → contract',
			'(docs/DEPLOYMENT.md). If this migration is a deliberate contract step,',
			'add its tag and rationale to drizzle/meta/contract-migrations.json.',
			'Do not edit an applied SQL file because Drizzle records its exact hash.',
			'',
		].join('\n'),
	);
	process.exit(1);
}

console.log(`Migration safety check passed (${String(migrationFiles.length)} migrations).`);
