/**
 * Runs Drizzle migrations against the production Neon database.
 *
 * Reads DATABASE_URL from .env.production (gitignored).
 * Create that file with the Neon direct (non-pooled) connection string
 * before running this script.
 *
 * Usage:
 *   pnpm db:migrate:prod
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const ENV_FILE = '.env.production';

if (!existsSync(ENV_FILE)) {
	console.error(`Error: ${ENV_FILE} not found.`);
	console.error(
		`Create it with:\n  DATABASE_URL="postgresql://USER:PASS@HOST/dbname?sslmode=require"\n`,
	);
	process.exit(1);
}

const raw = readFileSync(ENV_FILE, 'utf-8');

// Parse key=value lines, ignoring comments and blanks.
const vars: Record<string, string> = {};
for (const line of raw.split(/\r?\n/)) {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith('#')) {
		continue;
	}
	const eq = trimmed.indexOf('=');
	if (eq === -1) {
		continue;
	}
	const key = trimmed.slice(0, eq).trim();
	const value = trimmed
		.slice(eq + 1)
		.trim()
		.replace(/^['"]|['"]$/g, '');
	vars[key] = value;
}

const prodUrl = vars['DATABASE_URL'];
if (!prodUrl) {
	console.error(`Error: DATABASE_URL not found in ${ENV_FILE}.`);
	process.exit(1);
}

console.log(`Migrating production database…`);
console.log(`  Host: ${new URL(prodUrl).host}`);
console.log();

execSync('pnpm drizzle-kit migrate', {
	stdio: 'inherit',
	env: { ...process.env, DATABASE_URL: prodUrl },
});
