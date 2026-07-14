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
 * type rewrites, data deletion). Such statements are allowed only in an
 * explicitly acknowledged contract migration: the file must contain a comment
 *
 *   -- expand-contract: <why this is safe to run against the live app>
 *
 * stating why the currently deployed application no longer depends on the
 * dropped/renamed objects. Runs in check:all and CI.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = 'drizzle';
const ACKNOWLEDGMENT_MARKER = /^\s*--\s*expand-contract:\s*\S+/m;

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

const violations = [];

for (const fileName of migrationFiles) {
	const filePath = join(MIGRATIONS_DIR, fileName);
	const rawSql = readFileSync(filePath, 'utf-8');
	const executableSql = stripSqlComments(rawSql);

	const matchedLabels = DESTRUCTIVE_PATTERNS.filter(({ pattern }) =>
		pattern.test(executableSql),
	).map(({ label }) => label);

	if (matchedLabels.length > 0 && !ACKNOWLEDGMENT_MARKER.test(rawSql)) {
		violations.push({ filePath, matchedLabels });
	}
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
			'acknowledge it by adding a comment to the migration file:',
			'',
			'  -- expand-contract: <why the deployed app no longer uses the dropped/renamed objects>',
			'',
		].join('\n'),
	);
	process.exit(1);
}

console.log(`Migration safety check passed (${String(migrationFiles.length)} migrations).`);
